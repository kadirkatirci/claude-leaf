/**
 * Test Script for Scroll Counter Fix
 *
 * Run this in the browser console after loading the extension to verify the fix.
 */

(function testScrollFix() {
  console.log('🔍 === SCROLL COUNTER FIX TEST ===');
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
  console.log('  - Counter element:', document.querySelector('#claude-nav-counter')?.textContent);
  console.log('  - Scroll containers:', navigation.scrollContainers?.size || 'Not set');
  console.log('  - Scroll interval active:', navigation.scrollCheckInterval ? 'Yes' : 'No');

  console.log('\n🔍 Checking for scroll containers:');
  const containers = document.querySelectorAll('[class*="overflow"]');
  console.log(`  Found ${containers.length} elements with overflow classes`);

  containers.forEach((el, i) => {
    if (el.scrollHeight > el.clientHeight) {
      console.log(`  [${i}] ${el.tagName}.${el.className.split(' ')[0]} - Scrollable`);
      console.log(`       scrollHeight: ${el.scrollHeight}, clientHeight: ${el.clientHeight}`);
    }
  });

  console.log('\n📜 Monitoring scroll events for 5 seconds:');
  console.log('Try scrolling the page to see which events fire...');

  let eventCounts = {
    window: 0,
    document: 0,
    periodic: 0,
    counterUpdates: 0
  };

  // Monitor window scroll
  const windowHandler = () => {
    eventCounts.window++;
    console.log(`  [WINDOW] Scroll event #${eventCounts.window}`);
  };
  window.addEventListener('scroll', windowHandler);

  // Monitor document scroll
  const docHandler = () => {
    eventCounts.document++;
    console.log(`  [DOCUMENT] Scroll event #${eventCounts.document}`);
  };
  document.addEventListener('scroll', docHandler, { capture: true });

  // Monitor counter updates
  const counterEl = document.querySelector('#claude-nav-counter');
  let lastCounterText = counterEl?.textContent;
  const counterCheck = setInterval(() => {
    const currentText = counterEl?.textContent;
    if (currentText !== lastCounterText) {
      eventCounts.counterUpdates++;
      console.log(`  [COUNTER] Updated: "${lastCounterText}" → "${currentText}"`);
      lastCounterText = currentText;
    }
  }, 100);

  // Monitor periodic checks in console
  console.log('\n💡 Also watch for these console logs while scrolling:');
  console.log('  - [NAV SCROLL] - Scroll event handler firing');
  console.log('  - [NAV PERIODIC CHECK] - Fallback interval check');
  console.log('  - [NAV UPDATE COUNTER] - Counter being updated');

  // Cleanup after 5 seconds
  setTimeout(() => {
    window.removeEventListener('scroll', windowHandler);
    document.removeEventListener('scroll', docHandler);
    clearInterval(counterCheck);

    console.log('\n📊 === TEST RESULTS ===');
    console.log('Event counts in 5 seconds:');
    console.log(`  - Window scroll events: ${eventCounts.window}`);
    console.log(`  - Document scroll events: ${eventCounts.document}`);
    console.log(`  - Counter updates: ${eventCounts.counterUpdates}`);

    console.log('\nFinal state:');
    console.log(`  - Current index: ${navigation.currentIndex}`);
    console.log(`  - Counter text: ${counterEl?.textContent}`);

    if (eventCounts.counterUpdates > 0) {
      console.log('\n✅ SUCCESS: Counter is updating during scroll!');
    } else if (eventCounts.window === 0 && eventCounts.document === 0) {
      console.log('\n⚠️ WARNING: No scroll events detected. The periodic fallback should handle updates.');
    } else {
      console.log('\n❌ ISSUE: Scroll events firing but counter not updating. Check debug logs.');
    }
  }, 5000);

  console.log('\nTest will complete in 5 seconds...');
})();