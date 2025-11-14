/**
 * Test Script for Bookmark Sidebar Injection
 *
 * Run this in the browser console to verify sidebar injection is working
 */

(function testSidebarInjection() {
  console.log('🔖 === SIDEBAR INJECTION TEST ===');
  console.log('Current URL:', window.location.href);

  const app = window.claudeProductivity;
  if (!app) {
    console.error('❌ Extension not loaded');
    return;
  }

  const bookmarkModule = app.getModule('bookmarks');
  if (!bookmarkModule) {
    console.error('❌ BookmarkModule not found');
    return;
  }

  console.log('\n📊 BookmarkModule State:');
  console.log('  - Module initialized:', !!bookmarkModule);
  console.log('  - Sidebar object exists:', !!bookmarkModule.sidebar);
  console.log('  - Sidebar elements:', bookmarkModule.sidebar?.elements);

  // Check if sidebar bookmark section exists
  const bookmarkSection = document.querySelector('.flex.flex-col.mb-6');
  const bookmarkHeaders = Array.from(document.querySelectorAll('h3')).filter(h =>
    h.textContent.includes('Bookmarks')
  );

  console.log('\n🔍 DOM Analysis:');
  console.log('  - Sidebar container found:', !!document.querySelector('.flex.flex-col.overflow-y-auto.overflow-x-hidden.relative.px-2.mb-2'));
  console.log('  - Bookmark section found:', !!bookmarkSection);
  console.log('  - Bookmark headers found:', bookmarkHeaders.length);

  if (bookmarkHeaders.length > 0) {
    console.log('\n✅ Bookmark sidebar is present!');
    bookmarkHeaders.forEach((header, i) => {
      console.log(`  [${i}] Parent: ${header.parentElement?.className}`);
      console.log(`      Clickable: ${header.style.cursor === 'pointer'}`);
    });
  } else {
    console.log('\n❌ Bookmark sidebar NOT found');
  }

  console.log('\n🧪 Testing injection methods:');

  // Test direct injection
  console.log('1. Testing sidebar.inject():');
  try {
    const result = bookmarkModule.sidebar.inject();
    console.log(`   Result: ${result ? 'Success' : 'Failed'}`);
  } catch (error) {
    console.error('   Error:', error.message);
  }

  // Test updateUI
  console.log('\n2. Testing updateUI():');
  try {
    bookmarkModule.updateUI();
    console.log('   updateUI called successfully');
  } catch (error) {
    console.error('   Error:', error.message);
  }

  // Check again after injection attempts
  setTimeout(() => {
    const newHeaders = Array.from(document.querySelectorAll('h3')).filter(h =>
      h.textContent.includes('Bookmarks')
    );

    console.log('\n📊 === FINAL CHECK ===');
    console.log(`Bookmark headers after injection: ${newHeaders.length}`);

    if (newHeaders.length > 0) {
      console.log('✅ Sidebar injection successful!');

      // Test click functionality
      console.log('\n🖱️ Testing click functionality:');
      const header = newHeaders[0];
      console.log('Click the Bookmarks header to open bookmarks page');
      console.log('Header element:', header);
    } else {
      console.log('❌ Sidebar injection failed');

      console.log('\n💡 Troubleshooting:');
      console.log('1. Try refreshing the page');
      console.log('2. Make sure you\'re on claude.ai');
      console.log('3. Check if sidebar is visible');
      console.log('4. Try navigating to a conversation');
    }
  }, 1000);

  console.log('\n⏳ Test running... Results in 1 second');
})();