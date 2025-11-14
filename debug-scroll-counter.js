/**
 * Debug Scroll Counter Test
 *
 * This script helps debug why the navigation counter doesn't update during scroll.
 * Run this in the browser console after loading the extension.
 */

(function debugScrollCounter() {
  console.log('🔍 === SCROLL COUNTER DEBUG TEST ===');
  console.log('Check console for [NAV SCROLL] and [NAV UPDATE COUNTER] logs while scrolling');

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

  console.log('\n📊 Initial State:');
  console.log('  - Messages array:', navigation.messages);
  console.log('  - Messages length:', navigation.messages.length);
  console.log('  - Current index:', navigation.currentIndex);
  console.log('  - Last counter text:', navigation.lastCounterText);
  console.log('  - Counter element:', document.querySelector('#claude-nav-counter'));

  // Test if scroll events are firing
  console.log('\n🧪 Testing scroll event listener:');
  let scrollCount = 0;
  const testScrollHandler = () => {
    scrollCount++;
    console.log(`✅ Window scroll event #${scrollCount} detected`);
  };

  window.addEventListener('scroll', testScrollHandler);
  console.log('Added test scroll listener. Scroll to see if events fire.');

  setTimeout(() => {
    window.removeEventListener('scroll', testScrollHandler);
    console.log(`\n📊 Scroll test complete. ${scrollCount} scroll events detected in 5 seconds`);
  }, 5000);

  // Force a counter update to test
  console.log('\n🔧 Forcing counter update:');
  navigation.updateCounter();

  // Check getCurrentVisibleMessageIndex directly
  console.log('\n🎯 Testing getCurrentVisibleMessageIndex:');
  const index = navigation.dom.getCurrentVisibleMessageIndex(navigation.messages);
  console.log(`  - Direct call returned: ${index}`);

  console.log('\n💡 Now scroll manually and watch for these logs:');
  console.log('  - [NAV SCROLL] - Shows scroll handler is firing');
  console.log('  - [DOM getCurrentVisibleMessageIndex] - Shows index calculation');
  console.log('  - [NAV UPDATE COUNTER] - Shows counter update logic');
  console.log('\nIf you see NO logs while scrolling, the scroll listener is not attached.');
  console.log('If you see logs but counter doesn\'t update, check the index values.');
})();