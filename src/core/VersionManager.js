/**
 * VersionManager - Shared version detection logic
 * 
 * Replaces the detection part of EditScanner.
 * Allows modules (Bookmarks, EmojiMarkers) to detect version changes
 * without depending on EditHistoryModule being enabled.
 */

import DOMUtils from '../utils/DOMUtils.js';

class VersionManager {
    constructor() {
        this.callbacks = new Set();
        this.isScanning = false;
        this.observer = null;
        this.observerTimeout = null;

        // State
        this.lastEditData = new Map(); // containerId -> versionInfo
        this.lastCount = 0;
    }

    /**
     * Initialize and start scanning
     */
    start() {
        if (this.isScanning) return;

        this.isScanning = true;
        console.log('[VersionManager] 🚀 Started');

        // Initial scan
        setTimeout(() => this.scan(), 500);

        // Observe DOM for changes
        this.observer = DOMUtils.observeDOM(() => {
            // Debounce scan
            clearTimeout(this.observerTimeout);
            this.observerTimeout = setTimeout(() => this.scan(), 200);
        });
    }

    /**
     * Stop scanning
     */
    stop() {
        this.isScanning = false;
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        if (this.observerTimeout) {
            clearTimeout(this.observerTimeout);
        }
        console.log('[VersionManager] 🛑 Stopped');
    }

    /**
     * Register for changes
     */
    onVersionChange(callback) {
        this.callbacks.add(callback);
        return () => this.callbacks.delete(callback);
    }

    /**
     * Scan for version changes
     */
    async scan() {
        if (!this.isScanning) return;

        try {
            // Find all edited prompts
            // We assume DOMUtils.getEditedPrompts() is safe and robust
            // Note: If EditHistoryModule has specific logic for finding prompts, 
            // it might be better to move that logic to DOMUtils if not already there.
            // Assuming DOMUtils.getEditedPrompts exists and works.

            const editedPrompts = DOMUtils.getEditedPrompts ? DOMUtils.getEditedPrompts() : [];

            // Build current map
            const currentEditData = new Map();
            editedPrompts.forEach(edit => {
                currentEditData.set(edit.containerId, edit.versionInfo);
            });

            // Detect changes
            let hasChanges = false;
            let changeReason = '';

            // 1. Check count
            if (currentEditData.size !== this.lastEditData.size) {
                hasChanges = true;
                changeReason = `Count changed: ${this.lastEditData.size} -> ${currentEditData.size}`;
            }

            // 2. Check for version updates
            if (!hasChanges) {
                for (const [id, version] of currentEditData.entries()) {
                    const lastVersion = this.lastEditData.get(id);
                    if (lastVersion !== version) {
                        hasChanges = true;
                        changeReason = `Version changed: ${id} (${lastVersion} -> ${version})`;
                        break;
                    }
                }
            }

            if (hasChanges) {
                // Update state
                this.lastEditData = currentEditData;
                this.lastCount = editedPrompts.length;

                // Wait for DOM to stabilize (important for markers)
                await this.waitForDOMStabilization();

                console.log(`[VersionManager] 📡 Change detected: ${changeReason}`);

                // Notify subscribers
                this.notifySubscribers({
                    reason: changeReason,
                    edits: editedPrompts,
                    isVersionChange: true // Simplified, assumes any change implies re-check needed
                });
            }

        } catch (error) {
            console.error('[VersionManager] Scan failed:', error);
        }
    }

    /**
     * Notify all listeners
     */
    notifySubscribers(data) {
        this.callbacks.forEach(cb => {
            try {
                cb(data);
            } catch (err) {
                console.error('[VersionManager] Callback error:', err);
            }
        });
    }

    /**
     * Wait for DOM to stabilize (UI rendering)
     */
    async waitForDOMStabilization() {
        return new Promise(resolve => {
            setTimeout(resolve, 300); // Simple delay usually works better than complex polling
        });
    }
}

// Singleton
export const versionManager = new VersionManager();
