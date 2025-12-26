/**
 * Universal Badge Component
 * Replaces all duplicate badge creation code across the extension
 * Used for counters, indicators, version badges, emoji markers, etc.
 *
 * REFACTORED: Uses ONLY Claude native classes, no inline styles
 */

import { cn, ClaudeClasses } from '../../utils/ClassNames.js';

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
    badge.className = this.getBadgeClasses(variant, size, rounded, clickable, className);

    // Set content
    this.setBadgeContent(badge, content);

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
    const variantClass = this.getVariantClass(variant);
    const sizeClass = this.getSizeClass(size);
    const roundedClass = rounded ? ClaudeClasses.util.roundedFull : ClaudeClasses.util.rounded;

    return cn(
      variantClass,
      sizeClass,
      roundedClass,
      clickable && cn(ClaudeClasses.util.cursorPointer, 'hover:scale-110 transition-transform'),
      additionalClasses
    );
  }

  /**
   * Gets the variant-specific class
   */
  static getVariantClass(variant) {
    const variantMap = {
      primary: 'px-2 py-1 bg-bg-200 text-text-000 text-xs font-semibold',
      accent: ClaudeClasses.badge.accent,
      neutral: ClaudeClasses.badge.neutral,
      counter: ClaudeClasses.badge.counter,
    };

    return variantMap[variant] || variantMap.accent;
  }

  /**
   * Gets the size-specific class
   */
  static getSizeClass(size) {
    const sizeMap = {
      xs: 'text-xs px-1 py-0.5 min-w-[16px]',
      sm: 'text-xs px-1.5 py-0.5 min-w-[20px]',
      base: 'text-xs px-2 py-1 min-w-[24px]',
    };

    return sizeMap[size] || sizeMap.base;
  }

  /**
   * Sets the badge content
   */
  static setBadgeContent(badge, content) {
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
    if (!content && content !== 0) {
      badge.className = cn(badge.className, 'hidden');
    }
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
    });
  }

  /**
   * Updates the content of an existing badge
   */
  static update(badge, content, options = {}) {
    if (!badge) {
      return;
    }

    // Update content
    this.setBadgeContent(badge, content);

    // Update visibility by toggling hidden class
    if (!content && content !== 0) {
      badge.className = cn(badge.className, 'hidden');
    } else {
      badge.className = badge.className.replace(/\bhidden\b/g, '').trim();
    }

    // Update variant if provided
    if (options.variant) {
      // Remove old variant classes and add new ones
      const oldVariantPattern =
        /\b(px-2 py-1 bg-bg-200 text-text-000|px-2 py-1 rounded-md bg-accent-main-100 text-white|px-2 py-1 rounded-md bg-bg-200 text-text-000|absolute top-0 right-0 -mt-1 -mr-1 px-1\.5 py-0\.5 rounded-full bg-accent-main-100 text-white)\b/g;
      badge.className = badge.className.replace(oldVariantPattern, '').trim();
      badge.className = cn(badge.className, this.getVariantClass(options.variant));
    }
  }

  /**
   * Creates a badge group (multiple badges in a container)
   */
  static createGroup(badges, options = {}) {
    const group = document.createElement('div');
    const direction = options.direction === 'vertical' ? 'col' : 'row';
    group.className = cn(
      ClaudeClasses.layout[`flex${direction === 'col' ? 'Col' : 'Row'}`],
      ClaudeClasses.layout.gap2,
      ClaudeClasses.layout.itemsCenter,
      options.className
    );

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
    badge.className = cn(badge.className, 'animate-pulse');

    // Remove after animation
    setTimeout(() => {
      badge.className = badge.className.replace(/\banimate-pulse\b/g, '').trim();
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
