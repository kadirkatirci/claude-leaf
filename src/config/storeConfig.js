/**
 * Store Configuration - Single source of truth for all store definitions
 * This file is used by content script stores
 * The JSON version is copied to popup/ during build for DataService
 */

export const STORE_CONFIG = {
  bookmarks: {
    storageType: 'indexeddb',
    version: 2,
    defaultData: {
      bookmarks: [],
      categories: [{ id: 'default', name: 'General', color: '#667eea', isDefault: true }],
    },
    exportable: true,
    label: 'Bookmarks',
  },
  markers: {
    storageType: 'indexeddb',
    version: 2,
    defaultData: {
      markers: [],
    },
    exportable: true,
    label: 'Emoji Markers',
  },
  editHistory: {
    storageType: 'indexeddb',
    version: 2,
    defaultData: {
      history: [],
      snapshots: [],
    },
    exportable: true,
    label: 'Edit History',
  },
  settings: {
    storageType: 'sync',
    version: 1,
    defaultData: null,
    exportable: true,
    label: 'Settings',
  },
  'conversation-states': {
    storageType: 'indexeddb',
    version: 1,
    defaultData: {},
    cacheTTL: 10000,
    exportable: false,
    label: 'Conversation State',
  },
};

/**
 * Get store config by ID
 */
export function getStoreConfig(storeId) {
  return STORE_CONFIG[storeId];
}

/**
 * Get all exportable store IDs
 */
export function getExportableStoreIds() {
  return Object.entries(STORE_CONFIG)
    .filter(([, config]) => config.exportable)
    .map(([id]) => id);
}
