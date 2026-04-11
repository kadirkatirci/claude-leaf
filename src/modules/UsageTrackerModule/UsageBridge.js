import { USAGE_EVENT_NAMES } from './constants.js';

const BRIDGE_TIMEOUT_MS = 8000;

function installUsageTrackerBridge(requestEventName, responseEventName, limitEventName) {
  if (window.__clLeafUsageTrackerBridgeInstalled) {
    return;
  }

  window.__clLeafUsageTrackerBridgeInstalled = true;

  const originalFetch = window.fetch.bind(window);

  function dispatch(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }

  function parseMessageLimitPayload(streamText) {
    if (typeof streamText !== 'string' || !streamText.includes('event: message_limit')) {
      return null;
    }

    const lines = streamText.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      if (!/^event:\s*message_limit\s*$/.test(lines[index])) {
        continue;
      }

      const dataLine = lines[index + 1] || '';
      if (!/^data:\s*/.test(dataLine)) {
        continue;
      }

      try {
        return JSON.parse(dataLine.replace(/^data:\s*/, ''));
      } catch {
        return null;
      }
    }

    return null;
  }

  async function handleUsageRequest(detail) {
    const requestId = detail?.requestId;
    const orgUuid = detail?.orgUuid;

    if (!requestId || !orgUuid) {
      dispatch(responseEventName, {
        requestId,
        ok: false,
        error: 'missing_usage_request_data',
      });
      return;
    }

    try {
      const response = await originalFetch(
        `/api/organizations/${encodeURIComponent(orgUuid)}/usage`,
        {
          credentials: 'include',
          headers: {
            accept: 'application/json',
          },
        }
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(`usage_fetch_failed_${response.status}`);
      }

      dispatch(responseEventName, {
        requestId,
        ok: true,
        payload,
      });
    } catch (error) {
      dispatch(responseEventName, {
        requestId,
        ok: false,
        error: error?.message || 'usage_fetch_failed',
      });
    }
  }

  window.addEventListener(requestEventName, event => {
    if (event?.detail?.type === 'fetchUsage') {
      void handleUsageRequest(event.detail);
    }
  });

  window.fetch = async (...args) => {
    const response = await originalFetch(...args);

    try {
      const request = args[0] instanceof Request ? args[0] : null;
      const requestUrl = request ? request.url : String(args[0] || '');
      const requestMethod = request ? request.method : String(args[1]?.method || 'GET');

      if (
        requestMethod.toUpperCase() === 'POST' &&
        /\/api\/organizations\/[^/]+\/chat_conversations\/[^/]+\/completion(?:\?|$)/.test(
          requestUrl
        )
      ) {
        void response
          .clone()
          .text()
          .then(streamText => {
            const payload = parseMessageLimitPayload(streamText);
            if (payload) {
              dispatch(limitEventName, { payload });
            }
          })
          .catch(() => {});
      }
    } catch {
      // Ignore bridge parsing failures to avoid affecting Claude.
    }

    return response;
  };
}

export default class UsageBridge {
  constructor() {
    this.injected = false;
    this.requestCounter = 0;
  }

  ensureInjected() {
    if (this.injected) {
      return;
    }

    const script = document.createElement('script');
    script.textContent = `(${installUsageTrackerBridge.toString()})(${JSON.stringify(USAGE_EVENT_NAMES.REQUEST)}, ${JSON.stringify(USAGE_EVENT_NAMES.RESPONSE)}, ${JSON.stringify(USAGE_EVENT_NAMES.LIMIT_UPDATE)});`;
    (document.head || document.documentElement || document.body).appendChild(script);
    script.remove();
    this.injected = true;
  }

  requestUsage(orgUuid) {
    this.ensureInjected();

    return new Promise((resolve, reject) => {
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
    });
  }
}
