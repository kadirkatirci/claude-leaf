/**
 * Analytics helper (content script side)
 * Sends whitelisted analytics events to the background service worker.
 */

const MESSAGE_TYPE = 'ANALYTICS_EVENT';
const perfScanLastSent = new Map();
let cachedBrowserContext = null;

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

function getBrowserContext() {
  if (cachedBrowserContext) {
    return cachedBrowserContext;
  }

  const ua = navigator.userAgent;

  // Parse browser
  let browserName = 'unknown';
  let browserVersion = 'unknown';

  if (ua.includes('Chrome/') && !ua.includes('Edg/')) {
    browserName = 'chrome';
    const match = ua.match(/Chrome\/(\d+)/);
    browserVersion = match ? match[1] : 'unknown';
  } else if (ua.includes('Edg/')) {
    browserName = 'edge';
    const match = ua.match(/Edg\/(\d+)/);
    browserVersion = match ? match[1] : 'unknown';
  } else if (ua.includes('Firefox/')) {
    browserName = 'firefox';
    const match = ua.match(/Firefox\/(\d+)/);
    browserVersion = match ? match[1] : 'unknown';
  }

  // Parse OS
  let osName = 'unknown';
  if (ua.includes('Windows')) {
    osName = 'windows';
  } else if (ua.includes('Mac')) {
    osName = 'macos';
  } else if (ua.includes('Linux')) {
    osName = 'linux';
  }

  cachedBrowserContext = {
    browser_name: browserName,
    browser_version: browserVersion,
    os_name: osName,
  };

  return cachedBrowserContext;
}

function buildParams(params = {}) {
  const pageType = getPageType();
  const context = getBrowserContext();

  return {
    page_type: pageType,
    ...context,
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

/**
 * Track an error event
 * @param {Object} error - Error object or message
 * @param {Object} context - Additional context { module, method, type, fatal }
 */
export function trackError(error, context = {}) {
  try {
    const message = error?.message || String(error);
    const stack = error?.stack || '';

    trackEvent('error_occurred', {
      module: context.module || 'unknown',
      method: context.method || 'unknown',
      error_type: context.type || 'runtime_error',
      error_message: message.substring(0, 200),
      error_stack: stack.substring(0, 500).replace(/\n/g, '|'),
      fatal: context.fatal ? 1 : 0,
    });
  } catch {
    // Swallow errors in error tracking to prevent infinite loops
  }
}

/**
 * Track a funnel step
 * @param {string} funnelName - Name of the funnel (e.g., 'bookmark_creation')
 * @param {number} stepNumber - Step number (1-indexed)
 * @param {string} stepName - Step name (e.g., 'open_picker')
 * @param {string} status - 'started', 'completed', 'abandoned'
 * @param {Object} additionalParams - Extra parameters
 */
export function trackFunnelStep(funnelName, stepNumber, stepName, status, additionalParams = {}) {
  try {
    trackEvent('funnel_step', {
      funnel_name: funnelName,
      step_number: stepNumber,
      step_name: stepName,
      step_status: status,
      ...additionalParams,
    });
  } catch {
    // Swallow errors
  }
}
