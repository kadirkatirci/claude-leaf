/**
 * ButtonFactory - Unified button creation and management
 *
 * Centralizes all button creation logic, eliminating duplicate code across modules.
 * Provides consistent button behavior, styling, and lifecycle management.
 *
 * Features:
 * - Standardized fixed button creation
 * - Hover button management
 * - Counter/badge support
 * - Visibility management
 * - Event handling
 * - Memory-efficient cleanup
 */

import domManager from '../managers/DOMManager.js';
import asyncManager from '../managers/AsyncManager.js';
import settingsCache from '../core/SettingsCache.js';
import { getThemeColors } from '../config/themes.js';

class ButtonFactory {
  constructor() {
    this.buttons = new Map(); // buttonId -> buttonInfo
    this.hoverHandlers = new WeakMap(); // element -> cleanup function
    this.visibilityTimers = new Map(); // buttonId -> timerId
    this.debugMode = false;
  }

  /**
   * Create a fixed button
   * @param {Object} options - Button configuration
   * @returns {HTMLElement} Created button
   */
  createFixedButton(options = {}) {
    const {
      id = `button-${Date.now()}`,
      icon = '🔘',
      title = '',
      position = {},
      onClick = null,
      showCounter = false,
      // counterValue reserved for initial counter state
      className = '',
      zIndex = 10000,
      visible = true,
    } = options;

    // Check if button already exists
    if (this.buttons.has(id)) {
      console.warn(`[ButtonFactory] Button with id '${id}' already exists`);
      return this.buttons.get(id).element;
    }

    // Get theme settings
    const theme = settingsCache.getTheme();
    const customColor = settingsCache.getCustomColor();
    const opacity = settingsCache.getOpacity();
    const themeColors = getThemeColors(theme, customColor);

    // Create button container
    const container = domManager.createElement('div', {
      id,
      className: `claude-productivity-button ${className}`,
      title,
      style: {
        position: 'fixed',
        right: position.right || '30px',
        top: position.top || '50%',
        transform: position.transform || 'translateY(-50%)',
        zIndex: zIndex,
        cursor: 'pointer',
        opacity: opacity.toString(),
        display: visible ? 'flex' : 'none',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '5px',
        transition: 'opacity 0.3s ease',
        ...position,
      },
    });

    // Create button element
    const button = domManager.createElement(
      'button',
      {
        className: 'claude-productivity-button-main',
        style: {
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          border: 'none',
          backgroundColor: themeColors.primary,
          color: 'white',
          fontSize: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
        },
      },
      icon
    );

    // Add hover effect
    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = themeColors.hover;
      button.style.transform = 'scale(1.05)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = themeColors.primary;
      button.style.transform = 'scale(1)';
    });

    // Add click handler
    if (onClick) {
      button.addEventListener('click', e => {
        e.stopPropagation();
        try {
          onClick(e);
        } catch (error) {
          console.error(`[ButtonFactory] Error in button click handler for '${id}':`, error);
        }
      });
    }

    container.appendChild(button);

    // Add counter if needed
    let counterElement = null;
    if (showCounter) {
      counterElement = this.createCounter(themeColors);
      container.appendChild(counterElement);
    }

    // Store button info
    this.buttons.set(id, {
      element: container,
      button,
      counter: counterElement,
      options,
      visible,
    });

    // Append to body
    document.body.appendChild(container);

    if (this.debugMode) {
      console.log(`[ButtonFactory] Created fixed button: ${id}`);
    }

    return container;
  }

  /**
   * Create a counter element
   * @param {Object} themeColors - Theme colors
   * @returns {HTMLElement} Counter element
   */
  createCounter(themeColors) {
    return domManager.createElement(
      'div',
      {
        className: 'claude-productivity-counter',
        style: {
          minWidth: '30px',
          height: '20px',
          padding: '2px 6px',
          borderRadius: '10px',
          backgroundColor: themeColors.primary,
          color: 'white',
          fontSize: '11px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
        },
      },
      '0'
    );
  }

  /**
   * Update button counter
   * @param {string} buttonId - Button ID
   * @param {number|string} value - Counter value
   */
  updateCounter(buttonId, value) {
    const buttonInfo = this.buttons.get(buttonId);
    if (!buttonInfo || !buttonInfo.counter) {
      return;
    }

    buttonInfo.counter.textContent = value.toString();
  }

  /**
   * Create a hover button for messages
   * @param {HTMLElement} messageElement - Message element
   * @param {Object} options - Button options
   * @returns {HTMLElement} Created button
   */
  createHoverButton(messageElement, options = {}) {
    const {
      icon = '➕',
      title = '',
      onClick = null,
      position = {},
      className = '',
      persistWhen = null, // Function that returns true when button should stay visible
      hoverDelay = 100,
    } = options;

    // Create button
    const button = domManager.createElement(
      'button',
      {
        className: `claude-productivity-hover-button ${className}`,
        title,
        style: {
          position: 'absolute',
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          border: 'none',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          color: 'white',
          fontSize: '16px',
          display: 'none',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          zIndex: 1000,
          ...position,
        },
      },
      icon
    );

    // Add click handler
    if (onClick) {
      button.addEventListener('click', e => {
        e.stopPropagation();
        try {
          onClick(e, messageElement);
        } catch (error) {
          console.error('[ButtonFactory] Error in hover button click:', error);
        }
      });
    }

    // Position button
    messageElement.style.position = 'relative';
    messageElement.appendChild(button);

    // Setup hover behavior
    const cleanup = this.setupHoverBehavior(messageElement, button, {
      persistWhen,
      hoverDelay,
    });

    // Store cleanup function
    this.hoverHandlers.set(messageElement, cleanup);

    return button;
  }

  /**
   * Setup hover behavior for a button
   * @param {HTMLElement} container - Container element
   * @param {HTMLElement} button - Button element
   * @param {Object} options - Hover options
   * @returns {Function} Cleanup function
   */
  setupHoverBehavior(container, button, options = {}) {
    const { persistWhen = null, hoverDelay = 100 } = options;

    let hoverTimeout = null;
    let isHovering = false;
    let bounds = null;

    const shouldShowButton = () => {
      if (persistWhen && persistWhen()) {
        return true;
      }
      return isHovering;
    };

    const updateBounds = () => {
      const rect = container.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      bounds = {
        left: Math.min(rect.left, buttonRect.left) - 10,
        right: Math.max(rect.right, buttonRect.right) + 10,
        top: Math.min(rect.top, buttonRect.top) - 10,
        bottom: Math.max(rect.bottom, buttonRect.bottom) + 10,
      };
    };

    const showButton = () => {
      button.style.display = 'flex';
      updateBounds();
    };

    const hideButton = () => {
      if (!shouldShowButton()) {
        button.style.display = 'none';
      }
    };

    const handleMouseEnter = () => {
      isHovering = true;
      if (hoverTimeout) {
        asyncManager.clearTimer(hoverTimeout);
      }
      hoverTimeout = asyncManager.setTimeout(
        () => {
          showButton();
        },
        hoverDelay,
        `Hover delay for button`
      );
    };

    const handleMouseLeave = e => {
      updateBounds();
      const x = e.clientX;
      const y = e.clientY;

      if (
        bounds &&
        x >= bounds.left &&
        x <= bounds.right &&
        y >= bounds.top &&
        y <= bounds.bottom
      ) {
        return; // Still within bounds
      }

      isHovering = false;
      if (hoverTimeout) {
        asyncManager.clearTimer(hoverTimeout);
        hoverTimeout = null;
      }
      asyncManager.setTimeout(
        () => {
          hideButton();
        },
        100,
        'Hide button delay'
      );
    };

    const handleMouseMove = e => {
      if (!isHovering) {
        return;
      }

      updateBounds();
      const x = e.clientX;
      const y = e.clientY;

      if (bounds && (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom)) {
        isHovering = false;
        hideButton();
      }
    };

    // Attach event listeners
    container.addEventListener('mouseenter', handleMouseEnter);
    container.addEventListener('mouseleave', handleMouseLeave);
    container.addEventListener('mousemove', handleMouseMove);
    button.addEventListener('mouseenter', () => {
      isHovering = true;
    });
    button.addEventListener('mouseleave', handleMouseLeave);

    // Check initial state
    if (shouldShowButton()) {
      showButton();
    }

    // Return cleanup function
    return () => {
      container.removeEventListener('mouseenter', handleMouseEnter);
      container.removeEventListener('mouseleave', handleMouseLeave);
      container.removeEventListener('mousemove', handleMouseMove);
      if (hoverTimeout) {
        asyncManager.clearTimer(hoverTimeout);
      }
    };
  }

  /**
   * Create a badge for messages
   * @param {HTMLElement} messageElement - Message element
   * @param {Object} options - Badge options
   * @returns {HTMLElement} Created badge
   */
  createBadge(messageElement, options = {}) {
    const {
      content = '',
      title = '',
      position = {},
      className = '',
      onClick = null,
      style = {},
    } = options;

    const badge = domManager.createElement(
      'div',
      {
        className: `claude-productivity-badge ${className}`,
        title,
        style: {
          position: 'absolute',
          padding: '4px 8px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: 'bold',
          cursor: onClick ? 'pointer' : 'default',
          transition: 'all 0.2s ease',
          zIndex: 100,
          ...style,
          ...position,
        },
      },
      content
    );

    if (onClick) {
      badge.addEventListener('click', e => {
        e.stopPropagation();
        try {
          onClick(e, messageElement);
        } catch (error) {
          console.error('[ButtonFactory] Error in badge click:', error);
        }
      });
    }

    // Position badge
    messageElement.style.position = 'relative';
    messageElement.appendChild(badge);

    return badge;
  }

  /**
   * Show/hide button
   * @param {string} buttonId - Button ID
   * @param {boolean} visible - Visibility state
   */
  setButtonVisibility(buttonId, visible) {
    const buttonInfo = this.buttons.get(buttonId);
    if (!buttonInfo) {
      return;
    }

    buttonInfo.element.style.display = visible ? 'flex' : 'none';
    buttonInfo.visible = visible;

    if (this.debugMode) {
      console.log(`[ButtonFactory] Button '${buttonId}' visibility: ${visible}`);
    }
  }

  /**
   * Update button theme
   * @param {string} buttonId - Button ID
   */
  updateButtonTheme(buttonId) {
    const buttonInfo = this.buttons.get(buttonId);
    if (!buttonInfo) {
      return;
    }

    const theme = settingsCache.getTheme();
    const customColor = settingsCache.getCustomColor();
    const opacity = settingsCache.getOpacity();
    const themeColors = getThemeColors(theme, customColor);

    buttonInfo.button.style.backgroundColor = themeColors.primary;
    buttonInfo.element.style.opacity = opacity.toString();

    if (buttonInfo.counter) {
      buttonInfo.counter.style.backgroundColor = themeColors.primary;
    }
  }

  /**
   * Remove button
   * @param {string} buttonId - Button ID
   */
  removeButton(buttonId) {
    const buttonInfo = this.buttons.get(buttonId);
    if (!buttonInfo) {
      return;
    }

    // Clear visibility timer if exists
    if (this.visibilityTimers.has(buttonId)) {
      asyncManager.clearTimer(this.visibilityTimers.get(buttonId));
      this.visibilityTimers.delete(buttonId);
    }

    // Remove from DOM
    domManager.removeElement(buttonInfo.element);

    // Remove from map
    this.buttons.delete(buttonId);

    if (this.debugMode) {
      console.log(`[ButtonFactory] Removed button: ${buttonId}`);
    }
  }

  /**
   * Remove hover button
   * @param {HTMLElement} messageElement - Message element
   */
  removeHoverButton(messageElement) {
    const cleanup = this.hoverHandlers.get(messageElement);
    if (cleanup) {
      cleanup();
      this.hoverHandlers.delete(messageElement);
    }

    // Remove button from DOM
    const button = messageElement.querySelector('.claude-productivity-hover-button');
    if (button) {
      domManager.removeElement(button);
    }
  }

  /**
   * Update all button themes
   */
  updateAllThemes() {
    for (const buttonId of this.buttons.keys()) {
      this.updateButtonTheme(buttonId);
    }
  }

  /**
   * Get button element
   * @param {string} buttonId - Button ID
   * @returns {HTMLElement|null} Button element
   */
  getButton(buttonId) {
    const buttonInfo = this.buttons.get(buttonId);
    return buttonInfo ? buttonInfo.element : null;
  }

  /**
   * Get all buttons
   * @returns {Map} All buttons
   */
  getAllButtons() {
    return new Map(this.buttons);
  }

  /**
   * Clear all buttons
   */
  clearAll() {
    // Clear visibility timers
    for (const timerId of this.visibilityTimers.values()) {
      asyncManager.clearTimer(timerId);
    }
    this.visibilityTimers.clear();

    // Remove all buttons
    for (const buttonId of this.buttons.keys()) {
      this.removeButton(buttonId);
    }

    // Clear hover handlers
    this.hoverHandlers = new WeakMap();

    if (this.debugMode) {
      console.log('[ButtonFactory] Cleared all buttons');
    }
  }

  /**
   * Set debug mode
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
  }

  /**
   * Get statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      fixedButtons: this.buttons.size,
      visibilityTimers: this.visibilityTimers.size,
    };
  }
}

// Export as singleton
const buttonFactory = new ButtonFactory();
export default buttonFactory;
