/**
 * DOMUtils-Parsing - Content parsing utilities
 * Handles edit history, markdown parsing, and content analysis
 */

import DOMUtilsCore from './DOMUtils-Core.js';

const DOMUtilsParsing = {
  /**
   * Find edited prompts
   * Detects Claude messages with edit icons
   * @returns {Array<{element: HTMLElement, editButton: HTMLElement, versionInfo: string}>}
   */
  getEditedPrompts() {
    const edited = [];

    // First check if we're on a conversation page
    if (!DOMUtilsCore.isOnConversationPage()) {
      return edited;
    }

    // Get only real messages (excluding sidebar)
    const messageContainers = DOMUtilsCore.findActualMessages();

    messageContainers.forEach((container, idx) => {
      // Does this container have a user message?
      const userMessage = container.querySelector('[data-testid="user-message"]');
      if (!userMessage) return;

      // Look for version counter ("e.g., 3 / 3")
      // Check all spans in container
      const allSpans = container.querySelectorAll('span');
      let versionSpan = null;

      for (const span of allSpans) {
        const text = span.textContent.trim();
        if (/^\d+\s*\/\s*\d+$/.test(text)) {
          versionSpan = span;
          break;
        }
      }

      if (versionSpan) {
        const versionText = versionSpan.textContent.trim();
        const parts = versionText.split('/');

        if (parts.length === 2) {
          const current = parseInt(parts[0].trim());
          const total = parseInt(parts[1].trim());

          // Only if total > 1 means it has been edited
          if (total > 1 && !isNaN(current) && !isNaN(total)) {
            // Find edit button (retry button - circular arrow icon)
            const retryButton = container.querySelector('button svg path[d*="M10.3857"]')?.closest('button');

            // Generate a unique ID using multiple sources for better uniqueness
            // Since data-test-render-count might not be unique, use element's position + content hash
            let containerId = container.getAttribute('data-test-render-count');

            if (!containerId || containerId === '2') {
              // Fallback: Use index + content signature for uniqueness
              const contentSignature = userMessage.textContent.substring(0, 50).replace(/\s+/g, '');
              containerId = `msg-${idx}-${contentSignature.substring(0, 20)}`;
            }

            edited.push({
              element: container,
              editButton: retryButton,
              versionInfo: versionText,
              currentVersion: current,
              totalVersions: total,
              hasEditHistory: true,
              containerId: containerId
            });
          }
        }
      }
    });

    return edited;
  },

  /**
   * Parse markdown headings
   * @param {HTMLElement} element - Element to parse
   * @returns {Object[]} List of headings {level, text, element}
   */
  parseMarkdownHeadings(element) {
    const headings = [];
    const headingSelectors = 'h1, h2, h3, h4, h5, h6';
    const foundHeadings = element.querySelectorAll(headingSelectors);

    foundHeadings.forEach(heading => {
      headings.push({
        level: parseInt(heading.tagName.charAt(1)),
        text: heading.textContent.trim(),
        element: heading,
        id: heading.id || null
      });
    });

    return headings;
  },

  /**
   * Extract text content from element (cleaned)
   * @param {HTMLElement} element
   * @returns {string}
   */
  extractTextContent(element) {
    if (!element) return '';

    // Clone to avoid modifying original
    const clone = element.cloneNode(true);

    // Remove script and style elements
    const scripts = clone.querySelectorAll('script, style');
    scripts.forEach(s => s.remove());

    // Get text and clean up
    return clone.textContent
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\n{3,}/g, '\n\n');
  },

  /**
   * Parse code blocks in element
   * @param {HTMLElement} element
   * @returns {Array<{language: string, code: string, element: HTMLElement}>}
   */
  parseCodeBlocks(element) {
    if (!element) return [];

    const codeBlocks = [];
    const preElements = element.querySelectorAll('pre');

    preElements.forEach(pre => {
      const codeElement = pre.querySelector('code');
      if (codeElement) {
        // Try to detect language from class
        const classNames = Array.from(codeElement.classList);
        const langClass = classNames.find(c => c.startsWith('language-'));
        const language = langClass ? langClass.replace('language-', '') : 'plaintext';

        codeBlocks.push({
          language,
          code: codeElement.textContent,
          element: pre,
          lines: codeElement.textContent.split('\n').length
        });
      }
    });

    return codeBlocks;
  },

  /**
   * Parse links in element
   * @param {HTMLElement} element
   * @returns {Array<{text: string, href: string, element: HTMLElement}>}
   */
  parseLinks(element) {
    if (!element) return [];

    const links = [];
    const anchorElements = element.querySelectorAll('a');

    anchorElements.forEach(anchor => {
      links.push({
        text: anchor.textContent.trim(),
        href: anchor.href,
        element: anchor,
        isExternal: anchor.hostname !== window.location.hostname
      });
    });

    return links;
  },

  /**
   * Get content statistics
   * @param {HTMLElement} element
   * @returns {Object} Statistics
   */
  getContentStats(element) {
    if (!element) {
      return {
        words: 0,
        characters: 0,
        lines: 0,
        headings: 0,
        codeBlocks: 0,
        links: 0
      };
    }

    const text = this.extractTextContent(element);
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const lines = text.split('\n').filter(l => l.trim().length > 0);

    return {
      words: words.length,
      characters: text.length,
      lines: lines.length,
      headings: this.parseMarkdownHeadings(element).length,
      codeBlocks: this.parseCodeBlocks(element).length,
      links: this.parseLinks(element).length
    };
  },

  /**
   * Generate content signature for comparison
   * @param {HTMLElement} element
   * @param {number} maxLength - Maximum characters to include
   * @returns {string}
   */
  generateContentSignature(element, maxLength = 1000) {
    if (!element) return '';

    const text = this.extractTextContent(element);
    const truncated = text.substring(0, maxLength);

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < truncated.length; i++) {
      const char = truncated.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    return hash.toString(36);
  },

  /**
   * Find elements by text content
   * @param {string} searchText
   * @param {HTMLElement} container
   * @returns {HTMLElement[]}
   */
  findByTextContent(searchText, container = document.body) {
    const elements = [];
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let node;
    while (node = walker.nextNode()) {
      if (node.nodeValue && node.nodeValue.includes(searchText)) {
        const parent = node.parentElement;
        if (parent && !elements.includes(parent)) {
          elements.push(parent);
        }
      }
    }

    return elements;
  },

  /**
   * Check if element contains specific content patterns
   * @param {HTMLElement} element
   * @param {Object} patterns
   * @returns {Object}
   */
  analyzeContentPatterns(element, patterns = {}) {
    const results = {};
    const text = this.extractTextContent(element);

    // Default patterns
    const defaultPatterns = {
      hasQuestion: /\?/,
      hasCode: /<code>|```/,
      hasURL: /https?:\/\/[^\s]+/,
      hasEmail: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
      hasNumber: /\d+/,
      ...patterns
    };

    for (const [key, pattern] of Object.entries(defaultPatterns)) {
      results[key] = pattern.test(text);
    }

    return results;
  }
};

export default DOMUtilsParsing;