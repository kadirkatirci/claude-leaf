/**
 * Universal Badge Component
 * Replaces all duplicate badge creation code across the extension
 * Used for counters, indicators, version badges, emoji markers, etc.
 *
 * REFACTORED: Uses ONLY Claude native classes, no inline styles
 */

import {
  cn,
  badgeClass,
  badgeSizeClass,
  badgeVariantClass,
  buttonGroupClass,
  ClaudeClasses,
} from '../../utils/ClassNames.js';

/**
 * Badge Component Class
 * Provides static methods for creating badges with consistent styling
 */
export class Badge {
  /**
   * Creates a badge element with specified options
   * @param {Object} options - Badge configuration
   * @param {string|number} options.content - Badge content (text, number, or emoji)
   * @param {string} options.variant - Badge variant: 'primary', 'accent', 'neutral', 'counter'
   * @param {string} options.size - Badge size: 'xs', 'sm', 'base'
   * @param {string} options.className - Additional CSS classes
   * @param {string} options.id - Badge ID
   * @param {string} options.title - Badge tooltip
   * @param {boolean} options.rounded - Use rounded-full (default: false, uses rounded-md)
   * @param {boolean} options.clickable - Whether the badge is clickable
   * @param {Function} options.onClick - Click handler
   * @param {Object} options.position - Inline position offsets for dynamic placement
   * @param {Object} options.style - Inline styles for dynamic values only
   * @param {boolean} options.allowEmpty - Keep badge visible when content is empty
   * @returns {HTMLElement}
   */
  static create(options = {}) {
    const {
      content = '',
      variant = 'accent',
      size = 'base',
      className = '',
      id = null,
      title = null,
      rounded = false,
      clickable = false,
      onClick = null,
      position = null,
      style = null,
      allowEmpty = false,
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

    this.setBadgeMetadata(badge, {
      variant,
      size,
      rounded,
      clickable,
      className,
      allowEmpty,
    });

    // Apply classes
    badge.className = this.getBadgeClasses(variant, size, rounded, clickable, className);
    this.applyPositionStyles(badge, position);

    if (style && typeof style === 'object') {
      Object.assign(badge.style, style);
    }

    // Set content
    this.setBadgeContent(badge, content, { allowEmpty });

    // Add click handler if clickable
    if (clickable && onClick) {
      badge.addEventListener('click', onClick);
    }

    return badge;
  }

  /**
   * Gets the appropriate CSS classes for the badge
   */
  static getBadgeClasses(variant, size, rounded, clickable, additionalClasses) {
    return badgeClass(
      {
        variant,
        size,
        rounded,
        clickable,
      },
      additionalClasses
    );
  }

  /**
   * Gets the variant-specific class
   */
  static getVariantClass(variant) {
    return badgeVariantClass(variant);
  }

  /**
   * Gets the size-specific class
   */
  static getSizeClass(size) {
    return badgeSizeClass(size);
  }

  /**
   * Sets the badge content
   */
  static setBadgeContent(badge, content, { allowEmpty = false } = {}) {
    if (typeof content === 'number') {
      // Add special formatting for large numbers
      if (content > 999) {
        badge.textContent = '999+';
      } else {
        badge.textContent = content.toString();
      }
    } else {
      badge.textContent = content;
    }

    // Hide badge if no content
    this.toggleHidden(badge, !allowEmpty && !content && content !== 0);
  }

  /**
   * Store badge rendering metadata for future updates
   */
  static setBadgeMetadata(badge, { variant, size, rounded, clickable, className, allowEmpty }) {
    badge.dataset.badgeVariant = variant;
    badge.dataset.badgeSize = size;
    badge.dataset.badgeRounded = String(Boolean(rounded));
    badge.dataset.badgeClickable = String(Boolean(clickable));
    badge.dataset.badgeClassName = className || '';
    badge.dataset.badgeAllowEmpty = String(Boolean(allowEmpty));
  }

  /**
   * Read badge rendering metadata
   */
  static getBadgeMetadata(badge) {
    return {
      variant: badge.dataset.badgeVariant || 'accent',
      size: badge.dataset.badgeSize || 'base',
      rounded: badge.dataset.badgeRounded === 'true',
      clickable: badge.dataset.badgeClickable === 'true',
      className: badge.dataset.badgeClassName || '',
      allowEmpty: badge.dataset.badgeAllowEmpty === 'true',
    };
  }

  /**
   * Apply only positional inline styles
   */
  static applyPositionStyles(badge, position) {
    if (!position || typeof position !== 'object') {
      return;
    }

    const styles = {};
    ['top', 'right', 'bottom', 'left'].forEach(prop => {
      if (position[prop] !== undefined) {
        styles[prop] = typeof position[prop] === 'number' ? `${position[prop]}px` : position[prop];
      }
    });

    if (Object.keys(styles).length > 0) {
      styles.position = 'absolute';
      Object.assign(badge.style, styles);
    }
  }

  /**
   * Toggle hidden class without mutating the rest of the class list
   */
  static toggleHidden(badge, shouldHide) {
    badge.classList.toggle(ClaudeClasses.state.hidden, shouldHide);
  }

  /**
   * Creates a counter badge (commonly used on buttons)
   */
  static createCounter(count, options = {}) {
    return this.create({
      ...options,
      content: count,
      variant: 'counter',
      size: 'sm',
      rounded: true,
    });
  }

  /**
   * Creates an emoji badge (for emoji markers)
   */
  static createEmoji(emoji, options = {}) {
    return this.create({
      ...options,
      content: emoji,
      variant: 'primary',
      className: cn('text-base min-w-[24px] h-6 bg-transparent', options.className),
    });
  }

  /**
   * Creates a version badge (for edit history)
   */
  static createVersion(version, total, options = {}) {
    const content = `${version}/${total}`;
    return this.create({
      ...options,
      content,
      variant: 'neutral',
      size: 'xs',
      className: cn('font-mono', options.className),
    });
  }

  /**
   * Creates a status badge
   */
  static createStatus(status, options = {}) {
    const statusVariants = {
      active: 'accent',
      pending: 'neutral',
      error: 'accent', // Use accent for errors (red in Claude)
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
    return this.create({
      ...options,
      content: '',
      variant: options.variant || 'accent',
      className: cn('w-2 h-2 min-w-[8px] p-0', options.className),
      rounded: true,
      allowEmpty: true,
    });
  }

  /**
   * Updates the content of an existing badge
   */
  static update(badge, content, options = {}) {
    if (!badge) {
      return;
    }

    const currentMeta = this.getBadgeMetadata(badge);
    const nextMeta = {
      variant: options.variant || currentMeta.variant,
      size: options.size || currentMeta.size,
      rounded: options.rounded ?? currentMeta.rounded,
      clickable: options.clickable ?? currentMeta.clickable,
      className: options.className ?? currentMeta.className,
      allowEmpty: options.allowEmpty ?? currentMeta.allowEmpty,
    };

    this.setBadgeMetadata(badge, nextMeta);
    badge.className = this.getBadgeClasses(
      nextMeta.variant,
      nextMeta.size,
      nextMeta.rounded,
      nextMeta.clickable,
      nextMeta.className
    );

    if (options.position) {
      this.applyPositionStyles(badge, options.position);
    }

    if (options.style && typeof options.style === 'object') {
      Object.assign(badge.style, options.style);
    }

    // Update content after class recomputation so hidden state stays correct
    this.setBadgeContent(badge, content, { allowEmpty: nextMeta.allowEmpty });
  }

  /**
   * Creates a badge group (multiple badges in a container)
   */
  static createGroup(badges, options = {}) {
    const group = document.createElement('div');
    const direction = options.direction === 'vertical' ? 'col' : 'row';
    group.className = buttonGroupClass(direction, 2, options.className);

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
    if (!badge) {
      return;
    }

    // Add animation class
    badge.classList.add(ClaudeClasses.state.pulse);

    // Remove after animation
    setTimeout(() => {
      badge.classList.remove(ClaudeClasses.state.pulse);
    }, 250);
  }

  /**
   * Destroys a badge and removes event listeners
   */
  static destroy(badge) {
    if (!badge) {
      return;
    }

    // Remove all event listeners by cloning
    const newBadge = badge.cloneNode(true);
    badge.parentNode?.replaceChild(newBadge, badge);
    newBadge.remove();
  }
}

// Export as default for convenience
export default Badge;
