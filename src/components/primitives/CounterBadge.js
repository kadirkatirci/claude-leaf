/**
 * CounterBadge Component
 * Centralized badge/counter creation for all modules
 * Uses Claude native classes exclusively
 */

import { ClaudeClasses, cn } from '../../utils/ClassNames.js';

/**
 * CounterBadge Class
 * Creates consistent counter badges across all modules using Claude native classes
 */
export class CounterBadge {
  /**
   * Create a counter badge element
   * @param {Object} options - Badge configuration
   * @param {string} options.id - Badge element ID
   * @param {string|number} options.content - Badge text/number
   * @param {Object} options.position - Position offsets {top, right, bottom, left}
   * @param {string} options.className - Additional CSS classes
   * @returns {HTMLElement}
   */
  static create(options = {}) {
    const {
      id = 'counter-badge',
      content = '0',
      position = { top: '-8px', right: '-8px' },
      className = ''
    } = options;

    // Create badge element
    const badge = document.createElement('div');

    if (id) {
      badge.id = id;
    }

    // Apply Claude native classes
    badge.className = cn(
      ClaudeClasses.badge.counter,
      ClaudeClasses.util.transition,
      className
    );

    // Apply position styles (minimal inline styles for positioning only)
    Object.assign(badge.style, this.getPositionStyles(position));

    badge.textContent = content;

    return badge;
  }

  /**
   * Update badge content
   * @param {HTMLElement|string} badgeOrId - Badge element or ID
   * @param {string|number} content - New content
   */
  static update(badgeOrId, content) {
    const badge = typeof badgeOrId === 'string'
      ? document.getElementById(badgeOrId)
      : badgeOrId;

    if (!badge) return;

    badge.textContent = content;

    // Auto-hide if content is 0 or empty
    const shouldHide = !content || content === '0' || content === '0/0';
    badge.style.display = shouldHide ? 'none' : 'block';
  }

  /**
   * Get position styles from position config
   * @private
   */
  static getPositionStyles(position) {
    const styles = {};

    ['top', 'right', 'bottom', 'left'].forEach(prop => {
      if (position[prop] !== undefined) {
        styles[prop] = typeof position[prop] === 'number'
          ? `${position[prop]}px`
          : position[prop];
      }
    });

    return styles;
  }

  /**
   * Attach badge to parent element
   * @param {HTMLElement} parent - Parent element
   * @param {Object} options - Badge options
   * @returns {HTMLElement} The created badge
   */
  static attachTo(parent, options = {}) {
    if (!parent) return null;

    // Ensure parent has relative positioning
    const parentPosition = window.getComputedStyle(parent).position;
    if (parentPosition === 'static') {
      parent.style.position = 'relative';
    }

    const badge = this.create(options);
    parent.appendChild(badge);

    return badge;
  }

  /**
   * Find and update existing badge
   * @param {string} id - Badge ID
   * @param {string|number} content - New content
   */
  static updateById(id, content) {
    this.update(id, content);
  }

  /**
   * Create or update badge
   * @param {HTMLElement} parent - Parent element
   * @param {Object} options - Badge options
   * @returns {HTMLElement}
   */
  static createOrUpdate(parent, options = {}) {
    const { id } = options;

    // Check if badge already exists
    const existingBadge = id ? document.getElementById(id) : null;

    if (existingBadge) {
      this.update(existingBadge, options.content || '0');
      return existingBadge;
    }

    // Create new badge
    return this.attachTo(parent, options);
  }

  /**
   * Remove badge
   * @param {HTMLElement|string} badgeOrId - Badge element or ID
   */
  static remove(badgeOrId) {
    const badge = typeof badgeOrId === 'string'
      ? document.getElementById(badgeOrId)
      : badgeOrId;

    if (badge) {
      badge.remove();
    }
  }

  /**
   * Show badge
   * @param {HTMLElement|string} badgeOrId - Badge element or ID
   */
  static show(badgeOrId) {
    const badge = typeof badgeOrId === 'string'
      ? document.getElementById(badgeOrId)
      : badgeOrId;

    if (badge) {
      badge.style.display = 'block';
    }
  }

  /**
   * Hide badge
   * @param {HTMLElement|string} badgeOrId - Badge element or ID
   */
  static hide(badgeOrId) {
    const badge = typeof badgeOrId === 'string'
      ? document.getElementById(badgeOrId)
      : badgeOrId;

    if (badge) {
      badge.style.display = 'none';
    }
  }

  /**
   * Animate badge (pulse effect)
   * @param {HTMLElement|string} badgeOrId - Badge element or ID
   */
  static pulse(badgeOrId) {
    const badge = typeof badgeOrId === 'string'
      ? document.getElementById(badgeOrId)
      : badgeOrId;

    if (!badge) return;

    badge.style.animation = 'pulse 0.3s ease-in-out';

    setTimeout(() => {
      badge.style.animation = '';
    }, 300);
  }
}

// Export as default for convenience
export default CounterBadge;
