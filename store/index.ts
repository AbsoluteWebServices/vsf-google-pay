import { Module } from 'vuex'
import { GooglePayState } from '../types/GooglePayState'
import { mutations } from './mutations'
import { getters } from './getters'
import { actions } from './actions'
import { state } from './state'

export const module: Module<GooglePayState, any> = {
    namespaced: true,
    mutations,
    actions,
    getters,
    state
}
