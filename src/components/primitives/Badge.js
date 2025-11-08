/**
 * Universal Badge Component
 * Replaces all duplicate badge creation code across the extension
 * Used for counters, indicators, version badges, emoji markers, etc.
 */

import { classNames } from '../theme/styled.js';
import tokens from '../theme/tokens.js';

/**
 * Badge Component Class
 * Provides static methods for creating badges with consistent styling
 */
export class Badge {
  /**
   * Creates a badge element with specified options
   * @param {Object} options - Badge configuration
   * @param {string|number} options.content - Badge content (text, number, or emoji)
   * @param {string} options.variant - Badge variant: 'primary', 'success', 'warning', 'error', 'neutral', 'custom'
   * @param {string} options.size - Badge size: 'sm', 'base', 'lg'
   * @param {string} options.className - Additional CSS classes
   * @param {string} options.id - Badge ID
   * @param {string} options.title - Badge tooltip
   * @param {Object} options.position - Absolute position { top, right, bottom, left }
   * @param {Object} options.style - Additional inline styles
   * @param {string} options.customColor - Custom background color (for variant='custom')
   * @param {boolean} options.clickable - Whether the badge is clickable
   * @param {Function} options.onClick - Click handler
   * @param {boolean} options.animated - Whether to add animation
   * @returns {HTMLElement}
   */
  static create(options = {}) {
    const {
      content = '',
      variant = 'primary',
      size = 'base',
      className = '',
      id = null,
      title = null,
      position = null,
      style = {},
      customColor = null,
      clickable = false,
      onClick = null,
      animated = false,
    } = options;

    // Create badge element
    const badge = document.createElement('div');

    // Set ID if provided
    if (id) {
      badge.id = id;
    }

    // Set tooltip if provided
    if (title) {
      badge.title = title;
    }

    // Apply classes
    const classes = this.getBadgeClasses(variant, size, className, clickable, animated);
    badge.className = classes;

    // Set content
    this.setBadgeContent(badge, content);

    // Apply custom color if specified
    if (variant === 'custom' && customColor) {
      badge.style.background = customColor;
    }

    // Apply positioning if specified
    if (position) {
      this.applyPosition(badge, position);
    }

    // Apply additional inline styles
    if (Object.keys(style).length > 0) {
      Object.assign(badge.style, style);
    }

    // Add click handler if clickable
    if (clickable && onClick) {
      badge.style.cursor = 'pointer';
      badge.addEventListener('click', onClick);
      this.addHoverEffects(badge);
    }

    return badge;
  }

  /**
   * Gets the appropriate CSS classes for the badge
   */
  static getBadgeClasses(variant, size, additionalClasses, clickable, animated) {
    const baseClass = 'cp-badge';
    const variantClass = this.getVariantClass(variant);
    const sizeClass = this.getSizeClass(size);

    return classNames(
      baseClass,
      variantClass,
      sizeClass,
      clickable && 'cp-badge-clickable',
      animated && 'cp-badge-animated',
      additionalClasses
    );
  }

  /**
   * Gets the variant-specific class
   */
  static getVariantClass(variant) {
    const variantMap = {
      primary: 'cp-badge-primary',
      success: 'cp-badge-success',
      warning: 'cp-badge-warning',
      error: 'cp-badge-error',
      neutral: 'cp-badge-neutral',
      custom: 'cp-badge-custom',
    };

    return variantMap[variant] || 'cp-badge-primary';
  }

  /**
   * Gets the size-specific class
   */
  static getSizeClass(size) {
    const sizeMap = {
      sm: 'cp-badge-sm',
      base: 'cp-badge-base',
      lg: 'cp-badge-lg',
    };

    return sizeMap[size] || 'cp-badge-base';
  }

  /**
   * Sets the badge content
   */
  static setBadgeContent(badge, content) {
    if (typeof content === 'number') {
      badge.textContent = content.toString();

      // Add special formatting for large numbers
      if (content > 999) {
        badge.textContent = '999+';
      } else if (content > 99) {
        badge.style.minWidth = '24px';
      }
    } else {
      badge.textContent = content;
    }

    // Hide badge if no content
    if (!content && content !== 0) {
      badge.style.display = 'none';
    }
  }

  /**
   * Applies absolute positioning to the badge
   */
  static applyPosition(badge, position) {
    badge.style.position = 'absolute';

    ['top', 'right', 'bottom', 'left'].forEach(prop => {
      if (position[prop] !== undefined) {
        badge.style[prop] = typeof position[prop] === 'number'
          ? `${position[prop]}px`
          : position[prop];
      }
    });
  }

  /**
   * Adds hover effects to clickable badges
   */
  static addHoverEffects(badge) {
    badge.addEventListener('mouseenter', () => {
      badge.style.transform = 'scale(1.1)';
    });

    badge.addEventListener('mouseleave', () => {
      badge.style.transform = 'scale(1)';
    });
  }

  /**
   * Creates a counter badge (commonly used on buttons)
   */
  static createCounter(count, options = {}) {
    return this.create({
      ...options,
      content: count,
      variant: options.variant || 'error',
      size: 'sm',
      position: options.position || { top: -6, right: -6 },
    });
  }

  /**
   * Creates an emoji badge (for emoji markers)
   */
  static createEmoji(emoji, options = {}) {
    const badge = this.create({
      ...options,
      content: emoji,
      variant: 'custom',
      customColor: 'transparent',
      style: {
        fontSize: '16px',
        minWidth: '24px',
        height: '24px',
        ...options.style,
      },
    });

    return badge;
  }

  /**
   * Creates a version badge (for edit history)
   */
  static createVersion(version, total, options = {}) {
    const content = `${version}/${total}`;
    return this.create({
      ...options,
      content,
      variant: options.variant || 'neutral',
      size: 'sm',
      style: {
        padding: '2px 6px',
        fontFamily: tokens.typography.fontFamily.mono,
        ...options.style,
      },
    });
  }

  /**
   * Creates a status badge
   */
  static createStatus(status, options = {}) {
    const statusVariants = {
      active: 'success',
      pending: 'warning',
      error: 'error',
      inactive: 'neutral',
    };

    return this.create({
      ...options,
      content: status,
      variant: statusVariants[status.toLowerCase()] || 'neutral',
    });
  }

  /**
   * Creates an indicator dot badge
   */
  static createDot(options = {}) {
    const badge = this.create({
      ...options,
      content: '',
      size: 'sm',
      style: {
        width: '8px',
        height: '8px',
        minWidth: '8px',
        padding: 0,
        ...options.style,
      },
    });

    return badge;
  }

  /**
   * Updates the content of an existing badge
   */
  static update(badge, content, options = {}) {
    if (!badge) return;

    // Update content
    this.setBadgeContent(badge, content);

    // Update visibility
    if (!content && content !== 0) {
      badge.style.display = 'none';
    } else {
      badge.style.display = '';
    }

    // Update other properties if provided
    if (options.variant) {
      badge.className = badge.className
        .replace(/cp-badge-\w+/g, '')
        .concat(` cp-badge-${options.variant}`);
    }

    if (options.style) {
      Object.assign(badge.style, options.style);
    }
  }

  /**
   * Creates a badge group (multiple badges in a container)
   */
  static createGroup(badges, options = {}) {
    const group = document.createElement('div');
    group.className = classNames('cp-badge-group', options.className);
    group.style.display = 'flex';
    group.style.gap = tokens.space('xs');
    group.style.alignItems = 'center';

    if (options.direction === 'vertical') {
      group.style.flexDirection = 'column';
    }

    badges.forEach(badgeOptions => {
      const badge = this.create(badgeOptions);
      group.appendChild(badge);
    });

    return group;
  }

  /**
   * Animates a badge (pulse effect)
   */
  static pulse(badge) {
    if (!badge) return;

    badge.style.animation = `pulse ${tokens.animation.duration.normal} ${tokens.animation.easing.easeOut}`;

    setTimeout(() => {
      badge.style.animation = '';
    }, 250);
  }

  /**
   * Destroys a badge and removes event listeners
   */
  static destroy(badge) {
    if (!badge) return;

    // Remove all event listeners by cloning
    const newBadge = badge.cloneNode(true);
    badge.parentNode?.replaceChild(newBadge, badge);
    newBadge.remove();
  }
}

// Add required CSS for badge animations
const style = document.createElement('style');
style.textContent = `
  .cp-badge-animated {
    transition: all ${tokens.animation.duration.fast} ${tokens.animation.easing.easeOut};
  }

  .cp-badge-clickable:hover {
    transform: scale(1.1);
    cursor: pointer;
  }

  .cp-badge-sm {
    font-size: ${tokens.typography.fontSize.xs};
    height: 14px;
    min-width: 14px;
    padding: 0 4px;
  }

  .cp-badge-base {
    font-size: ${tokens.typography.fontSize.xs};
    height: 18px;
    min-width: 18px;
    padding: 0 6px;
  }

  .cp-badge-lg {
    font-size: ${tokens.typography.fontSize.sm};
    height: 22px;
    min-width: 22px;
    padding: 0 8px;
  }

  @keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.2); }
    100% { transform: scale(1); }
  }
`;

// Export as default for convenience
export default Badge;