/**
 * PanelManager - Shared navigation panel for all modules
 *
 * Manages the floating action panel (#claude-nav-container).
 * Ensures the panel exists if ANY module needs it, even if NavigationModule is disabled.
 * Handles visibility and button management.
 */

import DOMUtils from '../utils/DOMUtils.js';
import VisibilityManager from '../utils/VisibilityManager.js';
import navigationInterceptor from '../core/NavigationInterceptor.js';
import { MODULE_CONSTANTS } from '../config/ModuleConstants.js';
import { eventBus, Events } from '../utils/EventBus.js';
import { debugLog } from '../config/debug.js';
import {
  applyFloatingVisibility,
  getFloatingContainerLayout,
  setFloatingOpacity,
} from '../utils/FloatingVisibility.js';

const NAV_CONFIG = MODULE_CONSTANTS.navigation;

// Loading state opacity (dimmed until data loads)
const LOADING_OPACITY = 0.3;

class PanelManager {
  constructor() {
    this.container = null;
    this.buttons = new Map(); // id -> { element, order, owner, visible }
    this.visible = false;
    this.cachedOpacity = NAV_CONFIG.opacity || 0.7;
    this.isReady = false; // Track if initial data has loaded
    this.navigationUnsubscribe = null; // Navigation event listener cleanup
  }

  /**
   * Initialize the panel manager
   */
  init() {
    this.setupVisibilityListener();
    this.setupReadyListener();
    this.setupHealthCheck();
  }

  /**
   * Health check - periodically verify state consistency
   * Fixes any state drift caused by timing issues
   */
  setupHealthCheck() {
    // Check every 2 seconds for state consistency
    this.healthCheckInterval = setInterval(() => {
      if (!this.container || !document.body.contains(this.container)) {
        // Container missing, recreate if we have buttons
        if (this.buttons.size > 0) {
          debugLog('panel', 'Health check: Container missing, recreating...');
          this.createContainer();
        }
        return;
      }

      // Verify visibility matches expected state
      const isConversationPage = VisibilityManager.isOnConversationPage();
      const currentDisplay = this.container.style.display;
      const expectedDisplay = isConversationPage && this.hasVisibleButtons() ? 'flex' : 'none';

      if (currentDisplay !== expectedDisplay) {
        debugLog('panel', 'Health check: Fixing visibility mismatch');
        if (isConversationPage && this.hasVisibleButtons()) {
          applyFloatingVisibility(this.container, {
            visible: true,
            opacity: this.isReady ? this.cachedOpacity : LOADING_OPACITY,
          });
        } else {
          applyFloatingVisibility(this.container, {
            visible: false,
          });
        }
      }
    }, 2000);
  }

  /**
   * Listen for MessageHub events to know when data is ready
   */
  setupReadyListener() {
    // When first content change comes, mark as ready
    const markReady = () => {
      if (this.isReady) {
        return;
      } // Already ready

      this.isReady = true;

      // Transition to normal opacity
      if (this.container && this.visible) {
        setFloatingOpacity(this.container, this.cachedOpacity);
      }
    };

    // Listen to both events - whichever fires first
    eventBus.on(Events.HUB_CONTENT_CHANGED, markReady);
    eventBus.on(Events.HUB_MESSAGE_COUNT_CHANGED, markReady);

    // Also listen for navigation events to handle /new → conversation transitions
    this.navigationUnsubscribe = navigationInterceptor.onNavigate(event => {
      // When entering a conversation page from /new or elsewhere, reset ready state
      if (event.isConversationPage && !event.wasConversationPage) {
        this.isReady = false;
        if (this.container) {
          setFloatingOpacity(this.container, LOADING_OPACITY);
        }
      }
    });
  }

  /**
   * Get or create the main container
   */
  getContainer() {
    if (this.container && document.body.contains(this.container)) {
      return this.container;
    }

    // Re-create if missing
    this.createContainer();
    return this.container;
  }

  /**
   * Create the container element
   */
  createContainer() {
    const position = NAV_CONFIG.position || 'right';
    const isConversationPage = VisibilityManager.isOnConversationPage();
    const shouldShowContainer = isConversationPage && this.hasVisibleButtons();

    // Start with loading opacity until data is ready
    const initialOpacity = this.isReady ? this.cachedOpacity : LOADING_OPACITY;

    this.container = DOMUtils.createElement('div', {
      id: 'claude-nav-container',
      'data-nav-container': 'true',
      style: getFloatingContainerLayout(position),
    });
    applyFloatingVisibility(this.container, {
      visible: shouldShowContainer,
      opacity: initialOpacity,
    });

    // Hover effect
    this.container.addEventListener('mouseenter', () => {
      setFloatingOpacity(this.container, 1);
    });
    this.container.addEventListener('mouseleave', () => {
      setFloatingOpacity(this.container, this.cachedOpacity);
    });

    document.body.appendChild(this.container);

    this.renderButtons();

    return this.container;
  }

  /**
   * Add a button to the panel
   * @param {HTMLElement} button - Button element
   * @param {number} [order=0] - Order index (lower is higher up)
   */
  addButton(button, order = 0, options = {}) {
    const { owner = null, visible = true } = options;
    const container = this.getContainer();

    if (this.buttons.has(button.id)) {
      const existing = this.buttons.get(button.id);
      existing.element.remove();
    }

    const displayValue =
      button.style.display && button.style.display !== 'none'
        ? button.style.display
        : 'inline-flex';

    const record = {
      element: button,
      order,
      owner,
      visible,
      displayValue,
    };

    button.dataset.order = String(order);
    button.dataset.panelOwner = owner || '';
    this.buttons.set(button.id, record);
    this.renderButtons(container);
    this.updateButtonElementVisibility(record);
    this.syncContainerVisibility();
  }

  /**
   * Remove a button
   */
  removeButton(buttonId) {
    if (this.buttons.has(buttonId)) {
      const { element } = this.buttons.get(buttonId);
      element.remove();
      this.buttons.delete(buttonId);
    }
    this.syncContainerVisibility();
  }

  setButtonVisibility(buttonId, visible) {
    const record = this.buttons.get(buttonId);
    if (!record) {
      return;
    }

    record.visible = visible;
    this.updateButtonElementVisibility(record);
    this.syncContainerVisibility();
  }

  setOwnerVisibility(owner, visible) {
    let changed = false;

    this.buttons.forEach(record => {
      if (record.owner === owner) {
        record.visible = visible;
        this.updateButtonElementVisibility(record);
        changed = true;
      }
    });

    if (changed) {
      this.syncContainerVisibility();
    }
  }

  hasVisibleButtons() {
    return Array.from(this.buttons.values()).some(record => record.visible);
  }

  renderButtons(container = this.container) {
    if (!container) {
      return;
    }

    Array.from(this.buttons.values())
      .sort((a, b) => a.order - b.order)
      .forEach(record => {
        record.element.dataset.order = String(record.order);
        container.appendChild(record.element);
      });
  }

  updateButtonElementVisibility(record) {
    if (!record?.element) {
      return;
    }

    if (record.visible) {
      record.element.style.display = record.displayValue;
      record.element.style.visibility = 'visible';
      record.element.style.pointerEvents = 'auto';
      return;
    }

    record.element.style.display = 'none';
    record.element.style.visibility = 'hidden';
    record.element.style.pointerEvents = 'none';
  }

  syncContainerVisibility() {
    if (!this.container) {
      return;
    }

    const shouldShowContainer = this.visible && this.hasVisibleButtons();
    applyFloatingVisibility(this.container, {
      visible: shouldShowContainer,
      opacity: this.isReady ? this.cachedOpacity : LOADING_OPACITY,
    });
  }

  /**
   * Setup visibility handling
   */
  setupVisibilityListener() {
    VisibilityManager.onVisibilityChange(isConversationPage => {
      this.visible = isConversationPage;

      if (this.container) {
        if (isConversationPage && this.hasVisibleButtons()) {
          applyFloatingVisibility(this.container, {
            visible: true,
            opacity: this.isReady ? this.cachedOpacity : LOADING_OPACITY,
          });

          // Reset ready state on new page (will be set again when data loads)
          this.isReady = false;
        } else {
          applyFloatingVisibility(this.container, {
            visible: false,
          });
        }
      }
    });
  }

  /**
   * Clear all (for cleanup)
   */
  destroy() {
    // Clear health check interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Clear navigation listener
    if (this.navigationUnsubscribe) {
      this.navigationUnsubscribe();
      this.navigationUnsubscribe = null;
    }

    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    this.buttons.clear();
    this.isReady = false;
    this.visible = false;
  }
}

// Singleton instance
export const panelManager = new PanelManager();
