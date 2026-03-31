function wrapChromeCall(fn, ...args) {
  return new Promise((resolve, reject) => {
    fn(...args, result => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(result);
    });
  });
}

function getStorageArea(area) {
  if (area === 'session') {
    return chrome.storage.session;
  }
  if (area === 'local') {
    return chrome.storage.local;
  }
  return chrome.storage.sync;
}

async function queryTabs(queryInfo = {}) {
  return wrapChromeCall(chrome.tabs.query, queryInfo);
}

async function removeTab(tabId) {
  return wrapChromeCall(chrome.tabs.remove, tabId);
}

async function getStorage(area, keys = null) {
  return wrapChromeCall(getStorageArea(area).get.bind(getStorageArea(area)), keys);
}

async function setStorage(area, data) {
  return wrapChromeCall(getStorageArea(area).set.bind(getStorageArea(area)), data);
}

async function clearStorage(area) {
  const storage = getStorageArea(area);
  if (!storage) {
    return;
  }
  await wrapChromeCall(storage.clear.bind(storage));
}

async function findClaudeTabs() {
  const tabs = await queryTabs({});
  return tabs.filter(tab => {
    const url = tab?.url || '';
    return url === 'https://claude.ai' || url.startsWith('https://claude.ai/');
  });
}

async function closeNonFixtureTabs() {
  const tabs = await queryTabs({});
  const closableTabs = tabs.filter(tab => {
    const url = tab?.url || '';
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return false;
    }
    return !url.startsWith('https://claude.ai/');
  });

  await Promise.all(
    closableTabs.map(tab =>
      removeTab(tab.id).catch(() => {
        // Ignore tabs that disappear during cleanup.
      })
    )
  );

  return closableTabs.length;
}

async function getTabByRoute(route) {
  const tabs = await findClaudeTabs();
  return (
    tabs
      .filter(tab => {
        try {
          const url = new URL(tab.url);
          return url.pathname === route;
        } catch {
          return false;
        }
      })
      .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0] || null
  );
}

async function sendToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, response => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (response?.error) {
        reject(new Error(response.error));
        return;
      }
      resolve(response);
    });
  });
}

async function resetForTab(tabId) {
  await Promise.all([
    clearStorage('sync'),
    clearStorage('local'),
    chrome.storage.session ? clearStorage('session') : Promise.resolve(),
  ]);

  if (!tabId) {
    return { ok: true };
  }

  for (const storeId of ['bookmarks', 'markers', 'editHistory']) {
    try {
      await sendToTab(tabId, {
        type: 'STORE_CLEAR',
        storeId,
      });
    } catch {
      // Tests will reload the fixture after reset.
    }
  }

  return { ok: true };
}

async function setSettings(settings, tabId = null) {
  await setStorage('sync', { settings });

  if (tabId) {
    try {
      await sendToTab(tabId, {
        type: 'SETTINGS_UPDATED',
        settings,
      });
    } catch {
      // The next reload will still pick up the seeded settings.
    }
  }
}

window.__clLeafTestHarness = {
  ready: true,
  queryTabs,
  findClaudeTabs,
  getTabByRoute,
  getStorage,
  setStorage,
  clearStorage,
  closeNonFixtureTabs,
  resetForTab,
  setSettings,
  sendToTab,
  getExtensionId() {
    return chrome.runtime.id;
  },
  getPopupUrl(targetTabId) {
    return chrome.runtime.getURL(`popup/popup.html?targetTabId=${targetTabId}`);
  },
};
