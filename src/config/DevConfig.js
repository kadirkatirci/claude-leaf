/**
 * Development Configuration
 *
 * Use this file to temporarily disable modules during development.
 * Set DEV_DISABLED: true to skip loading a module entirely.
 *
 * This does NOT delete any code - modules remain intact and can be
 * re-enabled by setting DEV_DISABLED: false or removing the flag.
 *
 * Usage:
 *   DEV_DISABLED: true   → Module will not be loaded at all
 *   DEV_DISABLED: false  → Module loads normally (respects user settings)
 */

export const DEV_CONFIG = {
  modules: {
    navigation: {
      DEV_DISABLED: false,
      // reason: 'Stable - production ready'
    },

    editHistory: {
      DEV_DISABLED: false,
      // reason: 'Stable - production ready'
    },

    compactView: {
      DEV_DISABLED: true,
      reason: 'Needs improvement',
    },

    bookmarks: {
      DEV_DISABLED: false,
      // reason: 'Stable - production ready'
    },

    emojiMarkers: {
      DEV_DISABLED: false,
      // reason: 'Stable - production ready'
    },

    sidebarCollapse: {
      DEV_DISABLED: true,
      reason: 'Needs improvement',
    },

    contentFolding: {
      DEV_DISABLED: true,
      reason: 'Needs improvement',
    },
  },
};

/**
 * Helper function to check if a module is dev-disabled
 * @param {string} moduleName - The module name to check
 * @returns {boolean} - true if module should be skipped
 */
export function isDevDisabled(moduleName) {
  const config = DEV_CONFIG.modules[moduleName];
  return config?.DEV_DISABLED === true;
}

/**
 * Get list of all dev-disabled modules
 * @returns {string[]} - Array of disabled module names
 */
export function getDevDisabledModules() {
  return Object.entries(DEV_CONFIG.modules)
    .filter(([_, config]) => config?.DEV_DISABLED === true)
    .map(([name]) => name);
}
