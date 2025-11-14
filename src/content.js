/**
 * Claude Productivity Extension - Content Script Entry
 * Messaging-based loader
 */

// INTERCEPT HISTORY API IMMEDIATELY (before Claude.ai can override it)
// This must run BEFORE anything else
console.log('🔧 Intercepting history API early...');
const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;
let currentUrl = window.location.href;
let navigationCallback = null;

// Store original methods
window.__originalPushState = originalPushState;
window.__originalReplaceState = originalReplaceState;

history.pushState = function(...args) {
  console.log('🔀 [EARLY] pushState intercepted', args[2]); // args[2] is the URL
  originalPushState.apply(this, args);

  if (navigationCallback) {
    navigationCallback();
  }
};

history.replaceState = function(...args) {
  console.log('🔀 [EARLY] replaceState intercepted', args[2]);
  originalReplaceState.apply(this, args);

  if (navigationCallback) {
    navigationCallback();
  }
};

window.addEventListener('popstate', () => {
  console.log('🔙 [EARLY] popstate event');
  if (navigationCallback) {
    navigationCallback();
  }
});

console.log('✅ History API intercepted early');

// Navigation restart utilities
let restartTimeout = null;
let restartInProgress = false;

/**
 * Wait for DOM to be ready for module initialization
 * Checks for message containers and ensures Claude's UI is loaded
 */
async function waitForDOMReady(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    // Check if Claude's main content area exists
    const messagesContainer = document.querySelector('[data-testid="messages"]')
      || document.querySelector('.messages')
      || document.querySelector('main');

    if (messagesContainer) {
      console.log('✅ DOM ready: message container found');
      return true;
    }

    // Wait 100ms before next check
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.warn('⚠️ DOM not fully ready after 3 seconds, proceeding anyway');
  return false;
}

/**
 * Debounce function to prevent rapid navigation restarts
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Handle navigation with debouncing and DOM ready checks
 */
const handleNavigation = debounce(async () => {
  const newUrl = window.location.href;
  if (newUrl === currentUrl) {
    return;
  }

  console.log(`🔄 Navigation detected: ${currentUrl} → ${newUrl}`);
  currentUrl = newUrl;

  // Cancel any pending restart
  if (restartTimeout) {
    clearTimeout(restartTimeout);
    console.log('⏸️ Cancelled previous restart due to new navigation');
  }

  // Don't restart if one is already in progress
  if (restartInProgress) {
    console.log('⏸️ Restart already in progress, skipping');
    return;
  }

  // Wait for DOM to be ready instead of using arbitrary delay
  console.log('⏳ Waiting for DOM to be ready...');
  await waitForDOMReady();

  restartInProgress = true;
  try {
    console.log('🔄 Restarting app after navigation...');
    await window.claudeProductivity?.restart?.();
    console.log('✅ App restarted successfully');
  } catch (error) {
    console.error('❌ Failed to restart app:', error);
  } finally {
    restartInProgress = false;
  }
}, 300); // Debounce 300ms to prevent rapid restarts

console.log('✅ Navigation utilities initialized');

(async () => {
  try {
    console.log('🎯 Claude Productivity Extension loading...');

    // URL check
    if (!window.location.hostname.includes('claude.ai')) {
      console.log('⏸️ Not on claude.ai, extension inactive');
      return;
    }

    // CRITICAL: Wait for DOM BEFORE importing modules
    // This ensures modules don't try to access DOM elements that don't exist yet
    console.log('⏳ Waiting for DOM to be ready before loading modules...');
    await waitForDOMReady();

    // Now safe to import App.js which may access DOM during module loading
    console.log('📦 Loading extension modules...');
    const { default: app } = await import('./App.js');

    // Set up the callback for navigation detection
    navigationCallback = handleNavigation;

    // Initialize the app (DOM is already ready)
    console.log('🚀 Initializing Claude Productivity Extension...');
    await app.init();

    console.log('✅ Claude Productivity Extension ready!');
    console.log('💡 Tip: Access extension via window.claudeProductivity');

  } catch (error) {
    console.error('❌ Claude Productivity Extension failed to initialize:', error);
    console.error('Stack:', error.stack);
  }
})();
