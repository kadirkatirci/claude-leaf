/**
 * Analytics helper (content script side)
 * Sends whitelisted analytics events to the background service worker.
 */

const MESSAGE_TYPE = 'ANALYTICS_EVENT';

function getPageType() {
  try {
    const state = window.__navigationInterceptor?.getState?.();
    if (state?.pageType) {
      return state.pageType;
    }
    if (state?.isConversationPage) {
      return 'conversation';
    }
  } catch {
    // ignore
  }
  return 'other';
}

function buildParams(params = {}) {
  const pageType = getPageType();
  return {
    page_type: pageType,
    ...params,
  };
}

export function trackEvent(name, params = {}) {
  try {
    chrome.runtime.sendMessage(
      {
        type: MESSAGE_TYPE,
        name,
        params: buildParams(params),
      },
      () => {
        // Swallow errors (e.g., if background is unavailable during reload)
        void chrome.runtime.lastError;
      }
    );
  } catch {
    // Ignore analytics failures
  }
}
