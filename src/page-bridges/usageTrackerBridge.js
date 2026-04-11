(function installUsageTrackerBridge() {
  const REQUEST_EVENT_NAME = 'cl-leaf-usage-tracker:request';
  const RESPONSE_EVENT_NAME = 'cl-leaf-usage-tracker:response';
  const LIMIT_EVENT_NAME = 'cl-leaf-usage-tracker:limit';

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
      dispatch(RESPONSE_EVENT_NAME, {
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

      dispatch(RESPONSE_EVENT_NAME, {
        requestId,
        ok: true,
        payload,
      });
    } catch (error) {
      dispatch(RESPONSE_EVENT_NAME, {
        requestId,
        ok: false,
        error: error?.message || 'usage_fetch_failed',
      });
    }
  }

  window.addEventListener(REQUEST_EVENT_NAME, event => {
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
              dispatch(LIMIT_EVENT_NAME, { payload });
            }
          })
          .catch(() => {});
      }
    } catch {
      // Ignore bridge parsing failures to avoid affecting Claude.
    }

    return response;
  };
})();
