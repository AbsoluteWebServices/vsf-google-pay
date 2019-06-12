# Vue Storefront Google Pay Payment Extension

The Google Pay Payment module for [vue-storefront](https://github.com/DivanteLtd/vue-storefront).

## Installation

By hand (preferer):

```shell
git clone git@github.com:AbsoluteWebServices/vsf-google-pay.git ./vue-storefront/src/modules/
```

Registration the GooglePay module. Go to `./vue-storefront/src/modules/index.ts`

```js
...
import { GooglePay } from './vsf-google-pay';

export const registerModules: VueStorefrontModule[] = [
  ...
  GooglePay
]
```

Add following settings to your config file.
Read more about `tokenizationSpecification` at [developers.google.com](https://developers.google.com/pay/api/web/reference/object#PaymentMethodTokenizationSpecification)

```json
  "googlePay": {
    "environment": "TEST", // "PRODUCTION"
    "tokenizationSpecification": {
      "type": "PAYMENT_GATEWAY",
      "parameters": {
        "gateway": "example",
        "gatewayMerchantId": "exampleGatewayMerchantId"
      }
    },
    "merchantId": "exampleGoogleMerchantId",
    "merchantName": "Example merchant name",
    "allowedCardNetworks": ["AMEX", "DISCOVER", "INTERAC", "JCB", "MASTERCARD", "VISA"],
    "allowedCardAuthMethods": ["PAN_ONLY", "CRYPTOGRAM_3DS"]
  },
```

Add Google Pay button to checkout page. It is recommended to replace "Place order" button with Google Pay button when Google Pay selected as payment method. 

```
...
import GooglePayButton from 'src/modules/vsf-google-pay/components/GooglePayButton'

export default {
  ...
  components: {
    ...
    GooglePayButton
  },
  ...
}
```

```html
<google-pay-button
  v-if="paymentMethod == 'googlePay'"
  @payment-processed="placeOrder"
/>
```