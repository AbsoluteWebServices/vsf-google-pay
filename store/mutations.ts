import { GooglePayState } from '../types/GooglePayState'
import { MutationTree } from 'vuex'
import * as types from './mutation-types'

export const mutations: MutationTree<GooglePayState> = {
  [types.SET_READY] (state, ready) {
    state.ready = ready
  },
  [types.SET_PAYMENT_TOKEN] (state, paymentToken) {
    state.paymentToken = paymentToken
  }
}
