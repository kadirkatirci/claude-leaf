/**
 * Performance Test for Scroll Counter Optimizations
 *
 * Run this in the browser console after loading the optimized extension
 */

(function testPerformance() {
  console.log('🚀 === PERFORMANCE TEST ===');
  console.log('Testing optimized scroll counter implementation...\n');

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

  console.log('📊 Current Configuration:');
  console.log('  - Scroll throttle: 300ms');
  console.log('  - Periodic check: 1000ms (was 500ms)');
  console.log('  - DOM observer debounce: 5000ms (was 2000ms)');
  console.log('  - Debug logs: Removed (use setScrollDebug(true) to enable)');
  console.log('  - Scroll containers:', navigation.scrollContainers?.size || 'Not set');

  console.log('\n🧪 Performance Metrics:');

  // Measure console output
  const originalLog = console.log;
  let logCount = 0;
  console.log = function() {
    logCount++;
    originalLog.apply(console, arguments);
  };

  console.log('\nMonitoring for 5 seconds...');
  console.log('Scroll the page to test performance.\n');

  const startTime = performance.now();
  let scrollEvents = 0;
  let counterUpdates = 0;
  let lastCounterText = document.querySelector('#claude-nav-counter')?.textContent;

  // Monitor scroll events
  const scrollHandler = () => scrollEvents++;
  window.addEventListener('scroll', scrollHandler);

  // Monitor counter updates
  const counterCheck = setInterval(() => {
    const currentText = document.querySelector('#claude-nav-counter')?.textContent;
    if (currentText !== lastCounterText) {
      counterUpdates++;
      lastCounterText = currentText;
    }
  }, 100);

  // Results after 5 seconds
  setTimeout(() => {
    const endTime = performance.now();
    const duration = (endTime - startTime) / 1000;

    // Restore console.log
    console.log = originalLog;

    // Clean up
    window.removeEventListener('scroll', scrollHandler);
    clearInterval(counterCheck);

    console.log('\n📊 === TEST RESULTS ===');
    console.log(`Test duration: ${duration.toFixed(2)} seconds`);
    console.log(`Console logs generated: ${logCount}`);
    console.log(`Scroll events captured: ${scrollEvents}`);
    console.log(`Counter updates: ${counterUpdates}`);

    console.log('\n🎯 Performance Analysis:');

    if (logCount < 5) {
      console.log('✅ Excellent: Minimal console output (< 5 logs)');
    } else if (logCount < 20) {
      console.log('✅ Good: Low console output (< 20 logs)');
    } else {
      console.log('⚠️ High console output detected (' + logCount + ' logs)');
    }

    if (scrollEvents > 0 && counterUpdates > 0) {
      const updateRatio = counterUpdates / scrollEvents;
      console.log(`✅ Counter update ratio: ${(updateRatio * 100).toFixed(1)}%`);
      console.log('   (Lower is better - means fewer unnecessary updates)');
    }

    console.log('\n💡 Debug Commands:');
    console.log('Enable scroll debugging:');
    console.log('  window.claudeProductivity.getModule("navigation").setScrollDebug(true)');
    console.log('\nCheck current state:');
    console.log('  const nav = window.claudeProductivity.getModule("navigation");');
    console.log('  console.log(nav.messages.length, nav.currentIndex);');

    console.log('\n✅ Performance test complete!');
  }, 5000);
})();