// Popup analytics helper - sends events to background service worker

(() => {
  const MESSAGE_TYPE = 'ANALYTICS_EVENT';

  const sendEvent = (name, params = {}) => {
    try {
      chrome.runtime.sendMessage(
        {
          type: MESSAGE_TYPE,
          name,
          params: {
            page_type: 'popup',
            ...params,
          },
        },
        () => {
          void chrome.runtime.lastError;
        }
      );
    } catch {
      // Ignore analytics failures
    }
  };

  window.PopupAnalytics = { trackEvent: sendEvent };
})();
