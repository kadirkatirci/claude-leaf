// Storage Migration Script

let migrationLogs = [];

function log(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  migrationLogs.push({ timestamp, message, type });
  updateLogs();
  console.log(`[Migration ${type.toUpperCase()}]`, message);
}

function updateLogs() {
  const logsDiv = document.getElementById('logs');
  if (migrationLogs.length === 0) return;

  logsDiv.innerHTML = '<h3 style="margin-bottom: 10px;">Migration Logs:</h3>' +
    migrationLogs.map(l => `
      <div class="status ${l.type}">
        [${l.timestamp}] ${l.message}
      </div>
    `).join('');
}

// Check current storage status
async function checkStorageStatus() {
  const statusDiv = document.getElementById('status-info');

  const local = await new Promise(resolve => chrome.storage.local.get(null, resolve));
  const sync = await new Promise(resolve => chrome.storage.sync.get(null, resolve));

  statusDiv.innerHTML = `
    <div class="status">
      <strong>Local Storage Keys:</strong> ${Object.keys(local).join(', ') || 'None'}
    </div>
    <div class="status">
      <strong>Sync Storage Keys:</strong> ${Object.keys(sync).join(', ') || 'None'}
    </div>
  `;

  // Check bookmarks
  const bookmarksDiv = document.getElementById('bookmarks-status');
  if (local['claude-bookmarks'] && Array.isArray(local['claude-bookmarks'])) {
    bookmarksDiv.innerHTML = `
      <div class="status warning">
        ⚠️ Found ${local['claude-bookmarks'].length} bookmarks in OLD format (claude-bookmarks key)
      </div>
    `;
  } else if (local.bookmarks?.data?.bookmarks) {
    bookmarksDiv.innerHTML = `
      <div class="status success">
        ✅ Bookmarks already in NEW format (${local.bookmarks.data.bookmarks.length} items)
      </div>
    `;
  } else {
    bookmarksDiv.innerHTML = `
      <div class="status">No bookmarks found</div>
    `;
  }

  // Check markers
  const markersDiv = document.getElementById('markers-status');
  const oldMarkers = local['claude-emoji-markers'] || sync['claude-emoji-markers'];
  if (oldMarkers && Array.isArray(oldMarkers)) {
    markersDiv.innerHTML = `
      <div class="status warning">
        ⚠️ Found ${oldMarkers.length} markers in OLD format (claude-emoji-markers key)
      </div>
    `;
  } else if (sync.markers?.data?.markers || local.markers?.data?.markers) {
    const count = sync.markers?.data?.markers?.length || local.markers?.data?.markers?.length || 0;
    markersDiv.innerHTML = `
      <div class="status success">
        ✅ Markers already in NEW format (${count} items)
      </div>
    `;
  } else {
    markersDiv.innerHTML = `
      <div class="status">No markers found</div>
    `;
  }

  // Check settings
  const settingsDiv = document.getElementById('settings-status');
  if (sync.settings?.data?.settings) {
    settingsDiv.innerHTML = `
      <div class="status success">
        ✅ Settings already in NEW format
      </div>
    `;
  } else if (sync.settings && typeof sync.settings === 'object' && !sync.settings.data) {
    settingsDiv.innerHTML = `
      <div class="status warning">
        ⚠️ Settings in OLD format (direct object)
      </div>
    `;
  } else {
    settingsDiv.innerHTML = `
      <div class="status">No settings found</div>
    `;
  }
}

// Migrate bookmarks
async function migrateBookmarks() {
  log('Starting bookmarks migration...', 'info');

  const local = await new Promise(resolve => chrome.storage.local.get(['claude-bookmarks', 'bookmarks'], resolve));

  // Check if already migrated
  if (local.bookmarks?.data?.bookmarks && !local['claude-bookmarks']) {
    log('Bookmarks already migrated!', 'success');
    return true;
  }

  const oldBookmarks = local['claude-bookmarks'];
  if (!oldBookmarks || !Array.isArray(oldBookmarks)) {
    log('No old bookmarks found to migrate', 'warning');
    return false;
  }

  log(`Found ${oldBookmarks.length} bookmarks in old format`, 'info');

  // Create new format
  const newFormat = {
    version: 2,
    data: {
      bookmarks: oldBookmarks
    }
  };

  // Save in new format
  await new Promise(resolve => {
    chrome.storage.local.set({ bookmarks: newFormat }, resolve);
  });

  log(`Migrated ${oldBookmarks.length} bookmarks to new format`, 'success');

  // Delete old key
  await new Promise(resolve => {
    chrome.storage.local.remove('claude-bookmarks', resolve);
  });

  log('Deleted old bookmarks key', 'success');

  return true;
}

// Migrate emoji markers
async function migrateMarkers() {
  log('Starting markers migration...', 'info');

  const local = await new Promise(resolve => chrome.storage.local.get(['claude-emoji-markers', 'markers'], resolve));
  const sync = await new Promise(resolve => chrome.storage.sync.get(['claude-emoji-markers', 'markers'], resolve));

  // Check if already migrated
  if ((sync.markers?.data?.markers || local.markers?.data?.markers) &&
      !sync['claude-emoji-markers'] && !local['claude-emoji-markers']) {
    log('Markers already migrated!', 'success');
    return true;
  }

  // Try to find old markers (could be in local or sync)
  const oldMarkers = sync['claude-emoji-markers'] || local['claude-emoji-markers'];
  if (!oldMarkers || !Array.isArray(oldMarkers)) {
    log('No old markers found to migrate', 'warning');
    return false;
  }

  log(`Found ${oldMarkers.length} markers in old format`, 'info');

  // Create new format
  const newFormat = {
    version: 2,
    data: {
      markers: oldMarkers
    }
  };

  // Save in sync storage (default for markers)
  await new Promise(resolve => {
    chrome.storage.sync.set({ markers: newFormat }, resolve);
  });

  log(`Migrated ${oldMarkers.length} markers to new format (sync)`, 'success');

  // Delete old keys from both storages
  await new Promise(resolve => {
    chrome.storage.local.remove('claude-emoji-markers', resolve);
  });
  await new Promise(resolve => {
    chrome.storage.sync.remove('claude-emoji-markers', resolve);
  });

  log('Deleted old markers keys', 'success');

  return true;
}

// Migrate settings
async function migrateSettings() {
  log('Starting settings migration...', 'info');

  const sync = await new Promise(resolve => chrome.storage.sync.get(['settings'], resolve));

  // Check if already in new format
  if (sync.settings?.data?.settings) {
    log('Settings already in new format!', 'success');
    return true;
  }

  // Check if settings exist in old format
  if (!sync.settings || typeof sync.settings !== 'object') {
    log('No settings found to migrate', 'warning');
    return false;
  }

  log('Found settings in old format', 'info');

  const oldSettings = sync.settings;

  // Create new format
  const newFormat = {
    version: 1,
    data: {
      settings: oldSettings
    }
  };

  // Save in new format
  await new Promise(resolve => {
    chrome.storage.sync.set({ settings: newFormat }, resolve);
  });

  log('Migrated settings to new format', 'success');

  return true;
}

// Migrate all
async function migrateAll() {
  log('='.repeat(50), 'info');
  log('Starting FULL MIGRATION...', 'info');
  log('='.repeat(50), 'info');

  const results = {
    bookmarks: await migrateBookmarks(),
    markers: await migrateMarkers(),
    settings: await migrateSettings()
  };

  log('='.repeat(50), 'info');
  log('MIGRATION COMPLETE!', 'success');
  log(`Bookmarks: ${results.bookmarks ? '✅' : '❌'}`, results.bookmarks ? 'success' : 'error');
  log(`Markers: ${results.markers ? '✅' : '❌'}`, results.markers ? 'success' : 'error');
  log(`Settings: ${results.settings ? '✅' : '❌'}`, results.settings ? 'success' : 'error');
  log('='.repeat(50), 'info');

  // Refresh status
  await checkStorageStatus();

  // Notify user to reload extension
  alert('Migration complete! Please reload the extension:\n1. Go to chrome://extensions\n2. Find "Claude Productivity"\n3. Click the reload button 🔄');
}

// Setup event listeners
document.addEventListener('DOMContentLoaded', async () => {
  await checkStorageStatus();

  document.getElementById('migrate-bookmarks').addEventListener('click', async () => {
    await migrateBookmarks();
    await checkStorageStatus();
  });

  document.getElementById('migrate-markers').addEventListener('click', async () => {
    await migrateMarkers();
    await checkStorageStatus();
  });

  document.getElementById('migrate-settings').addEventListener('click', async () => {
    await migrateSettings();
    await checkStorageStatus();
  });

  document.getElementById('migrate-all').addEventListener('click', migrateAll);
});
