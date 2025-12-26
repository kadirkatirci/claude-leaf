/**
 * KeyboardManager - Centralized keyboard shortcut management
 * Prevents conflicts and provides consistent shortcut handling
 */

class KeyboardManager {
  constructor() {
    this.shortcuts = new Map();
    this.enabled = true;
    this.listener = null;
    this.debugMode = false;
  }

  /**
   * Initialize the keyboard manager
   */
  init() {
    if (this.listener) {
      return; // Already initialized
    }

    this.listener = e => this.handleKeydown(e);
    document.addEventListener('keydown', this.listener, true);

    if (this.debugMode) {
      console.log('[KeyboardManager] Initialized');
    }
  }

  /**
   * Register a keyboard shortcut
   * @param {string} id - Unique identifier for the shortcut
   * @param {Object} config - Shortcut configuration
   * @param {Function} handler - Function to call when shortcut is triggered
   */
  register(id, config, handler) {
    if (!id || !config || !handler) {
      console.error('[KeyboardManager] Invalid shortcut registration:', id);
      return false;
    }

    const shortcut = {
      id,
      key: config.key,
      altKey: config.altKey || false,
      ctrlKey: config.ctrlKey || false,
      shiftKey: config.shiftKey || false,
      metaKey: config.metaKey || false,
      description: config.description || '',
      enabled: config.enabled !== false,
      handler,
      preventDefault: config.preventDefault !== false,
    };

    this.shortcuts.set(id, shortcut);

    if (this.debugMode) {
      console.log(`[KeyboardManager] Registered shortcut: ${id}`, shortcut);
    }

    return true;
  }

  /**
   * Unregister a keyboard shortcut
   */
  unregister(id) {
    const deleted = this.shortcuts.delete(id);

    if (this.debugMode && deleted) {
      console.log(`[KeyboardManager] Unregistered shortcut: ${id}`);
    }

    return deleted;
  }

  /**
   * Update shortcut configuration
   */
  update(id, config) {
    const shortcut = this.shortcuts.get(id);
    if (!shortcut) {
      console.warn(`[KeyboardManager] Shortcut not found: ${id}`);
      return false;
    }

    Object.assign(shortcut, config);

    if (this.debugMode) {
      console.log(`[KeyboardManager] Updated shortcut: ${id}`, shortcut);
    }

    return true;
  }

  /**
   * Enable/disable a specific shortcut
   */
  setEnabled(id, enabled) {
    const shortcut = this.shortcuts.get(id);
    if (!shortcut) {
      return false;
    }

    shortcut.enabled = enabled;
    return true;
  }

  /**
   * Enable/disable all shortcuts
   */
  setGlobalEnabled(enabled) {
    this.enabled = enabled;

    if (this.debugMode) {
      console.log(`[KeyboardManager] Global shortcuts ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Handle keydown events
   */
  handleKeydown(e) {
    if (!this.enabled) {
      return;
    }

    // Skip if user is typing in input/textarea
    const target = e.target;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true')
    ) {
      return;
    }

    // Check each registered shortcut
    for (const [id, shortcut] of this.shortcuts) {
      if (!shortcut.enabled) {
        continue;
      }

      if (this.matchesShortcut(e, shortcut)) {
        if (this.debugMode) {
          console.log(`[KeyboardManager] Triggered shortcut: ${id}`);
        }

        if (shortcut.preventDefault) {
          e.preventDefault();
          e.stopPropagation();
        }

        try {
          shortcut.handler(e);
        } catch (error) {
          console.error(`[KeyboardManager] Error in shortcut handler ${id}:`, error);
        }

        break; // Only trigger one shortcut per keypress
      }
    }
  }

  /**
   * Check if event matches shortcut
   */
  matchesShortcut(event, shortcut) {
    return (
      event.key === shortcut.key &&
      event.altKey === shortcut.altKey &&
      event.ctrlKey === shortcut.ctrlKey &&
      event.shiftKey === shortcut.shiftKey &&
      event.metaKey === shortcut.metaKey
    );
  }

  /**
   * Get all registered shortcuts
   */
  getShortcuts() {
    const shortcuts = [];

    for (const [id, shortcut] of this.shortcuts) {
      shortcuts.push({
        id,
        key: shortcut.key,
        modifiers: this.getModifierString(shortcut),
        description: shortcut.description,
        enabled: shortcut.enabled,
      });
    }

    return shortcuts;
  }

  /**
   * Get human-readable modifier string
   */
  getModifierString(shortcut) {
    const parts = [];

    if (shortcut.ctrlKey) {
      parts.push('Ctrl');
    }
    if (shortcut.altKey) {
      parts.push('Alt');
    }
    if (shortcut.shiftKey) {
      parts.push('Shift');
    }
    if (shortcut.metaKey) {
      parts.push('Cmd');
    }

    return parts.join('+');
  }

  /**
   * Get shortcut display string
   */
  getShortcutDisplay(id) {
    const shortcut = this.shortcuts.get(id);
    if (!shortcut) {
      return null;
    }

    const modifiers = this.getModifierString(shortcut);
    return modifiers ? `${modifiers}+${shortcut.key}` : shortcut.key;
  }

  /**
   * Clear all shortcuts for a specific module
   */
  clearModule(modulePrefix) {
    const toDelete = [];

    for (const [id] of this.shortcuts) {
      if (id.startsWith(modulePrefix)) {
        toDelete.push(id);
      }
    }

    toDelete.forEach(id => this.unregister(id));

    if (this.debugMode && toDelete.length > 0) {
      console.log(`[KeyboardManager] Cleared ${toDelete.length} shortcuts for ${modulePrefix}`);
    }
  }

  /**
   * Set debug mode
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
  }

  /**
   * Destroy the keyboard manager
   */
  destroy() {
    if (this.listener) {
      document.removeEventListener('keydown', this.listener, true);
      this.listener = null;
    }

    this.shortcuts.clear();

    if (this.debugMode) {
      console.log('[KeyboardManager] Destroyed');
    }
  }
}

// Export singleton instance
export default new KeyboardManager();
