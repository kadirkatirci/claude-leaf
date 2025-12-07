/**
 * CodeBlockFolder - Handles folding/unfolding of code blocks
 */
import DOMUtils from '../../utils/DOMUtils.js';
import IconLibrary from '../../components/primitives/IconLibrary.js';
import { conversationStateStore } from '../../stores/index.js';
import { MODULE_CONSTANTS } from '../../config/ModuleConstants.js';

const FOLDING_CONFIG = MODULE_CONSTANTS.contentFolding;

class CodeBlockFolder {
  constructor(module) {
    this.module = module;
    this.codeBlockCache = new WeakMap(); // codeBlock -> { button, isCollapsed, id, lineCount }
    this.processedBlocks = new WeakSet();
    this.failures = { blocks: [], reasons: new Map() }; // Track failures
  }

  /**
   * Scan message for code blocks
   */
  async scanMessage(messageEl, messageIndex) {
    try {
      // Find all code blocks (pre > code pattern)
      const codeBlocks = messageEl.querySelectorAll('pre');

      for (const [index, preEl] of Array.from(codeBlocks).entries()) {
        // Skip if already processed
        if (this.processedBlocks.has(preEl)) continue;

        const codeEl = preEl.querySelector('code');
        if (!codeEl) continue;

        // Count lines
        const lineCount = this.countLines(codeEl);

        // Get min lines threshold
        const minLines = FOLDING_CONFIG.codeBlocks.minLines;

        // Only process if longer than threshold
        if (lineCount >= minLines) {
          try {
            await this.processCodeBlock(preEl, codeEl, messageIndex, index, lineCount);
            this.processedBlocks.add(preEl);
          } catch (error) {
            this.module.error(`Failed to process code block ${index}:`, error);

            // Track failure
            this.failures.blocks.push({ messageIndex, blockIndex: index, preEl });
            this.failures.reasons.set(preEl, error.message);

            // Mark as processed to avoid retry loops
            this.processedBlocks.add(preEl);
          }
        }
      }
    } catch (error) {
      this.module.error('CodeBlockFolder scan error:', error);
    }
  }

  /**
   * Count lines in code block
   */
  countLines(codeEl) {
    const text = codeEl.textContent || '';
    return text.split('\n').length;
  }

  /**
   * Get computed line height with fallback for 'normal'
   */
  getComputedLineHeight(element) {
    const computed = window.getComputedStyle(element);
    let lineHeight = parseInt(computed.lineHeight);

    // Handle 'normal' value
    if (isNaN(lineHeight)) {
      const fontSize = parseInt(computed.fontSize) || 16;
      lineHeight = Math.round(fontSize * 1.5); // Standard 1.5x ratio
    }

    return Math.max(lineHeight, 16); // Minimum 16px
  }

  /**
   * Process individual code block
   */
  async processCodeBlock(preEl, codeEl, messageIndex, blockIndex, lineCount) {
    // Generate unique ID
    const blockId = this.generateBlockId(messageIndex, blockIndex, codeEl);

    // Check if should auto-collapse
    const autoCollapse = FOLDING_CONFIG.codeBlocks.autoCollapse;

    // Check saved state or use auto-collapse setting
    const foldingState = await conversationStateStore.getCurrentState('folding');
    const savedState = foldingState.codeBlocks[blockId];
    const isCollapsed = savedState !== undefined ? savedState : autoCollapse;

    // Ensure pre element is positioned for absolute button
    if (getComputedStyle(preEl).position === 'static') {
      preEl.style.position = 'relative';
    }

    // Create collapse button
    const button = this.createCollapseButton(preEl, isCollapsed, lineCount);

    // Store in cache
    this.codeBlockCache.set(preEl, {
      button,
      isCollapsed,
      id: blockId,
      lineCount,
      codeEl,
      originalMaxHeight: preEl.style.maxHeight,
      originalOverflow: preEl.style.overflow,
    });

    // Apply initial state
    if (isCollapsed) {
      await this.collapseCodeBlock(preEl, false); // false = no animation
    }

    // Setup event listeners
    this.setupEventListeners(preEl, button);
  }

  /**
   * Generate unique block ID
   */
  generateBlockId(messageIndex, blockIndex, codeEl) {
    // Create ID from message index + block index + code hash
    const code = codeEl.textContent.trim().substring(0, 100);
    return `cb-${messageIndex}-${blockIndex}-${this.simpleHash(code)}`;
  }

  /**
   * Simple hash function
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Create collapse button
   */
  createCollapseButton(preEl, isCollapsed, lineCount) {
    const theme = this.module.getTheme();

    const button = DOMUtils.createElement('button', {
      className: 'code-fold-button',
      type: 'button',
      innerHTML: isCollapsed
        ? IconLibrary.expand('currentColor', 16)
        : IconLibrary.collapse('currentColor', 16),
      title: isCollapsed ? `Expand ${lineCount} lines` : 'Collapse code',
      'aria-label': isCollapsed ? `Expand ${lineCount} lines of code` : 'Collapse code block',
      'aria-expanded': !isCollapsed,
      tabIndex: 0,
      style: {
        position: 'absolute',
        top: '8px',
        right: '8px',
        width: '28px',
        height: '28px',
        borderRadius: '6px',
        border: 'none',
        background: theme.isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
        cursor: 'pointer',
        fontSize: '14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: isCollapsed ? '0.8' : '0', // Visible if collapsed, hidden if expanded
        transition: 'all 0.15s ease',
        zIndex: '10',
        padding: '0',
      }
    });

    // Hover effect on button itself
    button.addEventListener('mouseenter', () => {
      button.style.background = theme.isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)';
      button.style.transform = 'scale(1.05)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = theme.isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';
      button.style.transform = 'scale(1)';
    });

    preEl.appendChild(button);

    return button;
  }

  /**
   * Setup event listeners
   */
  setupEventListeners(preEl, button) {
    const cached = this.codeBlockCache.get(preEl);

    // Hover on code block: Show/hide button
    const onMouseEnter = () => {
      if (!cached.isCollapsed) {
        button.style.opacity = '0.8';
      }
    };

    const onMouseLeave = () => {
      if (!cached.isCollapsed) {
        button.style.opacity = '0';
      }
    };

    preEl.addEventListener('mouseenter', onMouseEnter);
    preEl.addEventListener('mouseleave', onMouseLeave);

    // Click button: Toggle collapse
    const onClick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.toggleCodeBlock(preEl);
    };

    button.addEventListener('click', onClick);

    // Keyboard: Enter/Space to toggle
    const onKeyDown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.toggleCodeBlock(preEl);
      }
    };

    button.addEventListener('keydown', onKeyDown);

    // Store cleanup functions
    this.module.unsubscribers.push(() => {
      preEl.removeEventListener('mouseenter', onMouseEnter);
      preEl.removeEventListener('mouseleave', onMouseLeave);
      button.removeEventListener('click', onClick);
      button.removeEventListener('keydown', onKeyDown);
    });
  }

  /**
   * Toggle code block collapse/expand
   */
  async toggleCodeBlock(preEl) {
    const cached = this.codeBlockCache.get(preEl);
    if (!cached) return;

    if (cached.isCollapsed) {
      this.expandCodeBlock(preEl);
    } else {
      await this.collapseCodeBlock(preEl);
    }

    // Update ARIA attributes
    cached.button.setAttribute('aria-expanded', !cached.isCollapsed);
    cached.button.setAttribute('aria-label',
      cached.isCollapsed
        ? `Expand ${cached.lineCount} lines of code`
        : 'Collapse code block'
    );

    // Save state (debounced)
    if (FOLDING_CONFIG.rememberState) {
      const foldingState = await conversationStateStore.getCurrentState('folding');
      foldingState.codeBlocks[cached.id] = cached.isCollapsed;
      this.module.debouncedStateSave(foldingState);
    }
  }

  /**
   * Collapse code block (show preview + expand button)
   */
  async collapseCodeBlock(preEl, animate = true) {
    const cached = this.codeBlockCache.get(preEl);
    if (!cached) return;

    cached.isCollapsed = true;
    cached.button.innerHTML = IconLibrary.expand('currentColor', 16);
    cached.button.title = `Expand ${cached.lineCount} lines`;
    cached.button.style.opacity = '0.8'; // Always visible when collapsed

    // Calculate preview height (previewLines * line height)
    const previewLines = FOLDING_CONFIG.codeBlocks.previewLines;
    const lineHeight = this.getComputedLineHeight(cached.codeEl);
    const previewHeight = previewLines * lineHeight;

    // Apply collapsed styles
    if (animate) {
      preEl.style.transition = 'max-height 0.3s ease, opacity 0.3s ease';
    }

    preEl.style.maxHeight = `${previewHeight}px`;
    preEl.style.overflow = 'hidden';
    preEl.style.position = 'relative';

    // Add fade gradient
    this.addFadeGradient(preEl);

    // Add expand footer
    this.addExpandFooter(preEl, cached.lineCount, previewLines);

    this.module.log(`Code block collapsed: ${cached.lineCount} lines`);
  }

  /**
   * Expand code block (show full code)
   */
  expandCodeBlock(preEl) {
    const cached = this.codeBlockCache.get(preEl);
    if (!cached) return;

    cached.isCollapsed = false;
    cached.button.innerHTML = IconLibrary.collapse('currentColor', 16);
    cached.button.title = 'Collapse code';
    cached.button.style.opacity = '0'; // Hidden when expanded (until hover)

    // Remove collapsed styles
    preEl.style.transition = 'max-height 0.3s ease';
    preEl.style.maxHeight = cached.originalMaxHeight || '';
    preEl.style.overflow = cached.originalOverflow || '';

    // Remove fade gradient
    this.removeFadeGradient(preEl);

    // Remove expand footer
    this.removeExpandFooter(preEl);

    this.module.log(`Code block expanded: ${cached.lineCount} lines`);
  }

  /**
   * Add fade gradient overlay
   */
  addFadeGradient(preEl) {
    FadeGradientHelper.add(preEl, {
      height: '60px',
      className: 'code-fold-gradient',
      zIndex: '5'
    });
  }

  /**
   * Remove fade gradient
   */
  removeFadeGradient(preEl) {
    FadeGradientHelper.remove(preEl, 'code-fold-gradient');
  }

  /**
   * Add expand footer button
   */
  addExpandFooter(preEl, totalLines, previewLines) {
    // Remove existing footer
    this.removeExpandFooter(preEl);

    const theme = this.module.getTheme();
    const hiddenLines = totalLines - previewLines;

    const footer = DOMUtils.createElement('div', {
      className: 'code-fold-footer',
      innerHTML: `▼ Show ${hiddenLines} more line${hiddenLines !== 1 ? 's' : ''}`,
      style: {
        position: 'absolute',
        bottom: '0',
        left: '0',
        right: '0',
        padding: '8px 12px',
        background: theme.isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.9)',
        color: theme.isDark ? '#aaa' : '#666',
        fontSize: '12px',
        textAlign: 'center',
        cursor: 'pointer',
        borderTop: `1px solid ${theme.isDark ? '#333' : '#e5e5e5'}`,
        transition: 'all 0.15s ease',
        zIndex: '10',
        userSelect: 'none',
      }
    });

    // Hover effect
    footer.addEventListener('mouseenter', () => {
      footer.style.background = theme.isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 1)';
      footer.style.color = theme.isDark ? '#fff' : '#000';
    });

    footer.addEventListener('mouseleave', () => {
      footer.style.background = theme.isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.9)';
      footer.style.color = theme.isDark ? '#aaa' : '#666';
    });

    // Click to expand
    footer.addEventListener('click', (e) => {
      e.stopPropagation();
      this.expandCodeBlock(preEl);
    });

    preEl.appendChild(footer);
  }

  /**
   * Remove expand footer
   */
  removeExpandFooter(preEl) {
    const footer = preEl.querySelector('.code-fold-footer');
    if (footer) {
      footer.remove();
    }
  }

  /**
   * Clean up all buttons and styles
   */
  cleanup() {
    // Report failures if any
    if (this.failures.blocks.length > 0) {
      this.module.warn(`${this.failures.blocks.length} code blocks failed to process`);
      if (this.failures.reasons.size > 0) {
        this.module.log('Failure reasons:', Array.from(this.failures.reasons.values()));
      }
    }

    // Reset state
    this.failures = { blocks: [], reasons: new Map() };
    this.processedBlocks = new WeakSet();
    this.codeBlockCache = new WeakMap();
  }
}

export default CodeBlockFolder;
