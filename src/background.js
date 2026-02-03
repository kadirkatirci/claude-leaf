/**
 * Background Service Worker
 * Handles extension-level events like installation
 */

// Open welcome page on first installation
chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') {
    chrome.tabs.create({
      url: 'http://tedaitesnim.com/claude-extension/welcome',
    });
  }
});
