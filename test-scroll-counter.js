/**
 * Scroll Counter Test Script
 *
 * This script tests that the navigation counter updates correctly during scroll.
 * Run this in the browser console after loading the extension.
 */

(function testScrollCounter() {
  console.log('🔄 === SCROLL COUNTER TEST ===');

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
  console.log('  - Messages:', navigation.messages.length);
  console.log('  - Current index:', navigation.currentIndex);
  console.log('  - Counter:', document.querySelector('#claude-nav-counter')?.textContent);

  // Test helper to scroll and check counter
  function scrollToMessage(index) {
    if (navigation.messages[index]) {
      navigation.messages[index].scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Wait for scroll and counter update
      setTimeout(() => {
        const counter = document.querySelector('#claude-nav-counter');
        console.log(`  Message ${index + 1}: Counter shows ${counter?.textContent}, currentIndex = ${navigation.currentIndex}`);
      }, 500);
    }
  }

  // Test scrolling to different positions
  console.log('\n🧪 Testing Scroll Updates:');

  console.log('1. Scroll to first message:');
  scrollToMessage(0);

  setTimeout(() => {
    console.log('\n2. Scroll to middle message:');
    const middle = Math.floor(navigation.messages.length / 2);
    scrollToMessage(middle);
  }, 1000);

  setTimeout(() => {
    console.log('\n3. Scroll to last message:');
    scrollToMessage(navigation.messages.length - 1);
  }, 2000);

  setTimeout(() => {
    console.log('\n4. Manual scroll test:');
    console.log('   Now manually scroll with mouse/scrollbar and watch the counter update!');
    console.log('   Expected: Counter updates within 300ms of scroll');

    // Monitor for 5 seconds
    let lastIndex = navigation.currentIndex;
    const monitor = setInterval(() => {
      if (navigation.currentIndex !== lastIndex) {
        console.log(`   ✅ Index changed: ${lastIndex} → ${navigation.currentIndex}`);
        lastIndex = navigation.currentIndex;
      }
    }, 100);

    setTimeout(() => {
      clearInterval(monitor);
      console.log('\n✅ === TEST COMPLETE ===');
    }, 5000);
  }, 3000);
})();