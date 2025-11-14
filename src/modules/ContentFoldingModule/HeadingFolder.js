/**
 * HeadingFolder - Handles heading collapse/expand with hierarchical folding
 */
import DOMUtils from '../../utils/DOMUtils.js';
import { conversationStateStore } from '../../stores/index.js';

class HeadingFolder {
  constructor(module) {
    this.module = module;
    this.headingCache = new WeakMap(); // heading -> { chevron, isCollapsed, id, level }
    this.processedHeadings = new WeakSet();
  }

  /**
   * Scan message for headings and add chevrons
   */
  async scanMessage(messageEl, messageIndex) {
    try {
      // Get enabled heading levels from settings
      const enabledLevels = await this.module.getSetting('headings.levels') || ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
      const selector = enabledLevels.join(', ');

      // Find all headings
      const headings = messageEl.querySelectorAll(selector);

      for (const [index, heading] of Array.from(headings).entries()) {
        // Skip if already processed
        if (this.processedHeadings.has(heading)) continue;

        await this.processHeading(heading, messageEl, messageIndex, index);
        this.processedHeadings.add(heading);
      }
    } catch (error) {
      this.module.error('HeadingFolder scan error:', error);
    }
  }

  /**
   * Process individual heading
   */
  async processHeading(heading, messageEl, messageIndex, headingIndex) {
    // Generate unique ID
    const headingId = this.generateHeadingId(messageIndex, headingIndex, heading);

    // Get heading level (h1 -> 1, h2 -> 2, etc.)
    const level = parseInt(heading.tagName.substring(1));

    // Check if this heading should be collapsed (from storage)
    const foldingState = await conversationStateStore.getCurrentState('folding');
    const savedState = foldingState.headings[headingId];
    const isCollapsed = savedState !== undefined ? savedState : false;

    // Create chevron
    const chevron = this.createChevron(heading, isCollapsed);

    // Store in cache
    this.headingCache.set(heading, {
      chevron,
      isCollapsed,
      id: headingId,
      level,
      messageEl,
    });

    // Apply initial state
    if (isCollapsed) {
      this.collapseHeading(heading, false); // false = no animation
    }

    // Setup event listeners
    this.setupEventListeners(heading, chevron);
  }

  /**
   * Generate unique heading ID
   */
  generateHeadingId(messageIndex, headingIndex, heading) {
    // Create ID from message index + heading index + text content
    const text = heading.textContent.trim().substring(0, 50);
    return `h-${messageIndex}-${headingIndex}-${this.simpleHash(text)}`;
  }

  /**
   * Simple hash function
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Create chevron icon
   */
  createChevron(heading, isCollapsed) {
    const chevron = DOMUtils.createElement('span', {
      className: 'heading-fold-chevron',
      innerHTML: isCollapsed ? '▶' : '▼',
      style: {
        position: 'absolute',
        left: '-20px',
        cursor: 'pointer',
        fontSize: '14px',
        opacity: isCollapsed ? '0.7' : '0', // Visible if collapsed, hidden if expanded
        transition: 'all 0.15s ease',
        userSelect: 'none',
        color: 'inherit',
      }
    });

    // Make heading position relative for absolute chevron
    heading.style.position = 'relative';
    heading.style.cursor = 'pointer';

    // Insert chevron as first child
    heading.insertBefore(chevron, heading.firstChild);

    return chevron;
  }

  /**
   * Setup event listeners
   */
  setupEventListeners(heading, chevron) {
    const cached = this.headingCache.get(heading);

    // Hover: Show/hide chevron
    const onMouseEnter = () => {
      if (!cached.isCollapsed) {
        chevron.style.opacity = '0.7';
      }
    };

    const onMouseLeave = () => {
      if (!cached.isCollapsed) {
        chevron.style.opacity = '0';
      }
    };

    heading.addEventListener('mouseenter', onMouseEnter);
    heading.addEventListener('mouseleave', onMouseLeave);

    // Click: Toggle collapse
    const onClick = (e) => {
      e.stopPropagation();
      this.toggleHeading(heading);
    };

    heading.addEventListener('click', onClick);

    // Store cleanup functions
    this.module.unsubscribers.push(() => {
      heading.removeEventListener('mouseenter', onMouseEnter);
      heading.removeEventListener('mouseleave', onMouseLeave);
      heading.removeEventListener('click', onClick);
    });
  }

  /**
   * Toggle heading collapse/expand
   */
  async toggleHeading(heading) {
    const cached = this.headingCache.get(heading);
    if (!cached) return;

    if (cached.isCollapsed) {
      this.expandHeading(heading);
    } else {
      this.collapseHeading(heading);
    }

    // Save state
    if (await this.module.getSetting('rememberState')) {
      const foldingState = await conversationStateStore.getCurrentState('folding');
      foldingState.headings[cached.id] = cached.isCollapsed;
      await conversationStateStore.setCurrentState('folding', foldingState);
    }
  }

  /**
   * Collapse heading (hide content until next same/higher level heading)
   */
  collapseHeading(heading, animate = true) {
    const cached = this.headingCache.get(heading);
    if (!cached) return;

    cached.isCollapsed = true;
    cached.chevron.textContent = '▶';
    cached.chevron.style.opacity = '0.7'; // Always visible when collapsed

    // Find content to hide
    const contentElements = this.getHeadingContent(heading, cached.level);

    // Hide content
    contentElements.forEach(el => {
      if (animate) {
        // Animate collapse
        el.style.transition = 'all 0.2s ease';
        el.style.opacity = '0';
        el.style.maxHeight = '0';
        el.style.overflow = 'hidden';
        el.style.marginTop = '0';
        el.style.marginBottom = '0';

        setTimeout(() => {
          el.style.display = 'none';
        }, 200);
      } else {
        // Instant hide
        el.style.display = 'none';
      }
    });

    this.module.log(`Heading collapsed: ${heading.textContent.trim()}`);
  }

  /**
   * Expand heading (show content)
   */
  expandHeading(heading) {
    const cached = this.headingCache.get(heading);
    if (!cached) return;

    cached.isCollapsed = false;
    cached.chevron.textContent = '▼';
    cached.chevron.style.opacity = '0'; // Hidden when expanded (until hover)

    // Find content to show
    const contentElements = this.getHeadingContent(heading, cached.level);

    // Show content
    contentElements.forEach(el => {
      el.style.display = '';
      el.style.transition = 'all 0.2s ease';
      el.style.opacity = '1';
      el.style.maxHeight = '';
      el.style.overflow = '';
      el.style.marginTop = '';
      el.style.marginBottom = '';
    });

    this.module.log(`Heading expanded: ${heading.textContent.trim()}`);
  }

  /**
   * Get content elements for a heading (hierarchical)
   * Returns all elements until next same/higher level heading or HR separator
   * HR separator only applies to top-level content (not inside child headings)
   */
  getHeadingContent(heading, level) {
    const elements = [];
    let current = heading.nextElementSibling;
    let hasSeenChildHeading = false; // Track if we've encountered any child headings

    while (current) {
      // Check if it's a heading
      const match = current.tagName.match(/^H([1-6])$/);

      if (match) {
        const currentLevel = parseInt(match[1]);

        // Stop if we hit a same or higher level heading
        if (currentLevel <= level) {
          break;
        }

        // It's a child heading - mark that we've seen one
        hasSeenChildHeading = true;
      }

      // Only respect HR if we haven't seen any child headings yet
      // This ensures HR only separates top-level content, not content inside child sections
      if (current.tagName === 'HR' && !hasSeenChildHeading) {
        break;
      }

      elements.push(current);
      current = current.nextElementSibling;
    }

    return elements;
  }

  /**
   * Clean up all chevrons
   */
  cleanup() {
    this.processedHeadings = new WeakSet();
    this.headingCache = new WeakMap();
  }
}

export default HeadingFolder;
