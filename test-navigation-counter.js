/**
 * Navigation Counter Test Script
 *
 * This script tests navigation counter robustness in different scenarios.
 * Run this in the browser console after loading the extension.
 */

(function testNavigationCounter() {
  console.log('🧭 === NAVIGATION COUNTER TEST ===');
  console.log('Current URL:', window.location.href);

  const app = window.claudeProductivity;
  if (!app) {
    console.error('❌ Extension not loaded');
    return;
  }

  const navigation = app.getModule('navigation');
  if (!navigation) {
    console.error('❌ NavigationModule not found');
    return;
  }

  console.log('\n📊 NavigationModule State:');
  console.log('  - Messages:', navigation.messages.length);
  console.log('  - Current index:', navigation.currentIndex);
  console.log('  - Has initial load completed:', navigation.hasInitialLoadCompleted);
  console.log('  - Last conversation state:', navigation.lastConversationState);
  console.log('  - Last counter text:', navigation.lastCounterText);

  // Check counter element
  const counterEl = document.querySelector('#claude-nav-counter');
  if (counterEl) {
    console.log('  - Counter display:', counterEl.textContent);
  } else {
    console.log('  - Counter element: NOT FOUND');
  }

  // Compare with other module counters
  console.log('\n🔢 Counter Comparison:');
  const modules = {
    navigation: app.getModule('navigation'),
    bookmarks: app.getModule('bookmarks'),
    emojiMarkers: app.getModule('emojiMarkers'),
    editHistory: app.getModule('editHistory')
  };

  const counters = {
    navigation: document.querySelector('#claude-nav-counter'),
    bookmarks: document.querySelector('#claude-bookmarks-fixed-btn .claude-counter-badge'),
    emojiMarkers: document.querySelector('#claude-marker-fixed-btn .claude-counter-badge'),
    editHistory: document.querySelector('#claude-edit-fixed-btn .claude-counter-badge')
  };

  Object.entries(counters).forEach(([name, el]) => {
    console.log(`  - ${name}: ${el ? el.textContent : 'NOT FOUND'}`);
  });

  // Test scenarios
  console.log('\n🧪 Test Scenarios:');
  console.log('1. Chat Transition Test:');
  console.log('   - Navigate from homepage to chat');
  console.log('   - Expected: Navigation counter resets to 0/0 immediately, then updates');
  console.log('   - Check: All counters should behave consistently');

  console.log('\n2. Scroll Position Tracking:');
  console.log('   - Scroll manually through messages');
  console.log('   - Expected: Counter updates within 300ms to show current position');
  console.log('   - Check: currentIndex should cache the position');

  console.log('\n3. Navigation Button Test:');
  console.log('   - Click Top button');
  console.log('   - Expected: Counter shows 1/N immediately');
  console.log('   - Click Prev/Next buttons');
  console.log('   - Expected: Counter updates immediately');

  console.log('\n4. Panel Navigation Test:');
  console.log('   - Navigate via bookmark/marker/edit panels');
  console.log('   - Expected: Navigation counter updates to show correct position');

  // Monitor methods
  console.log('\n🔍 Debug Methods:');
  console.log('navigation.updateUI() - Force update UI');
  console.log('navigation.clearUIElements() - Clear and reset counter');
  console.log('navigation.updateCounter() - Update counter display');
  console.log('navigation.currentIndex - Check cached index value');

  // Live monitoring
  console.log('\n📈 Live Monitoring:');
  const startMonitoring = () => {
    const interval = setInterval(() => {
      const nav = app.getModule('navigation');
      const counter = document.querySelector('#claude-nav-counter');
      console.log(`[Monitor] Index: ${nav.currentIndex}, Counter: ${counter?.textContent}, Messages: ${nav.messages.length}`);
    }, 1000);

    setTimeout(() => {
      clearInterval(interval);
      console.log('[Monitor] Stopped');
    }, 10000);
  };

  console.log('Run startMonitoring() to monitor counter for 10 seconds');
  window.startMonitoring = startMonitoring;

  console.log('\n✅ === TEST COMPLETE ===');
  console.log('Try the scenarios above and watch for:');
  console.log('  - Immediate counter reset on chat change (0/0)');
  console.log('  - Accurate scroll position tracking');
  console.log('  - No lag or stale values');
  console.log('  - Consistent behavior with other module counters');
})();