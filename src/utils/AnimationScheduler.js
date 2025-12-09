/**
 * AnimationScheduler - Batch visual updates using requestAnimationFrame
 *
 * Prevents layout thrashing by batching DOM style updates into a single
 * animation frame, ensuring smooth 60fps visual updates.
 *
 * Usage:
 *   import { scheduleVisualUpdate } from './AnimationScheduler.js';
 *
 *   scheduleVisualUpdate(() => {
 *     element.style.opacity = '0.5';
 *     element.style.transform = 'scale(1.1)';
 *   });
 */

class AnimationScheduler {
  constructor() {
    this.pendingUpdates = new Set();
    this.rafId = null;
  }

  /**
   * Schedule a visual update to run in the next animation frame
   * @param {Function} updateFn - Function containing DOM updates
   * @param {string} [id] - Optional ID to deduplicate updates
   */
  schedule(updateFn, id = null) {
    // If ID provided, remove previous update with same ID
    if (id) {
      this.pendingUpdates.forEach(item => {
        if (item.id === id) {
          this.pendingUpdates.delete(item);
        }
      });
    }

    this.pendingUpdates.add({ updateFn, id });

    // Schedule RAF if not already scheduled
    if (!this.rafId) {
      this.rafId = requestAnimationFrame(() => {
        this.flush();
      });
    }
  }

  /**
   * Execute all pending updates
   */
  flush() {
    const updates = Array.from(this.pendingUpdates);
    this.pendingUpdates.clear();
    this.rafId = null;

    // Execute all updates in a single frame
    updates.forEach(({ updateFn }) => {
      try {
        updateFn();
      } catch (error) {
        console.error('[AnimationScheduler] Update failed:', error);
      }
    });
  }

  /**
   * Cancel all pending updates
   */
  cancel() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.pendingUpdates.clear();
  }

  /**
   * Get number of pending updates
   */
  getPendingCount() {
    return this.pendingUpdates.size;
  }
}

// Singleton instance
const scheduler = new AnimationScheduler();

/**
 * Schedule a visual update
 * @param {Function} updateFn - Function containing DOM updates
 * @param {string} [id] - Optional ID to deduplicate updates
 */
export function scheduleVisualUpdate(updateFn, id = null) {
  scheduler.schedule(updateFn, id);
}

/**
 * Flush all pending updates immediately
 */
export function flushVisualUpdates() {
  scheduler.flush();
}

/**
 * Cancel all pending updates
 */
export function cancelVisualUpdates() {
  scheduler.cancel();
}

/**
 * Get pending update count (for debugging)
 */
export function getPendingVisualUpdates() {
  return scheduler.getPendingCount();
}

// Debug access
if (typeof window !== 'undefined') {
  window.__animationScheduler = scheduler;
}

export default scheduler;
