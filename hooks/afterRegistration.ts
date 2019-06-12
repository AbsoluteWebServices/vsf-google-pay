import { KEY } from '../index'
import { SET_READY } from '../store/mutation-types'

export function afterRegistration({ Vue, config, store, isServer }) {
  let correctPaymentMethod = false

  const placeOrder = () => {
    if (correctPaymentMethod) {
      const paymentToken = store.state[KEY].paymentToken
      if (paymentToken) {
        Vue.prototype.$bus.$emit('checkout-do-placeOrder', {
          paymentToken
        })
      }
    }
  }

  // Update the methods
  let paymentMethodConfig = {
    'title': 'Google Pay',
    'code': KEY,
    'cost': 0,
    'costInclTax': 0,
    'default': true,
    'offline': false,
    'is_server_method': false
  }
  store.dispatch('payment/addMethod', paymentMethodConfig)

  if (!isServer) {
    let jsUrl = 'https://pay.google.com/gp/p/js/pay.js'
    let docHead = document.getElementsByTagName('head')[0]
    let docScript = document.createElement('script')
    docScript.type = 'text/javascript'
    docScript.src = jsUrl
    docScript.async = true
    docScript.onload = () => {
      store.commit(KEY + '/' + SET_READY, true)
      Vue.prototype.$bus.$emit(KEY + '-ready')
    }
    docHead.appendChild(docScript)

    Vue.prototype.$bus.$on('checkout-before-placeOrder', placeOrder)

    Vue.prototype.$bus.$on('checkout-payment-method-changed', (paymentMethodCode) => {
      if (paymentMethodCode === KEY) {
        correctPaymentMethod = true
      } else {
        correctPaymentMethod = false
      }
    })
  }
}
