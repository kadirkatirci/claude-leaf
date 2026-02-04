/**
 * Analytics helper (content script side)
 * Sends whitelisted analytics events to the background service worker.
 */

const MESSAGE_TYPE = 'ANALYTICS_EVENT';
const perfScanLastSent = new Map();

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

export function trackPerfScan(params = {}, { key, minIntervalMs = 5000 } = {}) {
  const now = Date.now();
  const mapKey = key || `${params.module || 'unknown'}:${params.method || 'unknown'}`;
  const last = perfScanLastSent.get(mapKey);
  if (last && now - last < minIntervalMs) {
    return;
  }
  perfScanLastSent.set(mapKey, now);
  trackEvent('perf_scan', params);
}
