/**
 * PanelManager - Shared navigation panel for all modules
 * 
 * Manages the floating action panel (#claude-nav-container).
 * Ensures the panel exists if ANY module needs it, even if NavigationModule is disabled.
 * Handles visibility and button management.
 */

import DOMUtils from '../utils/DOMUtils.js';
import VisibilityManager from '../utils/VisibilityManager.js';
import { MODULE_CONSTANTS } from '../config/ModuleConstants.js';
import { eventBus, Events } from '../utils/EventBus.js';

const NAV_CONFIG = MODULE_CONSTANTS.navigation;

// Loading state opacity (dimmed until data loads)
const LOADING_OPACITY = 0.3;

class PanelManager {
    constructor() {
        this.container = null;
        this.buttons = new Map(); // id -> element
        this.visible = false;
        this.cachedOpacity = NAV_CONFIG.opacity || 0.7;
        this.isReady = false; // Track if initial data has loaded
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
                    console.log('[PanelManager] Health check: Container missing, recreating...');
                    this.createContainer();
                }
                return;
            }

            // Verify visibility matches expected state
            const isConversationPage = VisibilityManager.isOnConversationPage();
            const currentDisplay = this.container.style.display;
            const expectedDisplay = isConversationPage ? 'flex' : 'none';

            if (currentDisplay !== expectedDisplay) {
                console.log('[PanelManager] Health check: Fixing visibility mismatch');
                if (isConversationPage) {
                    this.container.style.display = 'flex';
                    this.container.style.visibility = 'visible';
                    this.container.style.pointerEvents = 'auto';
                    this.container.style.opacity = this.isReady ? this.cachedOpacity : LOADING_OPACITY;
                } else {
                    this.container.style.display = 'none';
                    this.container.style.visibility = 'hidden';
                    this.container.style.opacity = '0';
                    this.container.style.pointerEvents = 'none';
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
            if (this.isReady) return; // Already ready

            this.isReady = true;

            // Transition to normal opacity
            if (this.container && this.visible) {
                this.container.style.opacity = this.cachedOpacity;
            }
        };

        // Listen to both events - whichever fires first
        eventBus.on(Events.HUB_CONTENT_CHANGED, markReady);
        eventBus.on(Events.HUB_MESSAGE_COUNT_CHANGED, markReady);
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

        // Start with loading opacity until data is ready
        const initialOpacity = this.isReady ? this.cachedOpacity : LOADING_OPACITY;

        this.container = DOMUtils.createElement('div', {
            id: 'claude-nav-container',
            className: 'claude-nav-buttons',
            'data-nav-container': 'true',
            style: {
                position: 'fixed',
                [position]: '30px',
                bottom: '100px',
                zIndex: '9999',
                display: isConversationPage ? 'flex' : 'none',
                flexDirection: 'column',
                gap: '8px',
                opacity: initialOpacity,
                transition: 'opacity 0.3s ease', // Smooth transition when ready
                visibility: isConversationPage ? 'visible' : 'hidden',
            }
        });

        // Hover effect
        this.container.addEventListener('mouseenter', () => {
            this.container.style.opacity = '1';
        });
        this.container.addEventListener('mouseleave', () => {
            this.container.style.opacity = this.cachedOpacity;
        });

        document.body.appendChild(this.container);

        // Re-append existing buttons if any (in case of recreation)
        this.buttons.forEach((btn) => {
            this.container.appendChild(btn);
        });

        return this.container;
    }

    /**
     * Add a button to the panel
     * @param {HTMLElement} button - Button element
     * @param {number} [order=0] - Order index (lower is higher up)
     */
    addButton(button, order = 0) {
        const container = this.getContainer();
        button.dataset.order = order;
        this.buttons.set(button.id, button);

        // Insert in correct order
        const existingButtons = Array.from(container.children);
        let inserted = false;

        for (const existing of existingButtons) {
            const existingOrder = parseInt(existing.dataset.order || '0');
            if (order < existingOrder) {
                container.insertBefore(button, existing);
                inserted = true;
                break;
            }
        }

        if (!inserted) {
            container.appendChild(button);
        }
    }

    /**
     * Remove a button
     */
    removeButton(buttonId) {
        if (this.buttons.has(buttonId)) {
            const btn = this.buttons.get(buttonId);
            btn.remove();
            this.buttons.delete(buttonId);
        }

        // Auto-hide container if empty? Maybe not, keep it stable.
    }

    /**
     * Setup visibility handling
     */
    setupVisibilityListener() {
        VisibilityManager.onVisibilityChange((isConversationPage) => {
            this.visible = isConversationPage;

            if (this.container) {
                if (isConversationPage) {
                    // Show container
                    this.container.style.display = 'flex';
                    this.container.style.visibility = 'visible';
                    this.container.style.pointerEvents = 'auto';

                    // Use loading opacity if not ready yet, otherwise cached opacity
                    this.container.style.opacity = this.isReady ? this.cachedOpacity : LOADING_OPACITY;

                    // Reset ready state on new page (will be set again when data loads)
                    this.isReady = false;
                } else {
                    // Hide container
                    this.container.style.display = 'none';
                    this.container.style.visibility = 'hidden';
                    this.container.style.opacity = '0';
                    this.container.style.pointerEvents = 'none';
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
