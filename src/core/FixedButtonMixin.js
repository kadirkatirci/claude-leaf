/**
 * FixedButtonMixin - Reusable mixin for modules with fixed sidebar buttons
 * Provides standardized visibility handling and button creation
 *
 * v2.3.0 - Added loading state (dimmed until data loads)
 */

import VisibilityManager from '../utils/VisibilityManager.js';
import navigationInterceptor from './NavigationInterceptor.js';
import CounterBadge from '../components/primitives/CounterBadge.js';
import { eventBus, Events } from '../utils/EventBus.js';

// Loading state opacity (dimmed until data loads)
const LOADING_OPACITY = 0.3;

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
    module._isButtonReady = false; // Track if data has loaded
    module._targetOpacity = 0.7; // Target opacity when ready

    // Add standard methods
    module.handleVisibilityChange = this.createVisibilityHandler(module);
    module.createFixedButton = this.createButtonFactory(module);
    module.updateButtonCounter = this.createCounterUpdater(module);
    module.setupVisibilityListener = this.createVisibilitySetup(module);
    module.destroyFixedButton = this.createButtonDestroyer(module);
    module._markButtonReady = this.createReadyMarker(module);
    module._startHealthCheck = this.createHealthCheck(module);

    // Listen for MessageHub events to mark as ready
    this.setupReadyListener(module);
  }

  /**
   * Create health check function - ensures button state consistency
   */
  static createHealthCheck(module) {
    return function () {
      // Clear existing interval if any
      if (this._healthCheckInterval) {
        clearInterval(this._healthCheckInterval);
      }

      // Check every 2 seconds for state consistency
      this._healthCheckInterval = setInterval(() => {
        if (!this.fixedButton) {
          return;
        }

        // Check if button is still in DOM
        if (!document.body.contains(this.fixedButton)) {
          module.log('Health check: Button removed from DOM, cleaning up');
          this.fixedButton = null;
          this.buttonCounter = null;
          clearInterval(this._healthCheckInterval);
          this._healthCheckInterval = null;
          return;
        }

        // Verify visibility matches expected state
        const isConversationPage = VisibilityManager.isOnConversationPage();
        const currentDisplay = this.fixedButton.style.display;
        const expectedDisplay = isConversationPage ? 'flex' : 'none';

        if (currentDisplay !== expectedDisplay) {
          module.log('Health check: Fixing visibility mismatch');
          this.handleVisibilityChange(isConversationPage);
        }
      }, 2000);
    }.bind(module);
  }

  /**
   * Setup listener for MessageHub events
   */
  static setupReadyListener(module) {
    const markReady = () => {
      if (module._isButtonReady) {
        return;
      }
      module._markButtonReady();
    };

    // Listen to content change events
    eventBus.on(Events.HUB_CONTENT_CHANGED, markReady);
    eventBus.on(Events.HUB_MESSAGE_COUNT_CHANGED, markReady);

    // Also listen for navigation events to handle /new → conversation transitions
    module._navigationUnsubscribe = navigationInterceptor.onNavigate(event => {
      // When entering a conversation page from /new or elsewhere, reset ready state
      if (event.isConversationPage && !event.wasConversationPage) {
        module._isButtonReady = false;
        if (module.fixedButton && module.lastConversationState) {
          module.fixedButton.style.opacity = LOADING_OPACITY.toString();
        }
      }
    });
  }

  /**
   * Create function to mark button as ready (transition to full opacity)
   */
  static createReadyMarker(module) {
    return function () {
      if (this._isButtonReady) {
        return;
      }

      this._isButtonReady = true;

      // Transition to target opacity
      if (this.fixedButton && this.lastConversationState) {
        this.fixedButton.style.opacity = this._targetOpacity.toString();
      }
    }.bind(module);
  }

  /**
   * Create visibility change handler
   */
  static createVisibilityHandler(module) {
    return function (isConversationPage) {
      // Always process visibility changes for robustness
      module.log(
        `Visibility change: conversation=${isConversationPage}, button exists=${!!this.fixedButton}`
      );

      // Store state
      this.lastConversationState = isConversationPage;

      // Update button visibility with multiple methods for stability
      if (this.fixedButton) {
        if (isConversationPage) {
          // Make visible - use multiple properties for robustness
          this.fixedButton.style.display = 'flex';
          this.fixedButton.style.visibility = 'visible';
          this.fixedButton.style.pointerEvents = 'auto';

          // Use loading opacity if not ready, target opacity if ready
          const opacity = this._isButtonReady ? this._targetOpacity : LOADING_OPACITY;
          this.fixedButton.style.opacity = opacity.toString();

          // Reset ready state on new page navigation
          this._isButtonReady = false;
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
        // Update UI for conversation page with retry mechanism
        if (this.updateUI) {
          // Call immediately for fast response
          this.updateUI();

          // Also schedule a delayed update to catch late-loading content
          if (this.waitAndUpdateUI) {
            this.waitAndUpdateUI();
          } else {
            // Default retry mechanism if module doesn't have custom implementation
            setTimeout(() => {
              if (this.updateUI) {
                this.updateUI();
              }
            }, 500);
          }
        }
      }
    }.bind(module);
  }

  /**
   * Create standardized fixed button factory
   */
  static createButtonFactory(module) {
    return async function (options = {}) {
      const {
        id,
        icon,
        tooltip,
        position = { right: '30px', transform: 'translateY(0)' },
        onClick,
        showCounter = false,
        counterColor = '#ef4444',
        opacity = null, // Allow custom opacity, defaults to module setting or 0.9
      } = options;

      // Remove existing button if present
      if (this.fixedButton) {
        this.destroyFixedButton();
      }

      const theme = this.getTheme ? this.getTheme() : { primary: '#CC785C' };

      // Determine target opacity: use provided, then setting, then default
      const targetOpacity =
        opacity !== null
          ? opacity
          : this.getSetting
            ? (await this.getSetting('opacity')) || 0.7
            : 0.7;

      // Store target opacity for later use
      this._targetOpacity = targetOpacity;

      // Create button element
      const button = document.createElement('button');
      button.id = id;
      button.innerHTML = icon; // Use innerHTML to support SVG strings
      button.title = tooltip || '';

      // Use Claude's native classes (always)
      button.className = theme.buttonClasses || '';

      // Apply positioning and other necessary inline styles
      // Only use inline styles for positioning - everything else via classes
      button.style.position = 'fixed';
      button.style.right = position.right;
      button.style.top = '50%';
      button.style.transform = position.transform;
      button.style.zIndex = '9999';
      // button.style.color = 'white'; // Commented to allow currentColor in SVGs to adapt
      button.style.overflow = 'visible'; // Override overflow-hidden from buttonClasses to show counter badge
      button.style.transition = 'opacity 0.3s ease'; // Smooth transition when ready

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
            display: 'none', // Start hidden, will show when count > 0
          },
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
        // Start visible but dimmed (loading state) on conversation pages
        button.style.display = 'flex';
        button.style.visibility = 'visible';
        button.style.pointerEvents = 'auto';
        // Use loading opacity - will transition to target when data loads
        button.style.opacity = LOADING_OPACITY.toString();
        module.log(`Button created in loading state (on conversation page)`);
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

      // Start health check for state consistency
      if (this._startHealthCheck) {
        this._startHealthCheck();
      }

      return button;
    }.bind(module);
  }

  /**
   * Create counter update function using CounterBadge component
   */
  static createCounterUpdater(module) {
    return function (count) {
      if (!this.buttonCounter) {
        return;
      }

      // Use CounterBadge.update which handles visibility automatically
      CounterBadge.update(this.buttonCounter, count);
    }.bind(module);
  }

  /**
   * Create visibility listener setup
   */
  static createVisibilitySetup(module) {
    return function () {
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

      // Instead of polling, rely on VisibilityManager's event-driven updates
      // and DOM observer for any edge cases

      module.log('Visibility listener setup complete');
    }.bind(module);
  }

  /**
   * Create button destroyer
   */
  static createButtonDestroyer(module) {
    return function () {
      // Clean up health check interval
      if (this._healthCheckInterval) {
        clearInterval(this._healthCheckInterval);
        this._healthCheckInterval = null;
      }

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

      // Clean up navigation listener
      if (this._navigationUnsubscribe) {
        this._navigationUnsubscribe();
        this._navigationUnsubscribe = null;
      }

      // Reset state
      this._isButtonReady = false;

      module.log('Fixed button and listeners destroyed');
    }.bind(module);
  }
}
