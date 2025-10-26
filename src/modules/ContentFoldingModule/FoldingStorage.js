/**
 * FoldingStorage - Manages state persistence for folded content
 * Stores collapse/expand states per conversation
 */

class FoldingStorage {
  constructor(module) {
    this.module = module;
    this.storageKey = 'claude-folding-states';
    this.currentConversationUrl = this.getConversationUrl();
    this.state = this.loadState();
  }

  /**
   * Get current conversation URL (identifier)
   */
  getConversationUrl() {
    return window.location.pathname + window.location.search;
  }

  /**
   * Load state from localStorage
   */
  loadState() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return this.getDefaultState();

      const allStates = JSON.parse(stored);

      // Return state for current conversation, or default
      return allStates[this.currentConversationUrl] || this.getDefaultState();
    } catch (error) {
      this.module.error('FoldingStorage load error:', error);
      return this.getDefaultState();
    }
  }

  /**
   * Get default empty state
   */
  getDefaultState() {
    return {
      headings: {},     // { headingId: isCollapsed }
      codeBlocks: {},   // { blockId: isCollapsed }
    };
  }

  /**
   * Save state to localStorage
   */
  saveState() {
    try {
      // Load all states
      const stored = localStorage.getItem(this.storageKey);
      const allStates = stored ? JSON.parse(stored) : {};

      // Update current conversation state
      allStates[this.currentConversationUrl] = this.state;

      // Save back
      localStorage.setItem(this.storageKey, JSON.stringify(allStates));

      this.module.log('💾 Folding state saved');
    } catch (error) {
      this.module.error('FoldingStorage save error:', error);
    }
  }

  /**
   * Get heading state
   */
  getHeadingState(headingId) {
    return this.state.headings[headingId] !== undefined
      ? this.state.headings[headingId]
      : null;
  }

  /**
   * Set heading state
   */
  setHeadingState(headingId, isCollapsed) {
    this.state.headings[headingId] = isCollapsed;
    this.saveState();
  }

  /**
   * Get code block state
   */
  getCodeBlockState(blockId) {
    return this.state.codeBlocks[blockId] !== undefined
      ? this.state.codeBlocks[blockId]
      : null;
  }

  /**
   * Set code block state
   */
  setCodeBlockState(blockId, isCollapsed) {
    this.state.codeBlocks[blockId] = isCollapsed;
    this.saveState();
  }

  /**
   * Clear state for current conversation
   */
  clearCurrentConversation() {
    this.state = this.getDefaultState();
    this.saveState();
  }

  /**
   * Clear all states (all conversations)
   */
  clearAll() {
    localStorage.removeItem(this.storageKey);
    this.state = this.getDefaultState();
  }
}

export default FoldingStorage;
