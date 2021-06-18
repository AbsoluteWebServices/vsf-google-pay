<template>
  <div ref="buttonRef" />
</template>

<script>
import { ref, computed, onMounted } from '@vue/composition-api';
import { useVSFContext } from '@vue-storefront/core';

const baseRequest = {
  apiVersion: 2,
  apiVersionMinor: 0
};

const ENV_PROD = 'production';

let googlePayScriptLoaded = false;
let paymentsClient = null;
const lineItemsToDisplay = ['subtotal', 'tax'];

export default {
  name: 'GooglePayButton',
  props: {
    totals: {
      type: Object,
      required: true,
    },
    type: {
      type: String,
      required: false,
      default: 'long',
      validator: function (value) {
        return ['long', 'short'].indexOf(value) !== -1
      }
    },
    color: {
      type: String,
      required: false,
      default: 'default',
      validator: function (value) {
        return ['default', 'black', 'white'].indexOf(value) !== -1
      }
    },
    disabled: {
      type: Boolean,
      required: false,
      default: false
    }
  },
  head () {
    const skip = googlePayScriptLoaded
    googlePayScriptLoaded = true

    return {
      script: [
        {
          vmid: 'googlepay',
          once: true,
          skip,
          src: 'https://pay.google.com/gp/p/js/pay.js',
          callback: () => window.onGooglePayLoaded && window.onGooglePayLoaded()
        }
      ]
    }
  },
  setup (props, { emit }) {
    const { $googlepay } = useVSFContext();
    const {
      merchantId,
      merchantName,
      gateway,
      gatewayMerchantId,
      allowedCardNetworks,
      allowedAuthMethods,
      currencyCode,
      environment
    } = $googlepay.config;

    const baseCardPaymentMethod = {
      type: 'CARD',
      parameters: {
        allowedAuthMethods,
        allowedCardNetworks
      }
    }

    const tokenizationSpecification = {
      type: 'PAYMENT_GATEWAY',
      parameters: {
        gateway,
        gatewayMerchantId
      }
    };

    const cardPaymentMethod = Object.assign(
      {},
      baseCardPaymentMethod,
      {
        tokenizationSpecification
      }
    )

    const lineItems = computed(() => {
      const lineItems = []

      for (const key in props.totals) {
        if (Object.hasOwnProperty.call(props.totals, key)) {
          const amount = props.totals[key];

          if (key === 'shipping') {
            lineItems.push({
              label: 'Shipping cost',
              type: 'LINE_ITEM',
              price: amount.toFixed(2)
            })
          } else if (lineItemsToDisplay.includes(key)) {
            lineItems.push({
              label: key,
              type: key.toUpperCase(),
              price: amount.toFixed(2)
            })
          }
        }
      }

      return lineItems
    });
    const total = computed(() => props.totals?.total || 0);
    const buttonRef = ref();

    const getGooglePaymentsClient = () => {
      if (paymentsClient === null && window?.google?.payments?.api?.PaymentsClient) {
        paymentsClient = new window.google.payments.api.PaymentsClient({
          environment: environment === ENV_PROD ? 'PRODUCTION' : 'TEST',
          merchantInfo: {
            merchantName: merchantName,
            merchantId: merchantId
          }
        });
      }
      return paymentsClient;
    };

    const getGoogleTransactionInfo = () => {
      return {
        displayItems: lineItems.value,
        currencyCode,
        totalPriceStatus: 'FINAL',
        totalPrice: total.value.toString(),
        totalPriceLabel: 'Total'
      }
    };

    const getGooglePaymentDataRequest = () => {
      const paymentDataRequest = Object.assign({}, baseRequest)
      paymentDataRequest.allowedPaymentMethods = [cardPaymentMethod]
      paymentDataRequest.transactionInfo = getGoogleTransactionInfo()
      paymentDataRequest.merchantInfo = {
        merchantName: merchantName
      }

      if (environment === ENV_PROD) {
        paymentDataRequest.merchantInfo.merchantId = merchantId
      }

      return paymentDataRequest
    };

    const processPayment = (paymentData) => {
      emit('success', paymentData.paymentMethodData)
    };

    const onGooglePaymentButtonClicked = async () => {
      if (props.disabled) {
        return
      }
      const paymentDataRequest = getGooglePaymentDataRequest()
      paymentDataRequest.transactionInfo = getGoogleTransactionInfo()

      try {
        const paymentsClient = getGooglePaymentsClient()
        const paymentData = await paymentsClient.loadPaymentData(paymentDataRequest)
        processPayment(paymentData)
      } catch (err) {
        console.error(err)
      }
    };

    const addGooglePayButton = () => {
      const paymentsClient = getGooglePaymentsClient()
      const button = paymentsClient.createButton({
        onClick: onGooglePaymentButtonClicked,
        buttonColor: props.color,
        buttonType: props.type
      })
      buttonRef.value.appendChild(button)
    };

    const getGoogleIsReadyToPayRequest = () => {
      return Object.assign(
        {},
        baseRequest,
        {
          allowedPaymentMethods: [baseCardPaymentMethod]
        }
      )
    };

    const prefetchGooglePaymentData = () => {
      const paymentDataRequest = getGooglePaymentDataRequest()
      paymentDataRequest.transactionInfo = {
        totalPriceStatus: 'NOT_CURRENTLY_KNOWN',
        currencyCode
      }
      const paymentsClient = getGooglePaymentsClient()
      paymentsClient.prefetchPaymentData(paymentDataRequest)
    };

    const setupButton = async () => {
      const paymentsClient = getGooglePaymentsClient()
      const isReadyToPayRequest = getGoogleIsReadyToPayRequest()

      try {
        const response = await paymentsClient.isReadyToPay(isReadyToPayRequest)
        if (response.result) {
          addGooglePayButton()
          prefetchGooglePaymentData()
        }
      } catch (err) {
        console.error(err)
      }
    };

    onMounted(() => {
      const paymentsClient = getGooglePaymentsClient()
      if (paymentsClient) {
        setupButton();
      } else {
        window.onGooglePayLoaded = () => {
          setupButton();
          window.onGooglePayLoaded = null;
        }
      }
    });

    return {
      buttonRef,
    }
  }
}
</script>
