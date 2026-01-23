/**
 * Store Configuration - Single source of truth for all store definitions
 * This file is used by content script stores
 * The JSON version is copied to popup/ during build for DataService
 */

export const STORE_CONFIG = {
  bookmarks: {
    storageType: 'indexeddb',
    version: 3,
    defaultData: {
      bookmarks: [],
      categories: [{ id: 'default', name: 'General', color: '#667eea', isDefault: true }],
    },
    schema: {
      keyPath: 'id',
      indexes: [
        { name: 'conversationUrl', keyPath: 'conversationUrl', options: { unique: false } },
        { name: 'contentSignature', keyPath: 'contentSignature', options: { unique: false } },
        { name: 'type', keyPath: 'type', options: { unique: false } },
      ],
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
    schema: {
      keyPath: 'id',
      indexes: [
        { name: 'conversationUrl', keyPath: 'conversationUrl', options: { unique: false } },
        { name: 'contentSignature', keyPath: 'contentSignature', options: { unique: false } },
      ],
    },
    exportable: true,
    label: 'Emoji Markers',
  },
  editHistory: {
    storageType: 'indexeddb',
    version: 3,
    defaultData: {
      history: [],
      snapshots: [],
    },
    schema: {
      keyPath: 'id',
      indexes: [
        { name: 'conversationUrl', keyPath: 'conversationUrl', options: { unique: false } },
        { name: 'containerId', keyPath: 'containerId', options: { unique: false } },
        { name: 'type', keyPath: 'type', options: { unique: false } },
      ],
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
    schema: {
      keyPath: 'url',
      indexes: [{ name: 'lastAccessed', keyPath: 'lastAccessed', options: { unique: false } }],
    },
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
