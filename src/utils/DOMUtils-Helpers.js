/**
 * DOMUtils-Helpers - Helper utilities for DOM manipulation
 * Includes debounce, throttle, element creation, and CSS utilities
 */

const DOMUtilsHelpers = {
  /**
   * Debounce function
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in ms
   * @returns {Function}
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * Throttle function
   * @param {Function} func - Function to throttle
   * @param {number} limit - Limit time in ms
   * @returns {Function}
   */
  throttle(func, limit) {
    let inThrottle;
    return function (...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  },

  /**
   * Flash CSS class on element (with animation)
   * @param {HTMLElement} element
   * @param {string} className
   * @param {number} duration - Duration in ms
   */
  flashClass(element, className, duration = 2000) {
    if (!element) {
      return;
    }

    element.classList.add(className);
    setTimeout(() => {
      element.classList.remove(className);
    }, duration);
  },

  /**
   * Inject CSS into page
   * @param {string} css - CSS string
   * @param {string} id - Style element ID (optional)
   * @returns {HTMLStyleElement}
   */
  injectCSS(css, id = null) {
    // Remove existing style if ID provided
    if (id) {
      const existing = document.getElementById(id);
      if (existing) {
        existing.remove();
      }
    }

    const style = document.createElement('style');
    if (id) {
      style.id = id;
    }
    style.textContent = css;
    document.head.appendChild(style);
    return style;
  },

  /**
   * Create element helper
   * @param {string} tag - HTML tag
   * @param {Object} attrs - Attributes
   * @param {string} content - Content
   * @returns {HTMLElement}
   */
  createElement(tag, attrs = {}, content = '') {
    const element = document.createElement(tag);

    Object.entries(attrs).forEach(([key, value]) => {
      if (key === 'className') {
        element.className = value;
      } else if (key === 'style' && typeof value === 'object') {
        Object.assign(element.style, value);
      } else if (key.startsWith('data-')) {
        element.setAttribute(key, value);
      } else if (key === 'innerHTML') {
        element.innerHTML = value;
      } else if (key === 'textContent') {
        element.textContent = value;
      } else {
        element[key] = value;
      }
    });

    if (content && !attrs.innerHTML && !attrs.textContent) {
      element.innerHTML = content;
    }

    return element;
  },

  /**
   * Wait for element to appear in DOM
   * @param {string} selector - CSS selector
   * @param {number} timeout - Timeout in ms
   * @returns {Promise<HTMLElement>}
   */
  waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver((mutations, obs) => {
        const element = document.querySelector(selector);
        if (element) {
          obs.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element ${selector} not found after ${timeout}ms`));
      }, timeout);
    });
  },

  /**
   * Copy text to clipboard
   * @param {string} text - Text to copy
   * @returns {Promise<void>}
   */
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();

      try {
        document.execCommand('copy');
        document.body.removeChild(textarea);
        return true;
      } catch (err) {
        document.body.removeChild(textarea);
        throw err;
      }
    }
  },

  /**
   * Generate unique ID
   * @param {string} prefix - Optional prefix
   * @returns {string}
   */
  generateId(prefix = 'claude-prod') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Parse CSS size value (px, %, em, etc.)
   * @param {string} value - CSS size value
   * @returns {number} Numeric value
   */
  parseSize(value) {
    if (typeof value === 'number') {
      return value;
    }
    if (!value) {
      return 0;
    }

    const match = value.toString().match(/^(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : 0;
  },

  /**
   * Get element's computed style property
   * @param {HTMLElement} element
   * @param {string} property
   * @returns {string}
   */
  getStyle(element, property) {
    if (!element) {
      return null;
    }
    return window.getComputedStyle(element).getPropertyValue(property);
  },

  /**
   * Set multiple styles at once
   * @param {HTMLElement} element
   * @param {Object} styles
   */
  setStyles(element, styles) {
    if (!element || !styles) {
      return;
    }
    Object.assign(element.style, styles);
  },

  /**
   * Remove all children from element
   * @param {HTMLElement} element
   */
  clearElement(element) {
    if (!element) {
      return;
    }
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  },
};

export default DOMUtilsHelpers;
