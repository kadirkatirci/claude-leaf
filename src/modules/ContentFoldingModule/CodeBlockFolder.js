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
  async scanMessage(messageEl, messageIndex, configArg) {
    try {
      this.config = configArg || this.config;
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
        const minLines = config.codeBlocks.minLines;

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
    const config = this.config || FOLDING_CONFIG;
    const autoCollapse = config.codeBlocks.autoCollapse;

    // Check saved state or use auto-collapse setting
    const foldingState = await conversationStateStore.getCurrentState('folding');
    // ... (lines 97-285 unchanged mostly)

    // Calculate preview height (previewLines * line height)
    const previewLines = config.codeBlocks.previewLines;
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
