import { VueStorefrontModule, VueStorefrontModuleConfig } from '@vue-storefront/core/lib/module'
import { afterRegistration } from './hooks/afterRegistration'
import { module } from './store'

export const KEY = 'googlePay'

const moduleConfig: VueStorefrontModuleConfig = {
  key: KEY,
  store: { modules: [{ key: KEY, module }] },
  afterRegistration
}

export const GooglePay = new VueStorefrontModule(moduleConfig)
