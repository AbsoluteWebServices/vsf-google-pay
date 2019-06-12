<template>
  <div :ref="id" class="asd" />
</template>

<script>
import config from 'config'
import i18n from '@vue-storefront/i18n'
import rootStore from '@vue-storefront/core/store'
import { KEY } from '../index'
import { SET_PAYMENT_TOKEN } from '../store/mutation-types'

const baseRequest = {
  apiVersion: 2,
  apiVersionMinor: 0
}

const baseCardPaymentMethod = {
  type: 'CARD',
  parameters: {
    allowedAuthMethods: config[KEY].allowedCardAuthMethods,
    allowedCardNetworks: config[KEY].allowedCardNetworks
  }
}

const cardPaymentMethod = Object.assign(
  {},
  baseCardPaymentMethod,
  {
    tokenizationSpecification: config[KEY].tokenizationSpecification
  }
)

const ENV_TEST = 'TEST'
const ENV_PROD = 'PRODUCTION'

let paymentsClient = null

export default {
  name: 'GooglePayButton',
  props: {
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
  data () {
    return {
      id: 'google-pay-button',
      shipping: this.$store.state.checkout.shippingDetails
    }
  },
  mounted () {
    if (config[KEY]) {
      if (rootStore.state[KEY].ready) {
        this.setupButton()
      } else {
        this.$bus.$on(KEY + '-ready', this.setupButton)
      }
    }
  },
  computed: {
    totals () {
      return rootStore.getters['cart/totals']
    },
    shippingMethods () {
      return rootStore.getters['shipping/shippingMethods']
    },
    availableShippingMethods () {
      return this.shippingMethods.filter(method => method.available)
    },
    paymentsClient () {
      if (!paymentsClient) {
        paymentsClient = new window.google.payments.api.PaymentsClient({
          environment: config[KEY].environment,
          merchantInfo: {
            merchantName: config[KEY].merchantName,
            merchantId: config[KEY].merchantId
          },
          paymentDataCallback: this.paymentDataCallback
        })
      }
      return paymentsClient
    }
  },
  methods: {
    setupButton () {
      const isReadyToPayRequest = this.getGoogleIsReadyToPayRequest()

      this.paymentsClient.isReadyToPay(isReadyToPayRequest).then((response) => {
        if (response.result) {
          this.addGooglePayButton()
          this.prefetchGooglePaymentData()
        }
      }).catch((err) => {
        console.error(err)
      })
    },
    paymentDataCallback (intermediatePaymentData) {
      return new Promise((resolve, reject) => {
        // let shippingAddress = intermediatePaymentData.shippingAddress
        let shippingOptionData = intermediatePaymentData.shippingOptionData
        let paymentDataRequestUpdate = {}

        if (intermediatePaymentData.callbackTrigger === 'SHIPPING_ADDRESS') {
          // this.updateShippingAddress(shippingAddress)
          paymentDataRequestUpdate.newShippingOptionParameters = this.getGoogleDefaultShippingOptions()
          let selectedShippingOptionId = paymentDataRequestUpdate.newShippingOptionParameters.defaultSelectedOptionId
          paymentDataRequestUpdate.newTransactionInfo = this.calculateNewTransactionInfo(selectedShippingOptionId)
        } else if (intermediatePaymentData.callbackTrigger === 'SHIPPING_OPTION') {
          paymentDataRequestUpdate.newTransactionInfo = this.calculateNewTransactionInfo(shippingOptionData.id)
        }

        resolve(paymentDataRequestUpdate)
      })
    },
    addGooglePayButton () {
      const button = this.paymentsClient.createButton({
        onClick: this.onGooglePaymentButtonClicked,
        buttonColor: this.color,
        buttonType: this.type
      })
      this.$refs[this.id].appendChild(button)
    },
    getGoogleIsReadyToPayRequest () {
      return Object.assign(
        {},
        baseRequest,
        {
          allowedPaymentMethods: [baseCardPaymentMethod]
        }
      )
    },
    getGooglePaymentDataRequest () {
      const paymentDataRequest = Object.assign({}, baseRequest)
      paymentDataRequest.allowedPaymentMethods = [cardPaymentMethod]
      paymentDataRequest.transactionInfo = this.getGoogleTransactionInfo()
      paymentDataRequest.merchantInfo = {
        merchantName: config[KEY].merchantName
      }

      if (config[KEY].environment === ENV_PROD) {
        paymentDataRequest.merchantInfo.merchantId = config[KEY].merchantId
      }

      paymentDataRequest.callbackIntents = ['SHIPPING_ADDRESS', 'SHIPPING_OPTION']
      paymentDataRequest.shippingAddressRequired = true
      paymentDataRequest.shippingAddressParameters = this.getGoogleShippingAddressParameters()
      paymentDataRequest.shippingOptionParameters = this.getGoogleDefaultShippingOptions()

      return paymentDataRequest
    },
    getGoogleTransactionInfo () {
      const displayItems = []

      this.totals.forEach(totals => {
        if (totals.code === 'shipping') {
          displayItems.push({
            label: i18n.t('Shipping cost'),
            type: 'LINE_ITEM',
            price: totals.value.toFixed(2)
          })
        } else if (totals.code !== 'grand_total') {
          displayItems.push({
            label: totals.title,
            type: totals.code.toUpperCase(),
            price: totals.value.toFixed(2)
          })
        }
      })

      let totalPrice = 0.00
      displayItems.forEach(displayItem => { totalPrice += parseFloat(displayItem.price) })

      return {
        displayItems,
        currencyCode: 'USD',
        totalPriceStatus: 'FINAL',
        totalPrice: totalPrice.toString(),
        totalPriceLabel: i18n.t('Total')
      }
    },
    calculateNewTransactionInfo (shippingCode) {
      let newTransactionInfo = this.getGoogleTransactionInfo()
      const currentMethod = this.availableShippingMethods ? this.availableShippingMethods.find(item => item.method_code === shippingCode) : {}

      if (currentMethod) {
        this.$bus.$emit('checkout-after-shippingMethodChanged', {
          country: this.shipping.country,
          method_code: currentMethod.method_code,
          carrier_code: currentMethod.carrier_code,
          payment_method: KEY
        })

        const shippingCost = this.getShippingCosts()[shippingCode]

        for (let i = 0; i < newTransactionInfo.displayItems.length; i++) {
          const displayItem = newTransactionInfo.displayItems[i]
          if (displayItem.type === 'LINE_ITEM' && displayItem.label === i18n.t('Shipping cost')) {
            newTransactionInfo.displayItems[i] = {
              type: 'LINE_ITEM',
              label: i18n.t('Shipping cost'),
              price: shippingCost,
              status: 'FINAL'
            }
          }
        }

        let totalPrice = 0.00
        newTransactionInfo.displayItems.forEach(displayItem => { totalPrice += parseFloat(displayItem.price) })
        newTransactionInfo.totalPrice = totalPrice.toString()
      }

      return newTransactionInfo
    },
    getShippingCosts () {
      let shippingCosts = {}

      this.availableShippingMethods.forEach(method => {
        shippingCosts[method.method_code] = method.amount.toFixed(2)
      })

      return shippingCosts
    },
    getGoogleShippingAddressParameters () {
      return {
        allowedCountryCodes: ['US'],
        phoneNumberRequired: true
      }
    },
    getGoogleDefaultShippingOptions () {
      const shippingOptions = []
      let defaultSelectedOptionId = null

      this.availableShippingMethods.forEach(method => {
        shippingOptions.push({
          'id': method.method_code,
          'label': method.method_title
        })

        if (!defaultSelectedOptionId && ((this.shipping && this.shipping.shippingMethod && this.shipping.shippingMethod === method.method_code) || method.default)) {
          defaultSelectedOptionId = method.method_code
        }
      })

      if (!defaultSelectedOptionId && this.availableShippingMethods.length) {
        defaultSelectedOptionId = this.availableShippingMethods[0].method_code
      }

      return {
        defaultSelectedOptionId,
        shippingOptions
      }
    },
    getGoogleUnserviceableAddressError () {
      return {
        reason: 'SHIPPING_ADDRESS_UNSERVICEABLE',
        message: i18n.t('Cannot ship to the selected address'),
        intent: 'SHIPPING_ADDRESS'
      }
    },
    prefetchGooglePaymentData () {
      const paymentDataRequest = this.getGooglePaymentDataRequest()
      paymentDataRequest.transactionInfo = {
        totalPriceStatus: 'NOT_CURRENTLY_KNOWN',
        currencyCode: 'USD'
      }
      this.paymentsClient.prefetchPaymentData(paymentDataRequest)
    },
    onGooglePaymentButtonClicked () {
      this.$emit('click')
      if (this.disabled) {
        return
      }
      const paymentDataRequest = this.getGooglePaymentDataRequest()
      paymentDataRequest.transactionInfo = this.getGoogleTransactionInfo()

      this.$emit('load-payment-data', paymentDataRequest)
      this.paymentsClient.loadPaymentData(paymentDataRequest).then((paymentData) => {
        this.processPayment(paymentData)
      }).catch((err) => {
        console.error(err)
      })
    },
    processPayment (paymentData) {
      console.log('processPayment', paymentData)
      const paymentToken = paymentData.paymentMethodData.tokenizationData.token
      rootStore.commit(KEY + '/' + SET_PAYMENT_TOKEN, paymentToken)
      this.$emit('payment-processed', paymentData)
    },
    updateShippingAddress (shippingAddress) {
      this.country = shippingAddress.countryCode
      this.region = shippingAddress.administrativeArea
      this.city = shippingAddress.locality
      this.postcode = shippingAddress.postalCode
      this.$bus.$emit('checkout-after-shippingDetails', this.shipping)
    }
  }
}
</script>
