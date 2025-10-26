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

(async () => {
  try {
    console.log('🎯 Claude Productivity Extension yükleniyor...');

    // URL kontrolü
    if (!window.location.hostname.includes('claude.ai')) {
      console.log('⏸️ Claude.ai olmayan bir sitede, extension pasif');
      return;
    }

    // Doğrudan import et (content script context'te)
    const { default: app } = await import('./App.js');

    // Set up the callback for navigation detection
    navigationCallback = () => {
      const newUrl = window.location.href;
      if (newUrl !== currentUrl) {
        console.log(`🔄 [EARLY] Navigation detected: ${currentUrl} → ${newUrl}`);
        currentUrl = newUrl;

        // Restart app after navigation
        setTimeout(async () => {
          console.log('🔄 Restarting app after navigation...');
          await app.restart();
          console.log('✅ App restarted');
        }, 1000);
      }
    };

    await app.init();

    console.log('✅ Claude Productivity Extension hazır!');
    console.log('💡 İpucu: window.claudeProductivity ile extension\'a erişebilirsiniz');

  } catch (error) {
    console.error('❌ Claude Productivity Extension başlatılamadı:', error);
    console.error('Detay:', error.stack);
  }
})();
