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

const NAV_CONFIG = MODULE_CONSTANTS.navigation;

class PanelManager {
    constructor() {
        this.container = null;
        this.buttons = new Map(); // id -> element
        this.visible = false;
        this.cachedOpacity = NAV_CONFIG.opacity || 0.7;
    }

    /**
     * Initialize the panel manager
     */
    init() {
        this.setupVisibilityListener();
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
                opacity: this.cachedOpacity,
                transition: 'opacity 0.2s ease',
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
            if (this.container) {
                VisibilityManager.setElementVisibility(this.container, isConversationPage);
                this.visible = isConversationPage;
            }
        });
    }

    /**
     * Clear all (for cleanup)
     */
    destroy() {
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
        this.buttons.clear();
    }
}

// Singleton instance
export const panelManager = new PanelManager();
