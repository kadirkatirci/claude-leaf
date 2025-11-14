/**
 * Counter Initialization Test Script
 *
 * This script tests counter initialization in different navigation scenarios.
 * Run this in the browser console after loading the extension.
 */

(function testCounterInitialization() {
  console.log('🔍 === COUNTER INITIALIZATION TEST ===');
  console.log('Current URL:', window.location.href);

  const app = window.claudeProductivity;
  if (!app) {
    console.error('❌ Extension not loaded');
    return;
  }

  // Get all modules
  const modules = {
    navigation: app.getModule('navigation'),
    editHistory: app.getModule('editHistory'),
    compactView: app.getModule('compactView'),
    bookmarks: app.getModule('bookmarks'),
    emojiMarkers: app.getModule('emojiMarkers')
  };

  console.log('\n📋 Module Status:');

  // Check NavigationModule
  if (modules.navigation) {
    console.log('NavigationModule:');
    console.log('  - Messages:', modules.navigation.messages.length);
    console.log('  - Current index:', modules.navigation.currentIndex);
    console.log('  - Has initial load completed:', modules.navigation.hasInitialLoadCompleted);

    const counterEl = document.querySelector('#claude-nav-container .claude-counter-badge');
    if (counterEl) {
      console.log('  - Counter text:', counterEl.textContent);
    } else {
      console.log('  - Counter element: NOT FOUND');
    }
  }

  // Check EditHistoryModule
  if (modules.editHistory) {
    console.log('\nEditHistoryModule:');
    console.log('  - Edited messages:', modules.editHistory.editedMessages.length);

    const counterEl = document.querySelector('#claude-edit-fixed-btn .claude-counter-badge');
    if (counterEl) {
      console.log('  - Counter text:', counterEl.textContent);
    } else {
      console.log('  - Counter element: NOT FOUND');
    }
  }

  // Check BookmarkModule
  if (modules.bookmarks) {
    console.log('\nBookmarkModule:');

    const counterEl = document.querySelector('#claude-bookmarks-fixed-btn .claude-counter-badge');
    if (counterEl) {
      console.log('  - Counter text:', counterEl.textContent);
    } else {
      console.log('  - Counter element: NOT FOUND');
    }
  }

  // Check EmojiMarkerModule
  if (modules.emojiMarkers) {
    console.log('\nEmojiMarkerModule:');

    const counterEl = document.querySelector('#claude-marker-fixed-btn .claude-counter-badge');
    if (counterEl) {
      console.log('  - Counter text:', counterEl.textContent);
    } else {
      console.log('  - Counter element: NOT FOUND');
    }
  }

  // Check messages in DOM
  console.log('\n📄 DOM State:');
  const messages = document.querySelectorAll('[data-is-streaming="false"]');
  console.log('  - Messages in DOM:', messages.length);
  console.log('  - Is conversation page:', window.location.pathname.includes('/chat/'));

  // Test scenarios
  console.log('\n🧪 Test Scenarios:');
  console.log('1. Homepage → Chat: Navigate from claude.ai to a chat');
  console.log('   Expected: All counters should update after retry');
  console.log('   Check console for retry logs like "🔄 Retry 1/10: Waiting 150ms for messages..."');

  console.log('\n2. Direct chat link: Open a chat URL directly');
  console.log('   Expected: All counters should update immediately');

  console.log('\n3. Page refresh: Refresh while on a chat');
  console.log('   Expected: All counters should update immediately');

  console.log('\n4. Browser back/forward: Use browser navigation');
  console.log('   Expected: Counters should update properly');

  // Monitor retry logs
  console.log('\n📊 Monitor Retry Logs:');
  console.log('Watch for these log patterns:');
  console.log('  - "🔄 Retry X/10: Waiting Yms for messages..." (NavigationModule)');
  console.log('  - "🔄 Edit scan retry X/5: Waiting Yms..." (EditHistoryModule)');
  console.log('  - "🔄 Bookmark retry X/5: Waiting Yms for messages..." (BookmarkModule)');
  console.log('  - "🔄 Marker retry X/5: Waiting Yms for messages..." (EmojiMarkerModule)');

  console.log('\n✅ === TEST COMPLETE ===');
  console.log('Try the scenarios above and watch the console for retry mechanisms.');
})();