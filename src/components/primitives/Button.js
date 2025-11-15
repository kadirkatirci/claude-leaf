/**
 * Universal Button Component
 * Uses ONLY Claude native classes - no inline styles or conditionals
 * Replaces all duplicate button creation code across the extension
 * Supports all button variants: fixed, inline, icon, chevron, close, etc.
 */

import { cn, buttonClass, ClaudeClasses } from '../../utils/ClassNames.js';

/**
 * Button Component Class
 * Provides static methods for creating buttons with consistent styling
 */
export class Button {
  /**
   * Creates a button element with specified options
   * @param {Object} options - Button configuration
   * @param {string} options.variant - Button variant: 'primary', 'secondary', 'icon', 'chevron', 'fixed'
   * @param {string} options.size - Button size: 'sm', 'base', 'lg'
   * @param {string} options.icon - Icon content (emoji or text)
   * @param {string} options.text - Button text content
   * @param {string} options.className - Additional CSS classes
   * @param {string} options.id - Button ID
   * @param {string} options.title - Button tooltip
   * @param {Function} options.onClick - Click handler
   * @param {boolean} options.disabled - Disabled state
   * @param {Object} options.position - Position for fixed buttons { top, right, bottom, left, transform }
   * @returns {HTMLButtonElement}
   */
  static create(options = {}) {
    const {
      variant = 'primary',
      size = 'base',
      icon = null,
      text = null,
      className = '',
      id = null,
      title = null,
      onClick = null,
      disabled = false,
      position = null,
    } = options;

    // Create button element
    const button = document.createElement('button');

    // Set ID if provided
    if (id) {
      button.id = id;
    }

    // Set tooltip if provided
    if (title) {
      button.title = title;
    }

    // Set disabled state
    if (disabled) {
      button.disabled = true;
    }

    // Apply classes based on variant and size
    const classes = this.getButtonClasses(variant, size, className);
    button.className = classes;

    // Set content
    this.setButtonContent(button, { icon, text });

    // Apply positioning for fixed buttons using inline styles (necessary for dynamic positioning)
    if (variant === 'fixed' && position) {
      this.applyFixedPosition(button, position);
    }

    // Attach click handler
    if (onClick) {
      button.addEventListener('click', onClick);
    }

    return button;
  }

  /**
   * Gets the appropriate CSS classes for the button
   */
  static getButtonClasses(variant, size, additionalClasses) {
    // Map variants to native Claude classes
    const variantClassMap = {
      primary: buttonClass('primary'),
      secondary: buttonClass('secondary'),
      danger: buttonClass('danger'),
      icon: buttonClass('icon'),
      small: buttonClass('small'),
      fixed: buttonClass('fixed'),
      chevron: cn(
        ClaudeClasses.button.icon,
        'transition-transform duration-200'
      ),
      close: cn(
        ClaudeClasses.button.icon,
        'hover:bg-red-500 hover:text-white'
      ),
    };

    return cn(
      variantClassMap[variant] || variantClassMap.primary,
      additionalClasses
    );
  }

  /**
   * Sets the button content (icon and/or text)
   */
  static setButtonContent(button, { icon, text }) {
    const contentParts = [];

    if (icon) {
      const iconSpan = document.createElement('span');
      iconSpan.className = cn(
        ClaudeClasses.text.xl,
        'leading-none'
      );
      iconSpan.textContent = icon;
      contentParts.push(iconSpan);
    }

    if (text) {
      const textSpan = document.createElement('span');
      textSpan.className = cn(
        ClaudeClasses.text.sm,
        ClaudeClasses.text.semibold
      );
      textSpan.textContent = text;
      contentParts.push(textSpan);
    }

    // Clear existing content
    button.textContent = '';

    // Add content parts
    contentParts.forEach(part => button.appendChild(part));

    // If no content provided, show placeholder
    if (contentParts.length === 0) {
      button.textContent = 'Button';
    }
  }

  /**
   * Applies fixed positioning styles
   * Note: Position values must use inline styles as they are dynamic
   */
  static applyFixedPosition(button, position) {
    const positionStyles = {
      position: 'fixed',
      zIndex: '10001',
    };

    // Apply position properties
    ['top', 'right', 'bottom', 'left'].forEach(prop => {
      if (position[prop] !== undefined) {
        positionStyles[prop] = position[prop];
      }
    });

    // Apply transform if specified
    if (position.transform) {
      positionStyles.transform = position.transform;
    }

    Object.assign(button.style, positionStyles);
  }

  /**
   * Creates a button with a counter badge
   */
  static createWithBadge(buttonOptions, badgeOptions) {
    const container = document.createElement('div');
    container.className = cn(
      ClaudeClasses.position.relative,
      'inline-block'
    );

    const button = this.create(buttonOptions);
    container.appendChild(button);

    if (badgeOptions && badgeOptions.count !== undefined) {
      const badge = this.createBadge(badgeOptions);
      container.appendChild(badge);
    }

    return container;
  }

  /**
   * Creates a badge element for button counters
   */
  static createBadge({ count, variant = 'primary' }) {
    const badge = document.createElement('div');

    const baseClasses = cn(
      ClaudeClasses.position.absolute,
      'top-0 right-0 -mt-1 -mr-1',
      'px-1.5 py-0.5',
      ClaudeClasses.util.roundedFull,
      'text-xs font-bold min-w-[20px] text-center',
      'pointer-events-none'
    );

    const variantClasses = variant === 'primary'
      ? 'bg-accent-main-100 text-white'
      : 'bg-bg-200 text-text-000';

    badge.className = cn(baseClasses, variantClasses);
    badge.textContent = count;

    return badge;
  }

  /**
   * Updates the badge count on a button with badge
   */
  static updateBadge(container, count) {
    const badge = container.querySelector('[class*="rounded-full"]');
    if (badge) {
      badge.textContent = count;
      badge.className = count > 0
        ? badge.className.replace('opacity-0', 'opacity-100')
        : badge.className.replace('opacity-100', 'opacity-0');
    }
  }

  /**
   * Creates an icon-only button (commonly used for close, chevron, etc.)
   */
  static createIcon(icon, options = {}) {
    return this.create({
      ...options,
      variant: options.variant || 'icon',
      icon,
    });
  }

  /**
   * Creates a chevron button for collapse/expand
   */
  static createChevron(expanded = false, options = {}) {
    const icon = expanded ? '▼' : '▶';
    const button = this.create({
      ...options,
      variant: 'chevron',
      icon,
    });

    // Add rotation class for expanded state
    if (expanded) {
      button.className = cn(button.className, 'rotate-0');
    }

    return button;
  }

  /**
   * Updates a chevron button's expanded state
   */
  static updateChevron(button, expanded) {
    const iconSpan = button.querySelector('span');
    if (iconSpan) {
      iconSpan.textContent = expanded ? '▼' : '▶';
    }
  }

  /**
   * Creates a close button
   */
  static createClose(options = {}) {
    return this.create({
      ...options,
      variant: 'close',
      icon: '✕',
      title: options.title || 'Close',
    });
  }

  /**
   * Creates a fixed navigation button
   */
  static createFixed(icon, position, options = {}) {
    return this.create({
      ...options,
      variant: 'fixed',
      icon,
      position,
    });
  }

  /**
   * Creates a group of buttons (for toolbars, etc.)
   */
  static createGroup(buttons, options = {}) {
    const group = document.createElement('div');

    const directionClass = options.direction === 'vertical'
      ? ClaudeClasses.layout.flexCol
      : ClaudeClasses.layout.flexRow;

    group.className = cn(
      directionClass,
      ClaudeClasses.layout.gap2,
      options.className
    );

    buttons.forEach(buttonOptions => {
      const button = this.create(buttonOptions);
      group.appendChild(button);
    });

    return group;
  }

  /**
   * Destroys a button and removes event listeners
   */
  static destroy(button) {
    if (!button) return;

    // Remove all event listeners by cloning
    const newButton = button.cloneNode(true);
    button.parentNode?.replaceChild(newButton, button);
    newButton.remove();
  }
}

// Export as default for convenience
export default Button;
