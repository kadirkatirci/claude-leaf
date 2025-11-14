/**
 * Visibility Test Script
 *
 * This script verifies that all modules have consistent visibility behavior.
 * Run this in the browser console after the extension loads.
 */

(function testVisibility() {
  console.log('🔍 === VISIBILITY CONSISTENCY TEST ===');

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
    emojiMarkers: app.getModule('emojiMarkers'),
    sidebarCollapse: app.getModule('sidebarCollapse'),
    contentFolding: app.getModule('contentFolding')
  };

  console.log('\n📋 Module Status:');
  Object.entries(modules).forEach(([name, module]) => {
    if (module) {
      console.log(`✅ ${name}: Loaded (enabled: ${module.enabled})`);
    } else {
      console.log(`❌ ${name}: Not loaded`);
    }
  });

  // Check fixed buttons
  console.log('\n🔘 Fixed Button Elements:');
  const buttonIds = [
    'claude-nav-container',        // Navigation
    'claude-edit-history-button',  // EditHistory
    'claude-compact-toggle-all',   // CompactView
    'claude-bookmark-button',      // Bookmarks
    'claude-marker-button'         // EmojiMarkers
  ];

  buttonIds.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      const style = window.getComputedStyle(element);
      console.log(`✅ ${id}:`);
      console.log(`   display: ${style.display}`);
      console.log(`   visibility: ${style.visibility}`);
      console.log(`   opacity: ${style.opacity}`);
      console.log(`   pointer-events: ${style.pointerEvents}`);
    } else {
      console.log(`❌ ${id}: Not found`);
    }
  });

  // Check VisibilityManager state
  console.log('\n🎯 VisibilityManager State:');
  const path = window.location.pathname;
  const isConversationPage = (path.includes('/chat/') || path.includes('/project/')) && !path.includes('/new');
  console.log(`Current path: ${path}`);
  console.log(`Is conversation page: ${isConversationPage}`);

  // Test visibility change simulation
  console.log('\n🔄 Testing Visibility Change:');

  // Function to check all button states
  const checkButtonStates = (label) => {
    console.log(`\n${label}:`);
    buttonIds.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        const style = window.getComputedStyle(element);
        const isVisible = style.display !== 'none' &&
                         style.visibility !== 'hidden' &&
                         style.opacity !== '0' &&
                         style.pointerEvents !== 'none';
        console.log(`  ${id}: ${isVisible ? '✅ VISIBLE' : '❌ HIDDEN'}`);
      }
    });
  };

  // Check current state
  checkButtonStates('Current State');

  // Check which modules use VisibilityManager
  console.log('\n📊 Module Visibility Handling:');

  // Navigation
  if (modules.navigation) {
    const hasVisibilityListener = modules.navigation.container &&
                                  modules.navigation.handleVisibilityChange;
    console.log(`Navigation: ${hasVisibilityListener ? '✅ Has visibility handling' : '❌ Missing visibility handling'}`);
  }

  // EditHistory (uses FixedButtonMixin)
  if (modules.editHistory) {
    const hasVisibilityListener = modules.editHistory.setupVisibilityListener &&
                                  modules.editHistory.handleVisibilityChange;
    console.log(`EditHistory: ${hasVisibilityListener ? '✅ Has visibility handling (FixedButtonMixin)' : '❌ Missing visibility handling'}`);
  }

  // CompactView
  if (modules.compactView) {
    const hasVisibilityListener = modules.compactView.setupVisibilityListener;
    console.log(`CompactView: ${hasVisibilityListener ? '✅ Has visibility handling' : '❌ Missing visibility handling'}`);
  }

  // Bookmarks (uses FixedButtonMixin)
  if (modules.bookmarks) {
    const hasVisibilityListener = modules.bookmarks.setupVisibilityListener &&
                                  modules.bookmarks.handleVisibilityChange;
    console.log(`Bookmarks: ${hasVisibilityListener ? '✅ Has visibility handling (FixedButtonMixin)' : '❌ Missing visibility handling'}`);
  }

  // EmojiMarkers (uses FixedButtonMixin)
  if (modules.emojiMarkers) {
    const hasVisibilityListener = modules.emojiMarkers.setupVisibilityListener &&
                                  modules.emojiMarkers.handleVisibilityChange;
    console.log(`EmojiMarkers: ${hasVisibilityListener ? '✅ Has visibility handling (FixedButtonMixin)' : '❌ Missing visibility handling'}`);
  }

  console.log('\n✅ === TEST COMPLETE ===');
  console.log('Navigate between pages to verify buttons hide/show consistently.');
  console.log('All modules should use 4 CSS properties for robust visibility control.');
})();