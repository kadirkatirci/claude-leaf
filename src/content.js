/**
 * Claude Productivity Extension - Content Script Entry
 * 
 * v2.2.0 - Fixed initialization order
 * 
 * CRITICAL: NavigationInterceptor MUST be imported and initialized FIRST.
 * It sets up window.__navigationInterceptor which other modules depend on.
 */

console.log('🔧 Claude Productivity Extension: Entry point loading...');

// STEP 1: Import and initialize NavigationInterceptor FIRST
// This MUST happen before any other imports that might use it
import navigationInterceptor from './core/NavigationInterceptor.js';

// Verify it's on window
if (!window.__navigationInterceptor) {
  console.error('❌ NavigationInterceptor not on window!');
} else {
  console.log('✅ NavigationInterceptor ready on window');
}

// Log initial state
const initialState = navigationInterceptor.getState();
console.log('📍 Initial navigation state:', initialState);

// STEP 2: Now import DOMReadyChecker (it may use NavigationInterceptor)
import domReadyChecker from './utils/DOMReadyChecker.js';

/**
 * Main initialization function
 */
async function initializeExtension() {
  try {
    console.log('🎯 Claude Productivity Extension initializing...');

    // Check if we're on claude.ai
    if (!window.location.hostname.includes('claude.ai')) {
      console.log('⏸️ Not on claude.ai, extension inactive');
      return;
    }

    // Get current navigation state
    const navState = navigationInterceptor.getState();
    console.log(`📍 Current page: ${navState.pageType} (${navState.path})`);
    console.log(`  - Is conversation: ${navState.isConversationPage}`);
    console.log(`  - Is new chat: ${navState.isNewChatPage}`);

    // Wait for DOM based on page type
    console.log('⏳ Waiting for DOM...');
    
    let isReady = false;
    
    if (navState.isConversationPage) {
      console.log('  - Waiting for conversation DOM...');
      isReady = await domReadyChecker.waitForConversationReady({ 
        maxWait: 5000,
        requireMessages: false 
      });
    } else if (navState.isNewChatPage) {
      console.log('  - On /new page, waiting for basic DOM...');
      isReady = await domReadyChecker.waitForReady({ maxWait: 2000 });
    } else {
      console.log('  - Other page, waiting for basic DOM...');
      isReady = await domReadyChecker.waitForReady({ maxWait: 2000 });
    }

    console.log(`  - DOM ready: ${isReady}`);

    // Import and initialize App
    console.log('📦 Loading App module...');
    const { default: app } = await import('./App.js');

    console.log('🚀 Initializing App...');
    await app.init();

    console.log('✅ Claude Productivity Extension ready!');
    console.log('💡 Debug commands:');
    console.log('  - window.claudeProductivity.verifyArchitecture()');
    console.log('  - window.__navigationInterceptor.getState()');
    console.log('  - window.__visibilityManager.getStatus()');

  } catch (error) {
    console.error('❌ Extension initialization failed:', error);
    console.error('Stack:', error.stack);
    
    // Debug info
    try {
      console.error('Debug info:', {
        hasNavigationInterceptor: !!window.__navigationInterceptor,
        navState: window.__navigationInterceptor?.getState(),
        hasMain: !!document.querySelector('main'),
        path: window.location.pathname
      });
    } catch (e) {
      console.error('Could not get debug info:', e);
    }
  }
}

// Start initialization
initializeExtension();
