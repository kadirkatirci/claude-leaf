import { USAGE_BRIDGE_SCRIPT_PATH, USAGE_EVENT_NAMES } from './constants.js';

const BRIDGE_TIMEOUT_MS = 8000;

export default class UsageBridge {
  constructor() {
    this.injected = false;
    this.injectPromise = null;
    this.requestCounter = 0;
    this.scriptId = 'cl-leaf-usage-tracker-bridge';
  }

  ensureInjected() {
    if (this.injected) {
      return Promise.resolve();
    }

    if (window.__clLeafUsageTrackerBridgeInstalled) {
      this.injected = true;
      return Promise.resolve();
    }

    if (this.injectPromise) {
      return this.injectPromise;
    }

    const runtimeGetUrl = globalThis.chrome?.runtime?.getURL;
    if (typeof runtimeGetUrl !== 'function') {
      return Promise.reject(new Error('usage_bridge_runtime_url_unavailable'));
    }

    const existingScript = document.getElementById(this.scriptId);
    if (existingScript) {
      this.injectPromise = new Promise((resolve, reject) => {
        existingScript.addEventListener(
          'load',
          () => {
            this.injected = true;
            this.injectPromise = null;
            resolve();
          },
          { once: true }
        );
        existingScript.addEventListener(
          'error',
          () => {
            this.injectPromise = null;
            reject(new Error('usage_bridge_load_failed'));
          },
          { once: true }
        );
      });
      return this.injectPromise;
    }

    this.injectPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.id = this.scriptId;
      script.src = runtimeGetUrl(USAGE_BRIDGE_SCRIPT_PATH);
      script.async = false;
      script.onload = () => {
        this.injected = true;
        this.injectPromise = null;
        script.remove();
        resolve();
      };
      script.onerror = () => {
        this.injectPromise = null;
        script.remove();
        reject(new Error('usage_bridge_load_failed'));
      };
      (document.head || document.documentElement || document.body).appendChild(script);
    });

    return this.injectPromise;
  }

  requestUsage(orgUuid) {
    return this.ensureInjected().then(
      () =>
        new Promise((resolve, reject) => {
          const requestId = `usage-${Date.now()}-${this.requestCounter++}`;
          let timeoutId = null;

          const handleResponse = event => {
            if (event?.detail?.requestId !== requestId) {
              return;
            }

            cleanup();

            if (event.detail.ok) {
              resolve(event.detail.payload);
              return;
            }

            reject(new Error(event.detail.error || 'usage_bridge_failed'));
          };

          function cleanup() {
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
            window.removeEventListener(USAGE_EVENT_NAMES.RESPONSE, handleResponse);
          }

          timeoutId = window.setTimeout(() => {
            cleanup();
            reject(new Error('usage_bridge_timeout'));
          }, BRIDGE_TIMEOUT_MS);

          window.addEventListener(USAGE_EVENT_NAMES.RESPONSE, handleResponse);
          window.dispatchEvent(
            new CustomEvent(USAGE_EVENT_NAMES.REQUEST, {
              detail: {
                type: 'fetchUsage',
                requestId,
                orgUuid,
              },
            })
          );
        })
    );
  }
}
