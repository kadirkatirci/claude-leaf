/**
 * FixedButtonMixin - Reusable mixin for modules with fixed sidebar buttons
 * Provides standardized visibility handling and button creation
 */

import VisibilityManager from '../utils/VisibilityManager.js';

export default class FixedButtonMixin {
  /**
   * Initialize fixed button functionality
   * @param {Object} module - The module instance to enhance
   */
  static enhance(module) {
    // Add standard properties
    module.lastConversationState = null;
    module.fixedButton = null;
    module.buttonCounter = null;

    // Add standard methods
    module.handleVisibilityChange = this.createVisibilityHandler(module);
    module.createFixedButton = this.createButtonFactory(module);
    module.updateButtonCounter = this.createCounterUpdater(module);
    module.setupVisibilityListener = this.createVisibilitySetup(module);
    module.destroyFixedButton = this.createButtonDestroyer(module);
  }

  /**
   * Create visibility change handler
   */
  static createVisibilityHandler(module) {
    return function(isConversationPage) {
      // Prevent redundant updates
      if (this.lastConversationState === isConversationPage) return;
      this.lastConversationState = isConversationPage;

      // Update button visibility
      if (this.fixedButton) {
        VisibilityManager.setElementVisibility(this.fixedButton, isConversationPage);
      }

      // Handle page-specific logic
      if (!isConversationPage) {
        // Clear UI elements but keep the button
        if (this.clearUIElements) {
          this.clearUIElements();
        }
      } else {
        // Update UI for conversation page
        if (this.updateUI) {
          this.updateUI();
        }
      }
    }.bind(module);
  }

  /**
   * Create standardized fixed button factory
   */
  static createButtonFactory(module) {
    return function(options = {}) {
      const {
        id,
        icon,
        tooltip,
        position = { right: '30px', transform: 'translateY(0)' },
        onClick,
        showCounter = false,
        counterColor = '#ef4444'
      } = options;

      // Remove existing button if present
      if (this.fixedButton) {
        this.destroyFixedButton();
      }

      const theme = this.getTheme ? this.getTheme() : { gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' };

      // Create button element
      const button = document.createElement('button');
      button.id = id;
      button.innerHTML = icon;
      button.title = tooltip || '';

      // Apply standardized styling
      Object.assign(button.style, {
        position: 'fixed',
        right: position.right,
        top: '50%',
        transform: position.transform,
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: theme.gradient,
        border: 'none',
        cursor: 'pointer',
        zIndex: '9999',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '20px',
        color: 'white',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        transition: 'all 0.3s ease',
        opacity: '0.9'
      });

      // Add hover effect
      button.addEventListener('mouseenter', () => {
        button.style.opacity = '1';
        button.style.transform = `${position.transform} scale(1.05)`;
      });

      button.addEventListener('mouseleave', () => {
        button.style.opacity = '0.9';
        button.style.transform = position.transform;
      });

      // Add click handler
      if (onClick) {
        button.addEventListener('click', onClick.bind(this));
      }

      // Add counter badge if needed
      if (showCounter) {
        const counter = document.createElement('div');
        counter.style.cssText = `
          position: absolute;
          top: -5px;
          right: -5px;
          background: ${counterColor};
          color: white;
          fontSize: 11px;
          fontWeight: bold;
          padding: 2px 6px;
          borderRadius: 10px;
          minWidth: 18px;
          textAlign: center;
          display: none;
        `;
        button.appendChild(counter);
        this.buttonCounter = counter;
      }

      // Set initial visibility
      const isConversationPage = VisibilityManager.isOnConversationPage();
      if (!isConversationPage) {
        VisibilityManager.setElementVisibility(button, false);
      }

      // Append to body for persistence
      document.body.appendChild(button);
      this.fixedButton = button;

      return button;
    }.bind(module);
  }

  /**
   * Create counter update function
   */
  static createCounterUpdater(module) {
    return function(count) {
      if (!this.buttonCounter) return;

      const shouldShow = count > 0;
      const currentText = this.buttonCounter.textContent;
      const newText = count.toString();

      // Only update if changed
      if (currentText !== newText) {
        this.buttonCounter.textContent = newText;
      }

      // Only update visibility if changed
      const isVisible = this.buttonCounter.style.display !== 'none';
      if (shouldShow !== isVisible) {
        this.buttonCounter.style.display = shouldShow ? 'block' : 'none';
      }
    }.bind(module);
  }

  /**
   * Create visibility listener setup
   */
  static createVisibilitySetup(module) {
    return function() {
      // Subscribe to visibility changes
      if (this.visibilityUnsubscribe) {
        this.visibilityUnsubscribe();
      }

      this.visibilityUnsubscribe = VisibilityManager.onVisibilityChange(
        this.handleVisibilityChange
      );
    }.bind(module);
  }

  /**
   * Create button destroyer
   */
  static createButtonDestroyer(module) {
    return function() {
      if (this.fixedButton) {
        this.fixedButton.remove();
        this.fixedButton = null;
        this.buttonCounter = null;
      }
    }.bind(module);
  }
}