'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var compositionApi = require('@vue/composition-api');
var core = require('@vue-storefront/core');

//

const baseRequest = {
  apiVersion: 2,
  apiVersionMinor: 0,
};

const ENV_PROD = "production";

let googlePayScriptLoaded = false;
let paymentsClient = null;
const lineItemsToDisplay = ["subtotal", "tax"];

var script = {
  name: "GooglePayButton",
  props: {
    totals: {
      type: Object,
      required: true,
    },
    type: {
      type: String,
      required: false,
      default: "long",
      validator: function (value) {
        return ["long", "short"].indexOf(value) !== -1;
      },
    },
    color: {
      type: String,
      required: false,
      default: "default",
      validator: function (value) {
        return ["default", "black", "white"].indexOf(value) !== -1;
      },
    },
    disabled: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  head() {
    const skip = googlePayScriptLoaded;
    googlePayScriptLoaded = true;

    return {
      script: [
        {
          vmid: "googlepay",
          once: true,
          skip,
          src: "https://pay.google.com/gp/p/js/pay.js",
          callback: () =>
            window.onGooglePayLoaded && window.onGooglePayLoaded(),
        },
      ],
    };
  },
  setup(props, { emit }) {
    const { $googlepay } = core.useVSFContext();
    const {
      merchantId,
      merchantName,
      gateway,
      gatewayMerchantId,
      allowedCardNetworks,
      allowedAuthMethods,
      currencyCode,
      environment,
    } = $googlepay.config;

    const baseCardPaymentMethod = {
      type: "CARD",
      parameters: {
        allowedAuthMethods,
        allowedCardNetworks,
      },
    };

    const tokenizationSpecification = {
      type: "PAYMENT_GATEWAY",
      parameters: {
        gateway,
        gatewayMerchantId,
      },
    };

    const cardPaymentMethod = Object.assign({}, baseCardPaymentMethod, {
      tokenizationSpecification,
    });

    const lineItems = compositionApi.computed(() => {
      const lineItems = [];

      for (const key in props.totals) {
        if (Object.hasOwnProperty.call(props.totals, key)) {
          const amount = props.totals[key];

          if (key === "shipping") {
            lineItems.push({
              label: "Shipping cost",
              type: "LINE_ITEM",
              price: amount.toFixed(2),
            });
          } else if (lineItemsToDisplay.includes(key)) {
            lineItems.push({
              label: key,
              type: key.toUpperCase(),
              price: amount.toFixed(2),
            });
          }
        }
      }

      return lineItems;
    });
    const total = compositionApi.computed(() => props.totals?.total || 0);
    const buttonRef = compositionApi.ref();

    const getGooglePaymentsClient = () => {
      if (
        paymentsClient === null &&
        window?.google?.payments?.api?.PaymentsClient
      ) {
        paymentsClient = new window.google.payments.api.PaymentsClient({
          environment: environment === ENV_PROD ? "PRODUCTION" : "TEST",
          merchantInfo: {
            merchantName: merchantName,
            merchantId: merchantId,
          },
        });
      }
      return paymentsClient;
    };

    const getGoogleTransactionInfo = () => {
      return {
        displayItems: lineItems.value,
        currencyCode,
        totalPriceStatus: "FINAL",
        totalPrice: total.value.toString(),
        totalPriceLabel: "Total",
      };
    };

    const getGooglePaymentDataRequest = () => {
      const paymentDataRequest = Object.assign({}, baseRequest);
      paymentDataRequest.allowedPaymentMethods = [cardPaymentMethod];
      paymentDataRequest.transactionInfo = getGoogleTransactionInfo();
      paymentDataRequest.merchantInfo = {
        merchantName: merchantName,
      };

      if (environment === ENV_PROD) {
        paymentDataRequest.merchantInfo.merchantId = merchantId;
      }

      return paymentDataRequest;
    };

    const processPayment = (paymentData) => {
      emit("success", paymentData.paymentMethodData);
    };

    const onGooglePaymentButtonClicked = async () => {
      if (props.disabled) {
        return;
      }
      emit("click");
      const paymentDataRequest = getGooglePaymentDataRequest();
      paymentDataRequest.transactionInfo = getGoogleTransactionInfo();

      try {
        const paymentsClient = getGooglePaymentsClient();
        const paymentData = await paymentsClient.loadPaymentData(
          paymentDataRequest
        );
        processPayment(paymentData);
      } catch (err) {
        console.error(err);
      }
    };

    const addGooglePayButton = () => {
      const paymentsClient = getGooglePaymentsClient();
      const button = paymentsClient.createButton({
        onClick: onGooglePaymentButtonClicked,
        buttonColor: props.color,
        buttonType: props.type,
      });
      buttonRef.value.appendChild(button);
    };

    const getGoogleIsReadyToPayRequest = () => {
      return Object.assign({}, baseRequest, {
        allowedPaymentMethods: [baseCardPaymentMethod],
      });
    };

    const prefetchGooglePaymentData = () => {
      const paymentDataRequest = getGooglePaymentDataRequest();
      paymentDataRequest.transactionInfo = {
        totalPriceStatus: "NOT_CURRENTLY_KNOWN",
        currencyCode,
      };
      const paymentsClient = getGooglePaymentsClient();
      paymentsClient.prefetchPaymentData(paymentDataRequest);
    };

    const setupButton = async () => {
      const paymentsClient = getGooglePaymentsClient();
      const isReadyToPayRequest = getGoogleIsReadyToPayRequest();

      try {
        const response = await paymentsClient.isReadyToPay(isReadyToPayRequest);
        if (response.result) {
          addGooglePayButton();
          prefetchGooglePaymentData();
        }
      } catch (err) {
        console.error(err);
      }
    };

    compositionApi.onMounted(() => {
      const paymentsClient = getGooglePaymentsClient();
      if (paymentsClient) {
        setupButton();
      } else {
        window.onGooglePayLoaded = () => {
          setupButton();
          window.onGooglePayLoaded = null;
        };
      }
    });

    return {
      buttonRef,
    };
  },
};

function normalizeComponent(template, style, script, scopeId, isFunctionalTemplate, moduleIdentifier /* server only */, shadowMode, createInjector, createInjectorSSR, createInjectorShadow) {
    if (typeof shadowMode !== 'boolean') {
        createInjectorSSR = createInjector;
        createInjector = shadowMode;
        shadowMode = false;
    }
    // Vue.extend constructor export interop.
    const options = typeof script === 'function' ? script.options : script;
    // render functions
    if (template && template.render) {
        options.render = template.render;
        options.staticRenderFns = template.staticRenderFns;
        options._compiled = true;
        // functional template
        if (isFunctionalTemplate) {
            options.functional = true;
        }
    }
    // scopedId
    if (scopeId) {
        options._scopeId = scopeId;
    }
    let hook;
    if (moduleIdentifier) {
        // server build
        hook = function (context) {
            // 2.3 injection
            context =
                context || // cached call
                    (this.$vnode && this.$vnode.ssrContext) || // stateful
                    (this.parent && this.parent.$vnode && this.parent.$vnode.ssrContext); // functional
            // 2.2 with runInNewContext: true
            if (!context && typeof __VUE_SSR_CONTEXT__ !== 'undefined') {
                context = __VUE_SSR_CONTEXT__;
            }
            // inject component styles
            if (style) {
                style.call(this, createInjectorSSR(context));
            }
            // register component module identifier for async chunk inference
            if (context && context._registeredComponents) {
                context._registeredComponents.add(moduleIdentifier);
            }
        };
        // used by ssr in case component is cached and beforeCreate
        // never gets called
        options._ssrRegister = hook;
    }
    else if (style) {
        hook = shadowMode
            ? function (context) {
                style.call(this, createInjectorShadow(context, this.$root.$options.shadowRoot));
            }
            : function (context) {
                style.call(this, createInjector(context));
            };
    }
    if (hook) {
        if (options.functional) {
            // register for functional component in vue file
            const originalRender = options.render;
            options.render = function renderWithStyleInjection(h, context) {
                hook.call(context);
                return originalRender(h, context);
            };
        }
        else {
            // inject component registration as beforeCreate hook
            const existing = options.beforeCreate;
            options.beforeCreate = existing ? [].concat(existing, hook) : [hook];
        }
    }
    return script;
}

const isOldIE = typeof navigator !== 'undefined' &&
    /msie [6-9]\\b/.test(navigator.userAgent.toLowerCase());
function createInjector(context) {
    return (id, style) => addStyle(id, style);
}
let HEAD;
const styles = {};
function addStyle(id, css) {
    const group = isOldIE ? css.media || 'default' : id;
    const style = styles[group] || (styles[group] = { ids: new Set(), styles: [] });
    if (!style.ids.has(id)) {
        style.ids.add(id);
        let code = css.source;
        if (css.map) {
            // https://developer.chrome.com/devtools/docs/javascript-debugging
            // this makes source maps inside style tags work properly in Chrome
            code += '\n/*# sourceURL=' + css.map.sources[0] + ' */';
            // http://stackoverflow.com/a/26603875
            code +=
                '\n/*# sourceMappingURL=data:application/json;base64,' +
                    btoa(unescape(encodeURIComponent(JSON.stringify(css.map)))) +
                    ' */';
        }
        if (!style.element) {
            style.element = document.createElement('style');
            style.element.type = 'text/css';
            if (css.media)
                style.element.setAttribute('media', css.media);
            if (HEAD === undefined) {
                HEAD = document.head || document.getElementsByTagName('head')[0];
            }
            HEAD.appendChild(style.element);
        }
        if ('styleSheet' in style.element) {
            style.styles.push(code);
            style.element.styleSheet.cssText = style.styles
                .filter(Boolean)
                .join('\n');
        }
        else {
            const index = style.ids.size - 1;
            const textNode = document.createTextNode(code);
            const nodes = style.element.childNodes;
            if (nodes[index])
                style.element.removeChild(nodes[index]);
            if (nodes.length)
                style.element.insertBefore(textNode, nodes[index]);
            else
                style.element.appendChild(textNode);
        }
    }
}

/* script */
const __vue_script__ = script;

/* template */
var __vue_render__ = function() {
  var _vm = this;
  var _h = _vm.$createElement;
  var _c = _vm._self._c || _h;
  return _c("div", { ref: "buttonRef", staticClass: "google-pay-button" })
};
var __vue_staticRenderFns__ = [];
__vue_render__._withStripped = true;

  /* style */
  const __vue_inject_styles__ = function (inject) {
    if (!inject) return
    inject("data-v-586a21e3_0", { source: "\n.google-pay-button {\n  display: flex;\n  overflow: hidden;\n}\n.google-pay-button > div {\n  display: flex;\n  max-width: 100%;\n}\n.google-pay-button button {\n  display: block;\n}\n", map: {"version":3,"sources":["/Users/dmytro/work/aws/focus-next-theme/packages/vsf-google-pay/src/components/GooglePayButton.vue"],"names":[],"mappings":";AA2PA;EACA,aAAA;EACA,gBAAA;AACA;AACA;EACA,aAAA;EACA,eAAA;AACA;AACA;EACA,cAAA;AACA","file":"GooglePayButton.vue","sourcesContent":["<template>\n  <div ref=\"buttonRef\" class=\"google-pay-button\" />\n</template>\n\n<script>\nimport { ref, computed, onMounted } from \"@vue/composition-api\";\nimport { useVSFContext } from \"@vue-storefront/core\";\n\nconst baseRequest = {\n  apiVersion: 2,\n  apiVersionMinor: 0,\n};\n\nconst ENV_PROD = \"production\";\n\nlet googlePayScriptLoaded = false;\nlet paymentsClient = null;\nconst lineItemsToDisplay = [\"subtotal\", \"tax\"];\n\nexport default {\n  name: \"GooglePayButton\",\n  props: {\n    totals: {\n      type: Object,\n      required: true,\n    },\n    type: {\n      type: String,\n      required: false,\n      default: \"long\",\n      validator: function (value) {\n        return [\"long\", \"short\"].indexOf(value) !== -1;\n      },\n    },\n    color: {\n      type: String,\n      required: false,\n      default: \"default\",\n      validator: function (value) {\n        return [\"default\", \"black\", \"white\"].indexOf(value) !== -1;\n      },\n    },\n    disabled: {\n      type: Boolean,\n      required: false,\n      default: false,\n    },\n  },\n  head() {\n    const skip = googlePayScriptLoaded;\n    googlePayScriptLoaded = true;\n\n    return {\n      script: [\n        {\n          vmid: \"googlepay\",\n          once: true,\n          skip,\n          src: \"https://pay.google.com/gp/p/js/pay.js\",\n          callback: () =>\n            window.onGooglePayLoaded && window.onGooglePayLoaded(),\n        },\n      ],\n    };\n  },\n  setup(props, { emit }) {\n    const { $googlepay } = useVSFContext();\n    const {\n      merchantId,\n      merchantName,\n      gateway,\n      gatewayMerchantId,\n      allowedCardNetworks,\n      allowedAuthMethods,\n      currencyCode,\n      environment,\n    } = $googlepay.config;\n\n    const baseCardPaymentMethod = {\n      type: \"CARD\",\n      parameters: {\n        allowedAuthMethods,\n        allowedCardNetworks,\n      },\n    };\n\n    const tokenizationSpecification = {\n      type: \"PAYMENT_GATEWAY\",\n      parameters: {\n        gateway,\n        gatewayMerchantId,\n      },\n    };\n\n    const cardPaymentMethod = Object.assign({}, baseCardPaymentMethod, {\n      tokenizationSpecification,\n    });\n\n    const lineItems = computed(() => {\n      const lineItems = [];\n\n      for (const key in props.totals) {\n        if (Object.hasOwnProperty.call(props.totals, key)) {\n          const amount = props.totals[key];\n\n          if (key === \"shipping\") {\n            lineItems.push({\n              label: \"Shipping cost\",\n              type: \"LINE_ITEM\",\n              price: amount.toFixed(2),\n            });\n          } else if (lineItemsToDisplay.includes(key)) {\n            lineItems.push({\n              label: key,\n              type: key.toUpperCase(),\n              price: amount.toFixed(2),\n            });\n          }\n        }\n      }\n\n      return lineItems;\n    });\n    const total = computed(() => props.totals?.total || 0);\n    const buttonRef = ref();\n\n    const getGooglePaymentsClient = () => {\n      if (\n        paymentsClient === null &&\n        window?.google?.payments?.api?.PaymentsClient\n      ) {\n        paymentsClient = new window.google.payments.api.PaymentsClient({\n          environment: environment === ENV_PROD ? \"PRODUCTION\" : \"TEST\",\n          merchantInfo: {\n            merchantName: merchantName,\n            merchantId: merchantId,\n          },\n        });\n      }\n      return paymentsClient;\n    };\n\n    const getGoogleTransactionInfo = () => {\n      return {\n        displayItems: lineItems.value,\n        currencyCode,\n        totalPriceStatus: \"FINAL\",\n        totalPrice: total.value.toString(),\n        totalPriceLabel: \"Total\",\n      };\n    };\n\n    const getGooglePaymentDataRequest = () => {\n      const paymentDataRequest = Object.assign({}, baseRequest);\n      paymentDataRequest.allowedPaymentMethods = [cardPaymentMethod];\n      paymentDataRequest.transactionInfo = getGoogleTransactionInfo();\n      paymentDataRequest.merchantInfo = {\n        merchantName: merchantName,\n      };\n\n      if (environment === ENV_PROD) {\n        paymentDataRequest.merchantInfo.merchantId = merchantId;\n      }\n\n      return paymentDataRequest;\n    };\n\n    const processPayment = (paymentData) => {\n      emit(\"success\", paymentData.paymentMethodData);\n    };\n\n    const onGooglePaymentButtonClicked = async () => {\n      if (props.disabled) {\n        return;\n      }\n      emit(\"click\");\n      const paymentDataRequest = getGooglePaymentDataRequest();\n      paymentDataRequest.transactionInfo = getGoogleTransactionInfo();\n\n      try {\n        const paymentsClient = getGooglePaymentsClient();\n        const paymentData = await paymentsClient.loadPaymentData(\n          paymentDataRequest\n        );\n        processPayment(paymentData);\n      } catch (err) {\n        console.error(err);\n      }\n    };\n\n    const addGooglePayButton = () => {\n      const paymentsClient = getGooglePaymentsClient();\n      const button = paymentsClient.createButton({\n        onClick: onGooglePaymentButtonClicked,\n        buttonColor: props.color,\n        buttonType: props.type,\n      });\n      buttonRef.value.appendChild(button);\n    };\n\n    const getGoogleIsReadyToPayRequest = () => {\n      return Object.assign({}, baseRequest, {\n        allowedPaymentMethods: [baseCardPaymentMethod],\n      });\n    };\n\n    const prefetchGooglePaymentData = () => {\n      const paymentDataRequest = getGooglePaymentDataRequest();\n      paymentDataRequest.transactionInfo = {\n        totalPriceStatus: \"NOT_CURRENTLY_KNOWN\",\n        currencyCode,\n      };\n      const paymentsClient = getGooglePaymentsClient();\n      paymentsClient.prefetchPaymentData(paymentDataRequest);\n    };\n\n    const setupButton = async () => {\n      const paymentsClient = getGooglePaymentsClient();\n      const isReadyToPayRequest = getGoogleIsReadyToPayRequest();\n\n      try {\n        const response = await paymentsClient.isReadyToPay(isReadyToPayRequest);\n        if (response.result) {\n          addGooglePayButton();\n          prefetchGooglePaymentData();\n        }\n      } catch (err) {\n        console.error(err);\n      }\n    };\n\n    onMounted(() => {\n      const paymentsClient = getGooglePaymentsClient();\n      if (paymentsClient) {\n        setupButton();\n      } else {\n        window.onGooglePayLoaded = () => {\n          setupButton();\n          window.onGooglePayLoaded = null;\n        };\n      }\n    });\n\n    return {\n      buttonRef,\n    };\n  },\n};\n</script>\n\n<style>\n.google-pay-button {\n  display: flex;\n  overflow: hidden;\n}\n.google-pay-button > div {\n  display: flex;\n  max-width: 100%;\n}\n.google-pay-button button {\n  display: block;\n}\n</style>\n"]}, media: undefined });

  };
  /* scoped */
  const __vue_scope_id__ = undefined;
  /* module identifier */
  const __vue_module_identifier__ = undefined;
  /* functional template */
  const __vue_is_functional_template__ = false;
  /* style inject SSR */
  
  /* style inject shadow dom */
  

  
  const __vue_component__ = /*#__PURE__*/normalizeComponent(
    { render: __vue_render__, staticRenderFns: __vue_staticRenderFns__ },
    __vue_inject_styles__,
    __vue_script__,
    __vue_scope_id__,
    __vue_is_functional_template__,
    __vue_module_identifier__,
    false,
    createInjector,
    undefined,
    undefined
  );

exports.GooglePayButton = __vue_component__;
//# sourceMappingURL=index.js.map
