/**
 * Debug Configuration
 *
 * Controls debug logging throughout the extension.
 * Set DEBUG = false for production builds to improve performance.
 */

// Main debug flag - set to false for production
export const DEBUG = false;

// Module-specific debug flags (for fine-grained control)
export const DEBUG_FLAGS = {
  navigation: false,
  bookmarks: false,
  markers: false,
  editHistory: false,
  compactView: false,
  contentFolding: false,
  storage: false,
  cache: false,
  performance: false,
  observer: false,
  versionManager: false,
};

/**
 * Debug logger - only logs if DEBUG is enabled
 * @param {string} module - Module name
 * @param {...any} args - Arguments to log
 */
export function debugLog(module, ...args) {
  if (DEBUG || DEBUG_FLAGS[module]) {
    console.log(`[${module}]`, ...args);
  }
}

/**
 * Performance timer - measures execution time
 * @param {string} label - Timer label
 * @returns {Function} End function to call when done
 */
export function perfTimer(label) {
  if (!DEBUG && !DEBUG_FLAGS.performance) {
    return () => {}; // No-op if debug disabled
  }

  const start = performance.now();
  return () => {
    const duration = (performance.now() - start).toFixed(2);
    console.log(`[PERF] ${label}: ${duration}ms`);
  };
}

/**
 * Enable debug mode at runtime (via console)
 * Usage: window.enableDebug() or window.enableDebug('navigation')
 */
if (typeof window !== 'undefined') {
  window.enableDebug = (module = null) => {
    if (module) {
      DEBUG_FLAGS[module] = true;
      console.log(`✅ Debug enabled for: ${module}`);
    } else {
      Object.keys(DEBUG_FLAGS).forEach(key => {
        DEBUG_FLAGS[key] = true;
      });
      console.log('✅ Debug enabled for all modules');
    }
  };

  window.disableDebug = (module = null) => {
    if (module) {
      DEBUG_FLAGS[module] = false;
      console.log(`❌ Debug disabled for: ${module}`);
    } else {
      Object.keys(DEBUG_FLAGS).forEach(key => {
        DEBUG_FLAGS[key] = false;
      });
      console.log('❌ Debug disabled for all modules');
    }
  };
}

export default {
  DEBUG,
  DEBUG_FLAGS,
  debugLog,
  perfTimer,
};
