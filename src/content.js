/**
 * Claude Productivity Extension - Content Script Entry
 *
 * CRITICAL: NavigationInterceptor MUST be imported and initialized FIRST.
 * It sets up window.__navigationInterceptor which other modules depend on.
 */

// STEP 1: Import and initialize NavigationInterceptor FIRST
// This MUST happen before any other imports that might use it
import navigationInterceptor from './core/NavigationInterceptor.js';
import { DEBUG, debugLog } from './config/debug.js';

// Verify NavigationInterceptor is on window (critical for module communication)
if (!window.__navigationInterceptor) {
  console.error('[content] NavigationInterceptor not on window - modules may fail');
}

debugLog('navigation', 'Initial state:', navigationInterceptor.getState());

// STEP 2: Now import DOMReadyChecker (it may use NavigationInterceptor)
import domReadyChecker from './utils/DOMReadyChecker.js';

/**
 * Main initialization function
 */
async function initializeExtension() {
  try {
    // Check if we're on claude.ai
    if (!window.location.hostname.includes('claude.ai')) {
      debugLog('navigation', 'Not on claude.ai, extension inactive');
      return;
    }

    const navState = navigationInterceptor.getState();
    debugLog('navigation', `Page: ${navState.pageType} (${navState.path})`);

    // Wait for DOM based on page type
    let isReady = false;

    if (navState.isConversationPage) {
      isReady = await domReadyChecker.waitForConversationReady({
        maxWait: 5000,
        requireMessages: false,
      });
    } else {
      isReady = await domReadyChecker.waitForReady({ maxWait: 2000 });
    }

    debugLog('navigation', `DOM ready: ${isReady}`);

    // Import and initialize App
    const { default: app } = await import('./App.js');
    await app.init();

    if (DEBUG) {
      console.log('[content] Extension ready. Debug commands:');
      console.log('  - window.claudeProductivity.verifyArchitecture()');
      console.log('  - window.__navigationInterceptor.getState()');
      console.log('  - window.__visibilityManager.getStatus()');
    }
  } catch (error) {
    console.error('[content] Initialization failed:', error);

    // Debug info only in debug mode
    if (DEBUG) {
      console.error('[content] Debug info:', {
        hasNavigationInterceptor: !!window.__navigationInterceptor,
        navState: window.__navigationInterceptor?.getState(),
        hasMain: !!document.querySelector('main'),
        path: window.location.pathname,
      });
    }
  }
}

// Start initialization
initializeExtension();
