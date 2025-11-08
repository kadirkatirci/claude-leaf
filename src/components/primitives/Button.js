/**
 * Universal Button Component
 * Replaces all duplicate button creation code across the extension
 * Supports all button variants: fixed, inline, icon, chevron, close, etc.
 */

import { classNames } from '../theme/styled.js';
import tokens from '../theme/tokens.js';

/**
 * Button Component Class
 * Provides static methods for creating buttons with consistent styling
 */
export class Button {
  /**
   * Creates a button element with specified options
   * @param {Object} options - Button configuration
   * @param {string} options.variant - Button variant: 'primary', 'secondary', 'ghost', 'icon', 'chevron', 'fixed'
   * @param {string} options.size - Button size: 'sm', 'base', 'lg'
   * @param {string} options.icon - Icon content (emoji or text)
   * @param {string} options.text - Button text content
   * @param {string} options.className - Additional CSS classes
   * @param {string} options.id - Button ID
   * @param {string} options.title - Button tooltip
   * @param {Function} options.onClick - Click handler
   * @param {Object} options.style - Additional inline styles
   * @param {boolean} options.disabled - Disabled state
   * @param {Object} options.position - Position for fixed buttons { top, right, bottom, left, transform }
   * @param {boolean} options.useNativeClasses - Use Claude's native classes (for native theme)
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
      style = {},
      disabled = false,
      position = null,
      useNativeClasses = false,
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
    const classes = this.getButtonClasses(variant, size, className, useNativeClasses);
    button.className = classes;

    // Set content
    this.setButtonContent(button, { icon, text });

    // Apply positioning for fixed buttons
    if (variant === 'fixed' && position) {
      this.applyFixedPosition(button, position);
    }

    // Apply additional inline styles
    if (Object.keys(style).length > 0) {
      Object.assign(button.style, style);
    }

    // Attach click handler
    if (onClick) {
      button.addEventListener('click', onClick);
    }

    // Add hover effects if not using native classes
    if (!useNativeClasses && variant !== 'chevron') {
      this.addHoverEffects(button, variant);
    }

    return button;
  }

  /**
   * Gets the appropriate CSS classes for the button
   */
  static getButtonClasses(variant, size, additionalClasses, useNativeClasses) {
    // Use native Claude classes if requested
    if (useNativeClasses && variant === 'primary') {
      return classNames(
        'text-orange-500 hover:text-orange-600',
        'transition-all duration-200',
        additionalClasses
      );
    }

    // Use our custom component classes
    const baseClass = 'cp-btn';
    const variantClass = this.getVariantClass(variant);
    const sizeClass = this.getSizeClass(size, variant);

    return classNames(
      baseClass,
      variantClass,
      sizeClass,
      additionalClasses
    );
  }

  /**
   * Gets the variant-specific class
   */
  static getVariantClass(variant) {
    const variantMap = {
      primary: 'cp-btn-primary',
      secondary: 'cp-btn-secondary',
      ghost: 'cp-btn-ghost',
      icon: 'cp-btn-icon',
      chevron: 'cp-btn-chevron',
      fixed: 'cp-btn-fixed cp-btn-primary',
      close: 'cp-btn-icon',
    };

    return variantMap[variant] || 'cp-btn-primary';
  }

  /**
   * Gets the size-specific class
   */
  static getSizeClass(size, variant) {
    // Special variants don't use size classes
    if (['icon', 'chevron', 'fixed'].includes(variant)) {
      return '';
    }

    const sizeMap = {
      sm: 'cp-btn-sm',
      base: 'cp-btn-base',
      lg: 'cp-btn-lg',
    };

    return sizeMap[size] || 'cp-btn-base';
  }

  /**
   * Sets the button content (icon and/or text)
   */
  static setButtonContent(button, { icon, text }) {
    const contentParts = [];

    if (icon) {
      const iconSpan = document.createElement('span');
      // Add Claude's native text class for proper color adaptation
      iconSpan.className = 'cp-btn-icon-content text-text-200';
      iconSpan.textContent = icon;
      contentParts.push(iconSpan);
    }

    if (text) {
      const textSpan = document.createElement('span');
      textSpan.className = 'cp-btn-text-content';
      textSpan.textContent = text;
      contentParts.push(textSpan);
    }

    // Clear existing content
    button.innerHTML = '';

    // Add content parts
    contentParts.forEach(part => button.appendChild(part));

    // If no content provided, show placeholder
    if (contentParts.length === 0) {
      button.textContent = 'Button';
    }
  }

  /**
   * Applies fixed positioning styles
   */
  static applyFixedPosition(button, position) {
    const positionStyles = {
      position: 'fixed',
      zIndex: tokens.zIndex.fixed,
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
   * Adds hover effects to the button
   */
  static addHoverEffects(button, variant) {
    // Skip hover effects for simple variants
    if (['chevron', 'icon'].includes(variant)) {
      return;
    }

    button.addEventListener('mouseenter', () => {
      if (button.disabled) return;

      // Scale effect for fixed buttons
      if (variant === 'fixed') {
        button.style.transform = button.style.transform?.includes('translateY')
          ? button.style.transform.replace(/scale\([^)]*\)/g, '') + ' scale(1.1)'
          : 'scale(1.1)';
      }
    });

    button.addEventListener('mouseleave', () => {
      if (button.disabled) return;

      // Reset scale for fixed buttons
      if (variant === 'fixed') {
        button.style.transform = button.style.transform?.replace(/scale\([^)]*\)/g, '').trim();
      }
    });
  }

  /**
   * Creates a button with a counter badge
   */
  static createWithBadge(buttonOptions, badgeOptions) {
    const container = document.createElement('div');
    container.style.position = 'relative';
    container.style.display = 'inline-block';

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
    badge.className = classNames('cp-badge', `cp-badge-${variant}`);
    badge.textContent = count;
    badge.style.position = 'absolute';
    badge.style.top = '-6px';
    badge.style.right = '-6px';
    badge.style.pointerEvents = 'none';

    return badge;
  }

  /**
   * Updates the badge count on a button with badge
   */
  static updateBadge(container, count) {
    const badge = container.querySelector('.cp-badge');
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'flex' : 'none';
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
    return this.create({
      ...options,
      variant: 'chevron',
      icon,
      className: classNames('cp-chevron', options.className),
    });
  }

  /**
   * Creates a close button
   */
  static createClose(options = {}) {
    return this.create({
      ...options,
      variant: 'icon',
      icon: '✕',
      className: classNames('cp-close-btn', options.className),
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
    group.className = classNames('cp-btn-group', options.className);
    group.style.display = 'flex';
    group.style.gap = tokens.space('xs');

    if (options.direction === 'vertical') {
      group.style.flexDirection = 'column';
    }

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