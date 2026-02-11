/**
 * ErrorTracker - Centralized error tracking and analytics
 *
 * Captures errors from:
 * - Global window.onerror
 * - Unhandled promise rejections
 * - Module initialization failures
 * - Runtime errors
 */

import { trackEvent } from '../analytics/Analytics.js';
import { debugLog } from '../config/debug.js';

const MAX_ERROR_MESSAGE_LENGTH = 200;
const MAX_STACK_LENGTH = 500;
const ERROR_THROTTLE_MS = 5000; // Don't spam same error
const MAX_ERRORS_PER_SESSION = 50; // Circuit breaker

class ErrorTracker {
  constructor() {
    this.errorCount = 0;
    this.errorCache = new Map(); // error signature -> last timestamp
    this.initialized = false;
  }

  /**
   * Initialize global error handlers
   * Called once from App.js constructor
   */
  init() {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    // Global error handler
    window.addEventListener('error', event => {
      this.captureError({
        message: event.message,
        filename: this.sanitizeFilename(event.filename),
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
        type: 'uncaught_error',
      });
    });

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', event => {
      this.captureError({
        message: event.reason?.message || String(event.reason),
        error: event.reason,
        type: 'unhandled_promise',
      });
    });

    debugLog('errors', 'ErrorTracker initialized');
  }

  /**
   * Capture and track an error
   */
  captureError({
    message,
    filename = 'unknown',
    lineno = 0,
    colno = 0,
    error = null,
    type = 'runtime_error',
    module = 'unknown',
    method = 'unknown',
    fatal = false,
  }) {
    // Circuit breaker
    if (this.errorCount >= MAX_ERRORS_PER_SESSION) {
      return;
    }

    const sanitized = this.sanitizeError({
      message,
      filename,
      lineno,
      colno,
      error,
      type,
      module,
      method,
    });

    // Throttle duplicate errors
    const signature = `${sanitized.type}:${sanitized.module}:${sanitized.error_message}`;
    const lastSent = this.errorCache.get(signature);
    const now = Date.now();

    if (lastSent && now - lastSent < ERROR_THROTTLE_MS) {
      return; // Skip duplicate
    }

    this.errorCache.set(signature, now);
    this.errorCount++;

    // Track to analytics
    trackEvent('error_occurred', {
      module: sanitized.module,
      method: sanitized.method,
      error_type: sanitized.type,
      error_message: sanitized.error_message,
      error_stack: sanitized.error_stack,
      error_location: sanitized.error_location,
      fatal: fatal ? 1 : 0,
    });

    debugLog('errors', `Error tracked: ${signature}`);
  }

  /**
   * Sanitize error data for analytics
   */
  sanitizeError({ message, filename, lineno, colno, error, type, module, method }) {
    const errorMessage = String(message || 'Unknown error')
      .substring(0, MAX_ERROR_MESSAGE_LENGTH)
      .replace(/\n/g, ' ');

    let errorStack = '';
    if (error?.stack) {
      errorStack = String(error.stack)
        .substring(0, MAX_STACK_LENGTH)
        .replace(/\n/g, '|')
        .replace(/\s+/g, ' ');
    }

    const errorLocation =
      filename !== 'unknown' ? `${this.sanitizeFilename(filename)}:${lineno}:${colno}` : 'unknown';

    return {
      type,
      module,
      method,
      error_message: errorMessage,
      error_stack: errorStack,
      error_location: errorLocation,
    };
  }

  /**
   * Remove sensitive paths from filenames
   */
  sanitizeFilename(filename) {
    if (!filename) {
      return 'unknown';
    }

    // Extract just the file name from full path
    const parts = filename.split('/');
    const file = parts[parts.length - 1];

    // Remove chrome-extension:// prefix
    return file.replace(/^chrome-extension:\/\/[^/]+\//, '');
  }

  /**
   * Track module initialization error
   */
  trackModuleError(moduleName, error, method = 'init') {
    this.captureError({
      message: error.message,
      error,
      type: 'module_error',
      module: moduleName,
      method,
      fatal: method === 'init', // Init errors are fatal
    });
  }

  /**
   * Reset error count (call on new session)
   */
  reset() {
    this.errorCount = 0;
    this.errorCache.clear();
  }

  /**
   * Get error statistics
   */
  getStats() {
    return {
      errorCount: this.errorCount,
      uniqueErrors: this.errorCache.size,
      maxReached: this.errorCount >= MAX_ERRORS_PER_SESSION,
    };
  }
}

export const errorTracker = new ErrorTracker();
export default errorTracker;
