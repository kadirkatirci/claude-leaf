/**
 * Test to identify the actual scrollable container in Claude.ai
 *
 * Run this in the browser console to find what element is actually scrolling
 */

(function testScrollContainer() {
  console.log('🔍 === SCROLL CONTAINER TEST ===');

  // Check common scrollable containers
  const containers = [
    { name: 'window', element: window, isWindow: true },
    { name: 'document.body', element: document.body },
    { name: 'document.documentElement', element: document.documentElement },
    { name: 'main element', element: document.querySelector('main') },
    { name: 'article element', element: document.querySelector('article') },
    { name: 'div[role="main"]', element: document.querySelector('div[role="main"]') },
    { name: '.overflow-y-auto', element: document.querySelector('.overflow-y-auto') },
    { name: '.overflow-y-scroll', element: document.querySelector('.overflow-y-scroll') },
    { name: '.overflow-auto', element: document.querySelector('.overflow-auto') },
    { name: '.overflow-scroll', element: document.querySelector('.overflow-scroll') }
  ];

  console.log('\n📊 Checking containers:');
  containers.forEach(({name, element, isWindow}) => {
    if (!element) {
      console.log(`  ❌ ${name}: Not found`);
      return;
    }

    if (isWindow) {
      console.log(`  ✅ ${name}: Found`);
      console.log(`      - pageYOffset: ${window.pageYOffset}`);
      console.log(`      - scrollY: ${window.scrollY}`);
    } else {
      const scrollHeight = element.scrollHeight;
      const clientHeight = element.clientHeight;
      const scrollTop = element.scrollTop;
      const isScrollable = scrollHeight > clientHeight;

      console.log(`  ${isScrollable ? '✅' : '⚪'} ${name}: ${isScrollable ? 'SCROLLABLE' : 'Not scrollable'}`);
      if (element) {
        console.log(`      - scrollHeight: ${scrollHeight}`);
        console.log(`      - clientHeight: ${clientHeight}`);
        console.log(`      - scrollTop: ${scrollTop}`);
        console.log(`      - overflow-y: ${getComputedStyle(element).overflowY}`);
      }
    }
  });

  // Test which element actually receives scroll events
  console.log('\n🧪 Testing scroll event listeners (scroll the page for 5 seconds):');

  const testElements = [window, document, document.body, document.documentElement];
  const scrollCounts = new Map();
  const handlers = new Map();

  testElements.forEach(element => {
    if (!element) return;

    scrollCounts.set(element, 0);
    const handler = () => {
      const count = scrollCounts.get(element) + 1;
      scrollCounts.set(element, count);
      const name = element === window ? 'window' :
                   element === document ? 'document' :
                   element === document.body ? 'document.body' :
                   'document.documentElement';
      console.log(`  📜 Scroll event on ${name} (#${count})`);
    };
    handlers.set(element, handler);
    element.addEventListener('scroll', handler, { passive: true });
  });

  // Also check for any element with overflow set
  console.log('\n🔍 Looking for elements with overflow styles:');
  const allElements = document.querySelectorAll('*');
  const scrollableElements = [];

  allElements.forEach(el => {
    const style = getComputedStyle(el);
    if (style.overflowY === 'scroll' || style.overflowY === 'auto') {
      if (el.scrollHeight > el.clientHeight) {
        scrollableElements.push(el);
      }
    }
  });

  console.log(`Found ${scrollableElements.length} scrollable elements:`);
  scrollableElements.slice(0, 5).forEach(el => {
    console.log(`  - ${el.tagName}${el.className ? '.' + el.className.split(' ')[0] : ''}${el.id ? '#' + el.id : ''}`);
    console.log(`    scrollHeight: ${el.scrollHeight}, clientHeight: ${el.clientHeight}`);
  });

  // Cleanup after 5 seconds
  setTimeout(() => {
    handlers.forEach((handler, element) => {
      element.removeEventListener('scroll', handler);
    });

    console.log('\n📊 Final scroll event counts:');
    scrollCounts.forEach((count, element) => {
      const name = element === window ? 'window' :
                   element === document ? 'document' :
                   element === document.body ? 'document.body' :
                   'document.documentElement';
      console.log(`  ${name}: ${count} events`);
    });

    console.log('\n✅ Test complete. The element with the most scroll events is the actual scroll container.');
  }, 5000);
})();