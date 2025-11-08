/**
 * FixedButtonMixin - Reusable mixin for modules with fixed sidebar buttons
 * Provides standardized visibility handling and button creation
 */

import VisibilityManager from '../utils/VisibilityManager.js';
import CounterBadge from '../components/primitives/CounterBadge.js';

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
    module.ensureButtonVisibility = this.createVisibilityEnsurer(module);
  }

  /**
   * Create visibility change handler
   */
  static createVisibilityHandler(module) {
    return function(isConversationPage) {
      // Always process visibility changes for robustness
      module.log(`Visibility change: conversation=${isConversationPage}, button exists=${!!this.fixedButton}`);

      // Store state
      this.lastConversationState = isConversationPage;

      // Update button visibility with multiple methods for stability
      if (this.fixedButton) {
        if (isConversationPage) {
          // Make visible - use multiple properties for robustness
          this.fixedButton.style.display = 'flex';
          this.fixedButton.style.visibility = 'visible';
          this.fixedButton.style.opacity = '0.9';
          this.fixedButton.style.pointerEvents = 'auto';
        } else {
          // Hide completely - use display:none for guaranteed hiding
          this.fixedButton.style.display = 'none';
          this.fixedButton.style.visibility = 'hidden';
          this.fixedButton.style.opacity = '0';
          this.fixedButton.style.pointerEvents = 'none';
        }
        module.log(`Button visibility set to: ${isConversationPage ? 'visible' : 'hidden'}`);
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
        counterColor = '#ef4444',
        opacity = null // Allow custom opacity, defaults to module setting or 0.9
      } = options;

      // Remove existing button if present
      if (this.fixedButton) {
        this.destroyFixedButton();
      }

      const theme = this.getTheme ? this.getTheme() : { primary: '#CC785C' };

      // Determine opacity: use provided, then setting, then default
      const buttonOpacity = opacity !== null
        ? opacity
        : (this.getSetting ? (this.getSetting('opacity') || 0.9) : 0.9);

      // Create button element
      const button = document.createElement('button');
      button.id = id;
      button.innerHTML = icon;
      button.title = tooltip || '';

      // Apply Claude native classes or custom styling based on theme
      if (theme.useNativeClasses) {
        // Use Claude's native classes (includes bg-bg-000/80 for neutral background)
        button.className = theme.buttonClasses || '';

        // Apply positioning and other necessary inline styles
        // DON'T override background - let buttonClasses handle it
        button.style.position = 'fixed';
        button.style.right = position.right;
        button.style.top = '50%';
        button.style.transform = position.transform;
        button.style.cursor = 'pointer';
        button.style.zIndex = '9999';
        button.style.color = 'white';
        button.style.overflow = 'visible'; // Override overflow-hidden from buttonClasses to show counter badge
      } else {
        // Custom theme - use inline styles (solid color, no gradient)
        Object.assign(button.style, {
          position: 'fixed',
          right: position.right,
          top: '50%',
          transform: position.transform,
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          background: theme.primary || '#CC785C',
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
          opacity: buttonOpacity.toString(),
          overflow: 'visible' // Allow counter badge to overflow
        });
      }

      // Add hover effect
      if (!theme.useNativeClasses) {
        // Custom theme hover effects
        button.addEventListener('mouseenter', () => {
          button.style.opacity = '1';
          button.style.transform = `${position.transform} scale(1.05)`;
        });

        button.addEventListener('mouseleave', () => {
          button.style.opacity = buttonOpacity.toString();
          button.style.transform = position.transform;
        });
      }
      // Native classes already have hover effects defined in buttonClasses

      // Add click handler
      if (onClick) {
        button.addEventListener('click', onClick.bind(this));
      }

      // Add counter badge if needed using CounterBadge component
      if (showCounter) {
        // Generate unique counter ID based on button ID
        const counterId = `${id}-counter`;

        this.buttonCounter = CounterBadge.attachTo(button, {
          id: counterId,
          content: '0',
          theme: theme,
          position: { top: -8, right: -8 },
          style: {
            display: 'none' // Start hidden, will show when count > 0
          }
        });
      }

      // Set initial visibility based on page type
      const isConversationPage = VisibilityManager.isOnConversationPage();
      if (!isConversationPage) {
        // Start hidden on non-conversation pages
        button.style.display = 'none';
        button.style.visibility = 'hidden';
        button.style.opacity = '0';
        button.style.pointerEvents = 'none';
        module.log(`Button created hidden (not on conversation page)`);
      } else {
        // Start visible on conversation pages
        button.style.display = 'flex';
        button.style.visibility = 'visible';
        button.style.opacity = buttonOpacity.toString();
        button.style.pointerEvents = 'auto';
        module.log(`Button created visible (on conversation page)`);
      }

      // Append to body for persistence
      document.body.appendChild(button);
      this.fixedButton = button;

      // Double-check visibility after DOM insertion
      setTimeout(() => {
        if (this.fixedButton) {
          this.handleVisibilityChange(VisibilityManager.isOnConversationPage());
        }
      }, 100);

      return button;
    }.bind(module);
  }

  /**
   * Create counter update function using CounterBadge component
   */
  static createCounterUpdater(module) {
    return function(count) {
      if (!this.buttonCounter) return;

      // Use CounterBadge.update which handles visibility automatically
      CounterBadge.update(this.buttonCounter, count);
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

      // Initial visibility check
      const isConversationPage = VisibilityManager.isOnConversationPage();
      this.handleVisibilityChange(isConversationPage);

      // Set up periodic visibility check for extra stability
      if (this.visibilityCheckInterval) {
        clearInterval(this.visibilityCheckInterval);
      }

      this.visibilityCheckInterval = setInterval(() => {
        this.ensureButtonVisibility();
      }, 2000); // Check every 2 seconds

      module.log('Visibility listener setup complete');
    }.bind(module);
  }

  /**
   * Create button destroyer
   */
  static createButtonDestroyer(module) {
    return function() {
      // Clean up button
      if (this.fixedButton) {
        this.fixedButton.remove();
        this.fixedButton = null;
        this.buttonCounter = null;
      }

      // Clean up visibility listener
      if (this.visibilityUnsubscribe) {
        this.visibilityUnsubscribe();
        this.visibilityUnsubscribe = null;
      }

      // Clean up visibility check interval
      if (this.visibilityCheckInterval) {
        clearInterval(this.visibilityCheckInterval);
        this.visibilityCheckInterval = null;
      }

      module.log('Fixed button and listeners destroyed');
    }.bind(module);
  }

  /**
   * Create visibility ensurer - periodically checks and fixes visibility state
   */
  static createVisibilityEnsurer(module) {
    return function() {
      if (!this.fixedButton) return;

      const isConversationPage = VisibilityManager.isOnConversationPage();
      const shouldBeVisible = isConversationPage;

      // Check current visibility state
      const isCurrentlyVisible = (
        this.fixedButton.style.display !== 'none' &&
        this.fixedButton.style.visibility !== 'hidden'
      );

      // Fix if there's a mismatch
      if (shouldBeVisible !== isCurrentlyVisible) {
        module.log(`Fixing button visibility mismatch: should be ${shouldBeVisible}, is ${isCurrentlyVisible}`);

        if (shouldBeVisible) {
          this.fixedButton.style.display = 'flex';
          this.fixedButton.style.visibility = 'visible';
          this.fixedButton.style.opacity = '0.9';
          this.fixedButton.style.pointerEvents = 'auto';
        } else {
          this.fixedButton.style.display = 'none';
          this.fixedButton.style.visibility = 'hidden';
          this.fixedButton.style.opacity = '0';
          this.fixedButton.style.pointerEvents = 'none';
        }
      }
    }.bind(module);
  }
}