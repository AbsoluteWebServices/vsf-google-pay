import { integrationPlugin } from '@absolute-web/vsf-core'

const moduleOptions = JSON.parse('<%= JSON.stringify(options) %>');

const defaultConfig = {
  currencyCode: 'USD',
  allowedCardNetworks: [
    'AMEX',
    'DISCOVER',
    'INTERAC',
    'JCB',
    'MASTERCARD',
    'VISA',
  ],
  allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
  environment: 'TEST'
};

export default integrationPlugin(({ app, integration }) => {
  const settings = {
    ...defaultConfig,
    ...moduleOptions,
  };

  integration.configure('googlepay', settings);
});
