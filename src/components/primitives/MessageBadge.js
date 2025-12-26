/**
 * MessageBadge - Reusable badge component for messages
 * Provides common badge functionality with hover effects and click handlers
 */
import DOMUtils from '../../utils/DOMUtils.js';

export default class MessageBadge {
  /**
   * Create a badge manager instance
   * @param {Function} getTheme - Function to get current theme
   * @param {Function} onClick - Badge click handler (badge, element, data)
   */
  constructor(getTheme, onClick) {
    this.getTheme = getTheme;
    this.onClick = onClick;
    this.badgeCache = new WeakMap(); // Track badges by message element
  }

  /**
   * Create and attach a badge to an element
   * @param {HTMLElement} element - Element to attach badge to
   * @param {Object} options - Badge configuration
   * @param {string} options.className - CSS class name
   * @param {string} options.content - Badge content (HTML)
   * @param {string} options.title - Tooltip text
   * @param {Object} options.position - Position (top, right, left, bottom)
   * @param {Object} options.style - Additional styles
   * @param {*} options.data - Data to pass to click handler
   * @param {boolean} options.setParentPosition - Set parent position to relative (default: true)
   */
  create(element, options = {}) {
    const {
      className = 'message-badge',
      content = '',
      title = '',
      position = { top: '-35px', right: '8px' },
      style = {},
      data = null,
      setParentPosition = true,
    } = options;

    // Check if badge already exists
    const existingBadge = this.badgeCache.get(element);
    if (existingBadge) {
      // Update existing badge
      if (existingBadge.innerHTML !== content) {
        existingBadge.innerHTML = content; // Use innerHTML to support SVG strings
      }
      if (title && existingBadge.title !== title) {
        existingBadge.title = title;
      }
      return existingBadge;
    }

    // Create badge element
    const baseStyle = {
      position: 'absolute',
      ...position,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.2s ease',
    };

    // Allow callers to override or provide zIndex via options.style.
    // Do not force a hardcoded z-index here so CSS/classes can control stacking.
    const mergedStyle = Object.assign({}, baseStyle, style || {});

    const badge = DOMUtils.createElement('div', {
      className,
      title,
      style: mergedStyle,
    });

    // Set content
    badge.innerHTML = content; // Use innerHTML to support SVG strings

    // Add hover effects
    this.attachHoverEffects(badge);

    // Add click handler
    if (this.onClick) {
      badge.addEventListener('click', e => {
        e.stopPropagation();
        this.onClick(badge, element, data);
      });
    }

    // Set parent position if needed
    if (setParentPosition) {
      const computedPosition = window.getComputedStyle(element).position;
      if (computedPosition === 'static') {
        element.style.position = 'relative';
      }
    }

    // Append badge
    element.appendChild(badge);

    // Cache badge
    this.badgeCache.set(element, badge);

    return badge;
  }

  /**
   * Attach hover effects to badge
   * @param {HTMLElement} badge - Badge element
   */
  attachHoverEffects(badge) {
    badge.addEventListener('mouseenter', () => {
      badge.style.transform = 'scale(1.05)';
      badge.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.25)';
    });

    badge.addEventListener('mouseleave', () => {
      badge.style.transform = 'scale(1)';
      badge.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
    });
  }

  /**
   * Update badge content
   * @param {HTMLElement} element - Element containing the badge
   * @param {string} content - New content
   * @param {string} title - New title (optional)
   */
  update(element, content, title) {
    const badge = this.badgeCache.get(element);
    if (badge) {
      badge.innerHTML = content; // Use innerHTML to support SVG strings
      if (title) {
        badge.title = title;
      }
    }
  }

  /**
   * Remove badge from specific element
   * @param {HTMLElement} element - Element containing the badge
   */
  remove(element) {
    const badge = this.badgeCache.get(element);
    if (badge) {
      badge.remove();
      this.badgeCache.delete(element);
    }
  }

  /**
   * Remove all badges
   * @param {string} selector - CSS selector for badges (optional, uses cache if not provided)
   */
  removeAll(selector) {
    if (selector) {
      document.querySelectorAll(selector).forEach(badge => badge.remove());
    }
    this.badgeCache = new WeakMap();
  }

  /**
   * Check if element has a badge
   * @param {HTMLElement} element
   * @returns {boolean}
   */
  has(element) {
    return this.badgeCache.has(element);
  }

  /**
   * Get badge element for an element
   * @param {HTMLElement} element
   * @returns {HTMLElement|null}
   */
  get(element) {
    return this.badgeCache.get(element) || null;
  }

  /**
   * Update all badges for a set of elements
   * Smart update: Only add/update/remove changed badges
   * @param {Array<HTMLElement>} elements - Elements that should have badges
   * @param {Function} getBadgeData - Function to get badge data for each element (element, index) => options
   * @param {Function} shouldHaveBadge - Function to determine if element should have badge (element, index) => boolean
   */
  updateAll(elements, getBadgeData, shouldHaveBadge) {
    elements.forEach((element, index) => {
      const should = shouldHaveBadge(element, index);

      if (should) {
        // Badge should exist
        const badgeData = getBadgeData(element, index);
        if (!this.has(element)) {
          // Add new badge
          this.create(element, badgeData);
        } else {
          // Update existing badge if content changed
          const existingBadge = this.get(element);
          if (badgeData.content && existingBadge.innerHTML !== badgeData.content) {
            this.update(element, badgeData.content, badgeData.title);
          }
        }
      } else {
        // Badge should not exist
        if (this.has(element)) {
          this.remove(element);
        }
      }
    });
  }
}
