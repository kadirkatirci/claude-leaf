/**
 * FrustrationDetector - Detect user frustration patterns
 *
 * Patterns detected:
 * - Rapid repeated actions (5+ clicks in 2 seconds)
 * - Feature toggling (enable/disable repeatedly)
 */

import { trackEvent } from '../analytics/Analytics.js';
import { debugLog } from '../config/debug.js';

const RAPID_CLICK_THRESHOLD = 5; // 5 clicks
const RAPID_CLICK_WINDOW_MS = 2000; // Within 2 seconds

class FrustrationDetector {
  constructor() {
    this.recentActions = [];
  }

  /**
   * Record an action (click, keyboard, toggle, etc.)
   */
  recordAction(actionType) {
    const now = Date.now();
    this.recentActions.push({ type: actionType, timestamp: now });

    // Clean old actions outside window
    this.recentActions = this.recentActions.filter(
      action => now - action.timestamp < RAPID_CLICK_WINDOW_MS
    );

    // Detect rapid actions
    if (this.recentActions.length >= RAPID_CLICK_THRESHOLD) {
      // Find dominant action type
      const actionCounts = {};
      this.recentActions.forEach(action => {
        actionCounts[action.type] = (actionCounts[action.type] || 0) + 1;
      });

      const dominantAction = Object.entries(actionCounts).sort(([, a], [, b]) => b - a)[0];

      if (dominantAction && dominantAction[1] >= RAPID_CLICK_THRESHOLD) {
        trackEvent('rapid_action_detected', {
          action_type: dominantAction[0],
          action_count: dominantAction[1],
          time_window_ms: RAPID_CLICK_WINDOW_MS,
        });

        debugLog(
          'frustration',
          `Rapid action detected: ${dominantAction[0]} (${dominantAction[1]} times)`
        );

        // Reset to avoid spam
        this.recentActions = [];
      }
    }
  }

  /**
   * Reset action tracking
   */
  reset() {
    this.recentActions = [];
  }
}

export const frustrationDetector = new FrustrationDetector();
export default frustrationDetector;
