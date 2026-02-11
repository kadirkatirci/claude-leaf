/**
 * EngagementTracker - Track user engagement metrics
 *
 * Measures:
 * - Feature breadth (how many different features user uses)
 * - Feature depth (how many actions per feature)
 * - Power user score (engagement intensity)
 */

import { trackEvent } from '../analytics/Analytics.js';
import { debugLog } from '../config/debug.js';

class EngagementTracker {
  constructor() {
    this.modulesUsed = new Set();
    this.actionsPerModule = new Map();
  }

  /**
   * Record a module/feature action
   */
  recordModuleAction(moduleName) {
    this.modulesUsed.add(moduleName);

    const count = this.actionsPerModule.get(moduleName) || 0;
    this.actionsPerModule.set(moduleName, count + 1);
  }

  /**
   * Send engagement summary (call on session end)
   */
  sendSummary() {
    if (this.modulesUsed.size === 0) {
      return; // No engagement, skip tracking
    }

    const totalModules = this.modulesUsed.size;
    const totalActions = Array.from(this.actionsPerModule.values()).reduce(
      (sum, count) => sum + count,
      0
    );

    // Power user score: modules used * avg actions per module
    // Higher = more engaged user
    const powerUserScore = Math.round(totalModules * (totalActions / Math.max(totalModules, 1)));

    trackEvent('user_engagement_summary', {
      modules_used_count: totalModules,
      feature_breadth: totalModules,
      power_user_score: powerUserScore,
      total_actions: totalActions,
    });

    debugLog(
      'engagement',
      `Summary: ${totalModules} modules, ${totalActions} actions, score=${powerUserScore}`
    );
  }

  /**
   * Reset stats (for new session)
   */
  reset() {
    this.modulesUsed.clear();
    this.actionsPerModule.clear();
  }

  /**
   * Get current stats
   */
  getStats() {
    return {
      modulesUsed: this.modulesUsed.size,
      totalActions: Array.from(this.actionsPerModule.values()).reduce(
        (sum, count) => sum + count,
        0
      ),
      modules: Array.from(this.actionsPerModule.entries()),
    };
  }
}

export const engagementTracker = new EngagementTracker();
export default engagementTracker;
