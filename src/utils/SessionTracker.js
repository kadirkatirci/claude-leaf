/**
 * SessionTracker - Track session lifecycle and metrics
 *
 * Tracks:
 * - Session start/end events
 * - Action counting
 * - Browser/OS context detection
 * - Session duration
 */

import { trackEvent } from '../analytics/Analytics.js';
import { debugLog } from '../config/debug.js';

class SessionTracker {
  constructor() {
    this.sessionStartTime = null;
    this.actionCount = 0;
    this.sessionEnded = false;
  }

  /**
   * Start tracking session
   */
  start() {
    if (this.sessionStartTime) {
      return;
    } // Already started

    this.sessionStartTime = Date.now();
    this.actionCount = 0;
    this.sessionEnded = false;

    const context = this.getBrowserContext();

    trackEvent('session_start', {
      module: 'app',
      ...context,
    });

    debugLog('session', 'Session started');
  }

  /**
   * End session and send summary
   */
  end() {
    if (!this.sessionStartTime || this.sessionEnded) {
      return;
    }

    this.sessionEnded = true;
    const duration = Date.now() - this.sessionStartTime;

    trackEvent('session_end', {
      module: 'app',
      session_duration_ms: duration,
      total_actions: this.actionCount,
    });

    debugLog('session', `Session ended: ${duration}ms, ${this.actionCount} actions`);
  }

  /**
   * Increment action counter
   */
  recordAction() {
    this.actionCount++;
  }

  /**
   * Get browser/OS context
   */
  getBrowserContext() {
    const ua = navigator.userAgent;

    // Parse browser
    let browserName = 'unknown';
    let browserVersion = 'unknown';

    if (ua.includes('Chrome/') && !ua.includes('Edg/')) {
      browserName = 'chrome';
      const match = ua.match(/Chrome\/(\d+)/);
      browserVersion = match ? match[1] : 'unknown';
    } else if (ua.includes('Edg/')) {
      browserName = 'edge';
      const match = ua.match(/Edg\/(\d+)/);
      browserVersion = match ? match[1] : 'unknown';
    } else if (ua.includes('Firefox/')) {
      browserName = 'firefox';
      const match = ua.match(/Firefox\/(\d+)/);
      browserVersion = match ? match[1] : 'unknown';
    }

    // Parse OS
    let osName = 'unknown';
    let osVersion = 'unknown';

    if (ua.includes('Windows NT')) {
      osName = 'windows';
      const match = ua.match(/Windows NT ([\d.]+)/);
      osVersion = match ? match[1] : 'unknown';
    } else if (ua.includes('Mac OS X')) {
      osName = 'macos';
      const match = ua.match(/Mac OS X ([\d_]+)/);
      osVersion = match ? match[1].replace(/_/g, '.') : 'unknown';
    } else if (ua.includes('Linux')) {
      osName = 'linux';
    }

    return {
      browser_name: browserName,
      browser_version: browserVersion,
      os_name: osName,
      os_version: osVersion,
      screen_width: window.screen.width,
      screen_height: window.screen.height,
    };
  }

  /**
   * Get session stats
   */
  getStats() {
    return {
      duration: this.sessionStartTime ? Date.now() - this.sessionStartTime : 0,
      actionCount: this.actionCount,
      active: !this.sessionEnded,
    };
  }
}

export const sessionTracker = new SessionTracker();
export default sessionTracker;
