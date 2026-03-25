/* eslint-disable no-console */

export async function notifyClaudeTab(message) {
  try {
    const targetTab = await window.DataService.findClaudeTab();
    if (!targetTab?.id) {
      return false;
    }

    await chrome.tabs.sendMessage(targetTab.id, message);
    return true;
  } catch {
    return false;
  }
}

export function getStoreIdFromConfig(configKey) {
  const keyMap = {
    editHistory: 'editHistory',
    bookmarks: 'bookmarks',
    emojiMarkers: 'markers',
    settings: 'settings',
  };
  return keyMap[configKey] || null;
}

export async function saveSettings({
  config,
  currentSettings,
  lastSavedSettings,
  devConfig,
  trackEvent,
  showToast,
}) {
  console.log('[Popup] 💾 Saving settings to chrome.storage.sync...');
  console.log('[Popup] 📦 Settings to save:', JSON.stringify(currentSettings, null, 2));

  try {
    await chrome.storage.sync.set({ settings: currentSettings });
    console.log('[Popup] ✅ Settings saved successfully');

    const saved = await chrome.storage.sync.get(null);
    console.log('[Popup] 🔍 Verification - storage contents:', saved);

    showToast('Settings saved!', 'success');
    const enabledCount = Object.values(currentSettings || {}).filter(
      value => value && typeof value === 'object' && value.enabled === true
    ).length;
    trackEvent('popup_settings_save', {
      module: 'popup',
      result: 'success',
      count: enabledCount,
    });

    if (lastSavedSettings) {
      Object.keys(config.modules)
        .filter(id => !devConfig.disabledModules.includes(id))
        .forEach(id => {
          const prevEnabled = lastSavedSettings?.[id]?.enabled ?? false;
          const nextEnabled = currentSettings?.[id]?.enabled ?? false;
          if (prevEnabled !== nextEnabled) {
            trackEvent('popup_module_toggle', {
              module: id,
              state: nextEnabled ? 'enabled' : 'disabled',
              method: 'save',
            });
          }
        });
    }

    await notifyClaudeTab({
      type: 'SETTINGS_UPDATED',
      settings: currentSettings,
    });

    return {
      ok: true,
      snapshot: JSON.parse(JSON.stringify(currentSettings)),
    };
  } catch (error) {
    console.error('[Popup] ❌ Failed to save settings:', error);
    showToast('Failed to save settings', 'error');
    trackEvent('popup_settings_save', {
      module: 'popup',
      result: 'error',
    });

    return {
      ok: false,
      snapshot: lastSavedSettings,
      error,
    };
  }
}

export async function resetSettings({
  getDefaultSettings,
  saveCurrentSettings,
  setCurrentSettings,
  showToast,
  trackEvent,
}) {
  if (confirm('Reset all settings to defaults? This cannot be undone.')) {
    setCurrentSettings(getDefaultSettings());
    await saveCurrentSettings();
    showToast('Settings reset!', 'success');
    trackEvent('popup_settings_reset', {
      module: 'popup',
      result: 'success',
    });
  }
}

export async function handleExport({ config, currentSettings, trackEvent, showToast }) {
  const selectedStores = [];

  for (const opt of config.dataOptions.export) {
    if (!document.getElementById(opt.id)?.checked) {
      continue;
    }

    const storeId = getStoreIdFromConfig(opt.key);
    if (storeId) {
      selectedStores.push(storeId);
    }
  }

  if (selectedStores.length === 0) {
    showToast('Nothing selected', 'warning');
    trackEvent('popup_data_export', {
      module: 'popup',
      result: 'none_selected',
    });
    return;
  }

  try {
    const exportData = await window.DataService.exportData(selectedStores, currentSettings);

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `claude-leaf-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);

    showToast('Exported successfully!', 'success');
    console.log('[Popup] Exported stores:', selectedStores);
    trackEvent('popup_data_export', {
      module: 'popup',
      result: 'success',
      count: selectedStores.length,
      data_type: selectedStores.join(','),
    });
  } catch (error) {
    console.error('[Popup] Export error:', error);
    showToast('Export failed', 'error');
    trackEvent('popup_data_export', {
      module: 'popup',
      result: 'error',
      count: selectedStores.length,
      data_type: selectedStores.join(','),
    });
  }
}

export function handleImport({
  getDefaultSettings,
  deepMerge,
  saveCurrentSettings,
  setCurrentSettings,
  updateUI,
  trackEvent,
  showToast,
}) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';

  input.onchange = async event => {
    const file = event.target.files[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const dataTypes = Object.keys(data || {}).join(',');
      const result = await window.DataService.importData(data, true);

      if (data.settings) {
        setCurrentSettings(deepMerge(getDefaultSettings(), data.settings));
        await saveCurrentSettings();
        updateUI();
      }

      const importedCount = Object.values(result.imported).reduce((sum, value) => {
        return sum + (typeof value === 'number' ? value : 0);
      }, 0);

      if (result.success) {
        showToast(`Imported ${importedCount} items`, 'success');
        console.log('[Popup] Import result:', result);
        trackEvent('popup_data_import', {
          module: 'popup',
          result: 'success',
          count: importedCount,
          data_type: dataTypes,
        });
      } else {
        showToast('Import completed with errors', 'warning');
        console.warn('[Popup] Import errors:', result.errors);
        trackEvent('popup_data_import', {
          module: 'popup',
          result: 'partial',
          count: importedCount,
          data_type: dataTypes,
        });
      }

      await notifyClaudeTab({ type: 'DATA_IMPORTED' });
    } catch (error) {
      console.error('[Popup] Import error:', error);
      showToast('Invalid file', 'error');
      trackEvent('popup_data_import', {
        module: 'popup',
        result: 'error',
      });
    }
  };

  input.click();
}

export async function handleClear({ config, trackEvent, showToast }) {
  const selectedStores = [];
  const storeMap = {
    editHistory: 'editHistory',
    bookmarks: 'bookmarks',
    markers: 'markers',
  };

  for (const opt of config.dataOptions.clear) {
    if (document.getElementById(opt.id)?.checked) {
      const mappedId = storeMap[opt.storageKey];
      if (mappedId) {
        selectedStores.push(mappedId);
      }
    }
  }

  if (selectedStores.length === 0) {
    showToast('Nothing selected', 'warning');
    trackEvent('popup_data_clear', {
      module: 'popup',
      result: 'none_selected',
    });
    return;
  }

  if (!confirm('⚠️ Permanently delete selected data?')) {
    trackEvent('popup_data_clear', {
      module: 'popup',
      result: 'cancel',
      count: selectedStores.length,
      data_type: selectedStores.join(','),
    });
    return;
  }

  try {
    for (const storeId of selectedStores) {
      await window.DataService.clearStore(storeId, false);
    }

    config.dataOptions.clear.forEach(opt => {
      const checkbox = document.getElementById(opt.id);
      if (checkbox) {
        checkbox.checked = false;
      }
    });

    showToast('Data cleared', 'success');
    console.log('[Popup] Cleared stores:', selectedStores);
    trackEvent('popup_data_clear', {
      module: 'popup',
      result: 'success',
      count: selectedStores.length,
      data_type: selectedStores.join(','),
    });

    await notifyClaudeTab({ type: 'DATA_CLEARED' });
  } catch (error) {
    console.error('[Popup] Clear error:', error);
    showToast('Failed to clear', 'error');
    trackEvent('popup_data_clear', {
      module: 'popup',
      result: 'error',
      count: selectedStores.length,
      data_type: selectedStores.join(','),
    });
  }
}
