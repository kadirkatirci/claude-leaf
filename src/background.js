/**
 * Background Service Worker
 * Handles extension-level events like installation and updates
 */

const WELCOME_URL = 'http://tedaitesnim.com/claude-extension/welcome';
const CHANGELOG_URL = 'http://tedaitesnim.com/claude-extension/changelog';
const UPDATE_CHECK_ALARM = 'update-check';
const UPDATE_CHECK_INTERVAL_MINUTES = 360; // 6 hours

function openTab(url) {
  chrome.tabs.create({ url });
}

function scheduleUpdateChecks() {
  chrome.alarms.create(UPDATE_CHECK_ALARM, {
    periodInMinutes: UPDATE_CHECK_INTERVAL_MINUTES,
  });
}

function checkForUpdates() {
  chrome.runtime.requestUpdateCheck((status, details) => {
    if (status === 'update_available') {
      chrome.runtime.reload();
      return;
    }
    if (status === 'throttled') {
      console.debug('Update check throttled:', details);
    }
  });
}

// Open welcome page on first installation
chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') {
    openTab(WELCOME_URL);
  }

  if (details.reason === 'update') {
    openTab(CHANGELOG_URL);
  }

  scheduleUpdateChecks();
  checkForUpdates();
});

// Check on browser startup
chrome.runtime.onStartup.addListener(() => {
  scheduleUpdateChecks();
  checkForUpdates();
});

// Periodic update checks
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === UPDATE_CHECK_ALARM) {
    checkForUpdates();
  }
});

// Apply updates as soon as they are ready
chrome.runtime.onUpdateAvailable.addListener(() => {
  chrome.runtime.reload();
});
