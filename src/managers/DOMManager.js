/**
 * DOMManager - Centralized DOM operations and observation
 *
 * Provides a single place for all DOM operations, eliminating scattered MutationObservers
 * and providing safe, efficient DOM manipulation methods.
 *
 * Features:
 * - Single MutationObserver for entire app (better performance)
 * - Safe element creation (no innerHTML XSS vulnerabilities)
 * - Element caching for frequently accessed elements
 * - Event-based element detection
 * - Centralized DOM querying and manipulation
 */

import { debugLog } from '../config/debug.js';

class DOMManager {
  constructor() {
    this.observer = null;
    this.observerCallbacks = new Map(); // id -> {selector, callback, options}
    this.elementCache = new Map(); // cacheKey -> {element, timestamp}
    this.cacheTimeout = 5000; // Cache for 5 seconds
    this.destroyed = false;
    this.debugMode = false;
    this.isObserving = false;
  }

  /**
   * Initialize the DOM manager
   */
  init() {
    if (this.observer) {
      return;
    }

    this.setupObserver();

    if (this.debugMode) {
      debugLog('dom', 'Initialized');
    }
  }

  /**
   * Set debug mode
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
  }

  /**
   * Setup the main mutation observer
   */
  setupObserver() {
    if (this.observer) {
      return;
    }

    this.observer = new MutationObserver(mutations => {
      if (this.destroyed) {
        return;
      }

      // Process callbacks
      for (const [id, config] of this.observerCallbacks.entries()) {
        try {
          // Check if selector matches any mutated elements
          let shouldTrigger = false;

          for (const mutation of mutations) {
            if (config.selector) {
              // Check if the mutation affects elements matching the selector
              const addedNodes = Array.from(mutation.addedNodes);
              const removedNodes = Array.from(mutation.removedNodes);

              const checkNodes = nodes => {
                return nodes.some(node => {
                  if (node.nodeType !== Node.ELEMENT_NODE) {
                    return false;
                  }
                  return node.matches?.(config.selector) || node.querySelector?.(config.selector);
                });
              };

              if (checkNodes(addedNodes) || checkNodes(removedNodes)) {
                shouldTrigger = true;
                break;
              }
            } else {
              // No selector specified, trigger for any mutation
              shouldTrigger = true;
              break;
            }
          }

          if (shouldTrigger) {
            config.callback(mutations);
          }
        } catch (error) {
          console.error(`[DOMManager] Error in observer callback ${id}:`, error);
        }
      }
    });

    // Start observing with default config
    this.startObserving();
  }

  /**
   * Start observing the document
   */
  startObserving(target = document.body) {
    if (!this.observer || this.isObserving || !target) {
      return;
    }

    this.observer.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeOldValue: true,
      characterData: false,
    });

    this.isObserving = true;

    if (this.debugMode) {
      debugLog('dom', 'Started observing');
    }
  }

  /**
   * Stop observing
   */
  stopObserving() {
    if (!this.observer || !this.isObserving) {
      return;
    }

    this.observer.disconnect();
    this.isObserving = false;

    if (this.debugMode) {
      debugLog('dom', 'Stopped observing');
    }
  }

  /**
   * Register a callback for DOM mutations
   * @param {string} id - Unique identifier for the callback
   * @param {string|null} selector - CSS selector to watch (null for all mutations)
   * @param {Function} callback - Callback function
   * @param {Object} options - Additional options
   * @returns {Function} Cleanup function
   */
  observe(id, selector, callback, options = {}) {
    if (this.destroyed) {
      return () => {};
    }

    this.observerCallbacks.set(id, {
      selector,
      callback,
      options,
    });

    if (this.debugMode) {
      debugLog('dom', `Registered observer: ${id} for selector: ${selector}`);
    }

    // Return cleanup function
    return () => {
      this.observerCallbacks.delete(id);
      if (this.debugMode) {
        debugLog('dom', `Unregistered observer: ${id}`);
      }
    };
  }

  /**
   * Query for elements with caching
   * @param {string} selector - CSS selector
   * @param {HTMLElement} root - Root element to search from
   * @param {boolean} useCache - Whether to use cache
   * @returns {HTMLElement|null} Found element
   */
  querySelector(selector, root = document, useCache = true) {
    const cacheKey = `single_${selector}_${root === document ? 'document' : 'custom'}`;

    if (useCache) {
      const cached = this.elementCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        // Verify element is still in DOM
        if (cached.element && document.contains(cached.element)) {
          return cached.element;
        } else {
          this.elementCache.delete(cacheKey);
        }
      }
    }

    const element = root.querySelector(selector);

    if (element && useCache) {
      this.elementCache.set(cacheKey, {
        element,
        timestamp: Date.now(),
      });
    }

    return element;
  }

  /**
   * Query for multiple elements with caching
   * @param {string} selector - CSS selector
   * @param {HTMLElement} root - Root element to search from
   * @param {boolean} useCache - Whether to use cache
   * @returns {HTMLElement[]} Found elements
   */
  querySelectorAll(selector, root = document, useCache = false) {
    const cacheKey = `multiple_${selector}_${root === document ? 'document' : 'custom'}`;

    if (useCache) {
      const cached = this.elementCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        // For NodeLists, we need to verify all elements are still in DOM
        const stillValid = Array.from(cached.elements).every(el => document.contains(el));
        if (stillValid) {
          return Array.from(cached.elements);
        } else {
          this.elementCache.delete(cacheKey);
        }
      }
    }

    const elements = root.querySelectorAll(selector);
    const elementsArray = Array.from(elements);

    if (elementsArray.length > 0 && useCache) {
      this.elementCache.set(cacheKey, {
        elements: elementsArray,
        timestamp: Date.now(),
      });
    }

    return elementsArray;
  }

  /**
   * Create element safely (no innerHTML)
   * @param {string} tag - HTML tag name
   * @param {Object} attributes - Element attributes
   * @param {string|HTMLElement|HTMLElement[]} content - Element content
   * @returns {HTMLElement} Created element
   */
  createElement(tag, attributes = {}, content = null) {
    const element = document.createElement(tag);

    // Set attributes
    for (const [key, value] of Object.entries(attributes)) {
      if (key === 'className') {
        element.className = value;
      } else if (key === 'style' && typeof value === 'object') {
        Object.assign(element.style, value);
      } else if (key === 'dataset' && typeof value === 'object') {
        Object.assign(element.dataset, value);
      } else if (key.startsWith('on') && typeof value === 'function') {
        // Event listener
        const eventName = key.substring(2).toLowerCase();
        element.addEventListener(eventName, value);
      } else {
        element.setAttribute(key, value);
      }
    }

    // Set content
    if (content !== null) {
      if (typeof content === 'string') {
        element.textContent = content;
      } else if (content instanceof HTMLElement) {
        element.appendChild(content);
      } else if (Array.isArray(content)) {
        content.forEach(child => {
          if (typeof child === 'string') {
            element.appendChild(document.createTextNode(child));
          } else if (child instanceof HTMLElement) {
            element.appendChild(child);
          }
        });
      }
    }

    return element;
  }

  /**
   * Safely set HTML content (sanitized)
   * @param {HTMLElement} element - Target element
   * @param {string} html - HTML content
   * @param {boolean} sanitize - Whether to sanitize (default: true)
   */
  setHTML(element, html, sanitize = true) {
    if (!element) {
      return;
    }

    if (sanitize) {
      // Basic sanitization - remove script tags and event handlers
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;

      // Remove script tags
      const scripts = tempDiv.querySelectorAll('script');
      scripts.forEach(script => script.remove());

      // Remove event handlers
      const allElements = tempDiv.querySelectorAll('*');
      allElements.forEach(el => {
        // Remove all on* attributes
        Array.from(el.attributes).forEach(attr => {
          if (attr.name.startsWith('on')) {
            el.removeAttribute(attr.name);
          }
        });
      });

      // Clear element and append sanitized content
      element.innerHTML = '';
      while (tempDiv.firstChild) {
        element.appendChild(tempDiv.firstChild);
      }
    } else {
      // Use textContent for complete safety
      element.textContent = html;
    }
  }

  /**
   * Safely set text or simple HTML content
   * @param {HTMLElement} element - Target element
   * @param {string} content - Content to set
   * @param {boolean} isHTML - Whether content contains HTML (default: false)
   */
  setContent(element, content, isHTML = false) {
    if (!element) {
      return;
    }

    if (isHTML) {
      // For simple HTML like icons, emojis, or trusted content
      this.setHTML(element, content, true);
    } else {
      // For plain text
      element.textContent = content;
    }
  }

  /**
   * Create SVG element
   * @param {string} svgString - SVG string
   * @returns {SVGElement} Created SVG element
   */
  createSVG(svgString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const svg = doc.documentElement;

    // Check for parse errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      console.error('[DOMManager] SVG parse error:', parseError.textContent);
      return null;
    }

    return svg;
  }

  /**
   * Insert element at specific position
   * @param {HTMLElement} element - Element to insert
   * @param {HTMLElement} target - Target element
   * @param {string} position - Position (beforebegin, afterbegin, beforeend, afterend)
   */
  insertElement(element, target, position = 'beforeend') {
    if (!element || !target) {
      return;
    }

    switch (position) {
      case 'beforebegin':
        target.parentNode?.insertBefore(element, target);
        break;
      case 'afterbegin':
        target.insertBefore(element, target.firstChild);
        break;
      case 'beforeend':
        target.appendChild(element);
        break;
      case 'afterend':
        target.parentNode?.insertBefore(element, target.nextSibling);
        break;
      default:
        target.appendChild(element);
    }
  }

  /**
   * Remove element safely
   * @param {HTMLElement} element - Element to remove
   */
  removeElement(element) {
    if (!element) {
      return;
    }

    // Clear cache entries for this element
    for (const [key, cached] of this.elementCache.entries()) {
      if (
        cached.element === element ||
        (Array.isArray(cached.elements) && cached.elements.includes(element))
      ) {
        this.elementCache.delete(key);
      }
    }

    element.remove();
  }

  /**
   * Add CSS to the page
   * @param {string} css - CSS content
   * @param {string} id - Style element ID
   */
  addStyles(css, id = null) {
    let styleElement;

    if (id) {
      styleElement = document.getElementById(id);
    }

    if (!styleElement) {
      styleElement = this.createElement('style', {
        type: 'text/css',
        id: id || `dom-manager-styles-${Date.now()}`,
      });
      document.head.appendChild(styleElement);
    }

    styleElement.textContent = css;
    return styleElement;
  }

  /**
   * Check if element is visible
   * @param {HTMLElement} element - Element to check
   * @returns {boolean} True if visible
   */
  isVisible(element) {
    if (!element) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);

    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0'
    );
  }

  /**
   * Scroll element into view
   * @param {HTMLElement} element - Element to scroll to
   * @param {Object} options - Scroll options
   */
  scrollIntoView(element, options = {}) {
    if (!element) {
      return;
    }

    const defaultOptions = {
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    };

    element.scrollIntoView({ ...defaultOptions, ...options });
  }

  /**
   * Get element position relative to viewport
   * @param {HTMLElement} element - Element to get position for
   * @returns {Object} Position object
   */
  getElementPosition(element) {
    if (!element) {
      return null;
    }

    const rect = element.getBoundingClientRect();
    return {
      top: rect.top,
      left: rect.left,
      bottom: rect.bottom,
      right: rect.right,
      width: rect.width,
      height: rect.height,
      x: rect.x,
      y: rect.y,
    };
  }

  /**
   * Clear element cache
   */
  clearCache() {
    this.elementCache.clear();

    if (this.debugMode) {
      debugLog('dom', 'Cache cleared');
    }
  }

  /**
   * Get statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      observers: this.observerCallbacks.size,
      cachedElements: this.elementCache.size,
      isObserving: this.isObserving,
    };
  }

  /**
   * Destroy the manager
   */
  destroy() {
    this.destroyed = true;

    // Stop observing
    this.stopObserving();

    // Clear callbacks
    this.observerCallbacks.clear();

    // Clear cache
    this.clearCache();

    // Disconnect observer
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    if (this.debugMode) {
      debugLog('dom', 'Destroyed');
    }
  }
}

// Export as singleton
const domManager = new DOMManager();
export default domManager;
