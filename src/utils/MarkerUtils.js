/**
 * MarkerUtils - Shared utilities for marker/bookmark index resolution
 * 
 * Problem: When user changes edit version, messages after that edit point change,
 * causing index-based markers to point to wrong messages.
 * 
 * Solution: Multi-strategy content-based verification
 * 1. Try saved index first with signature verification
 * 2. Search by content signature
 * 3. Search by preview text (fuzzy)
 * 4. Search by user message preview (for version changes)
 * 
 * Version Change Handling:
 * When edit version changes, Claude's response changes but user message stays the same.
 * For Claude response markers, we use the parent user message to locate the correct position.
 */

import { hashString } from './HashUtils.js';

/**
 * Get clean text content from a message element
 * Excludes marker buttons, bookmark buttons, and other injected UI
 * @param {HTMLElement} messageEl - Message element
 * @returns {string} - Clean text content
 */
export function getCleanMessageText(messageEl) {
  if (!messageEl) return '';
  
  // Clone to avoid modifying original
  const clone = messageEl.cloneNode(true);
  
  // Remove all injected UI elements
  const selectorsToRemove = [
    '.emoji-marker-btn',
    '.emoji-marker-badge',
    '.emoji-marker-options',
    '.claude-bookmark-btn',
    '.bookmark-badge',
    '[class*="marker"]',
    '[class*="bookmark"]',
    'button',
    'script',
    'style'
  ];
  
  selectorsToRemove.forEach(selector => {
    clone.querySelectorAll(selector).forEach(el => el.remove());
  });
  
  return clone.textContent.trim();
}

/**
 * Generate content signature for a message
 * @param {HTMLElement} messageEl - Message element
 * @param {number} maxLength - Max chars to use for signature (default: 1000)
 * @returns {string} - Content signature hash
 */
export function generateSignature(messageEl, maxLength = 1000) {
  const text = getCleanMessageText(messageEl);
  return hashString(text.substring(0, maxLength));
}

/**
 * Generate preview text for a message
 * @param {HTMLElement} messageEl - Message element
 * @param {number} maxLength - Max chars for preview (default: 100)
 * @returns {string} - Preview text
 */
export function generatePreview(messageEl, maxLength = 100) {
  const text = getCleanMessageText(messageEl);
  return text.substring(0, maxLength).trim();
}

/**
 * Check if message is a user message
 * @param {HTMLElement} messageEl - Message element
 * @returns {boolean}
 */
export function isUserMessage(messageEl) {
  return !!messageEl.querySelector('[data-testid="user-message"]');
}

/**
 * Get user message text from a message element
 * If element is Claude response, find the parent user message
 * @param {HTMLElement} messageEl - Message element
 * @param {HTMLElement[]} allMessages - All messages array
 * @param {number} currentIndex - Current message index
 * @returns {string} - User message text
 */
export function getUserMessageText(messageEl, allMessages, currentIndex) {
  // If this is a user message, return its text
  const userMsgEl = messageEl.querySelector('[data-testid="user-message"]');
  if (userMsgEl) {
    return getCleanMessageText(userMsgEl);
  }
  
  // Find parent user message (look backwards)
  for (let i = currentIndex - 1; i >= 0; i--) {
    const prevUserMsg = allMessages[i].querySelector('[data-testid="user-message"]');
    if (prevUserMsg) {
      return getCleanMessageText(prevUserMsg);
    }
  }
  
  return '';
}

/**
 * Resolve marker/bookmark to current message index
 * 
 * Strategy:
 * 1. Try saved index first with signature verification
 * 2. Search all messages by signature
 * 3. Fuzzy search by preview text
 * 4. For Claude responses: Find by user message preview + offset
 * 
 * @param {Object} marker - Marker/bookmark object
 * @param {HTMLElement[]} messages - Array of current message elements
 * @param {Object} options - Options
 * @returns {Object} - { index, status, message }
 */
export function resolveMarkerIndex(marker, messages, options = {}) {
  const { updateCallback = null, strictMode = false } = options;
  
  if (!marker || !messages || messages.length === 0) {
    return { index: null, status: 'not_found', message: null };
  }
  
  const savedIndex = marker.index;
  const savedSignature = marker.contentSignature;
  const savedPreview = marker.messagePreview || marker.previewText || '';
  const savedUserPreview = marker.userMessagePreview || '';
  const isClaudeResponse = marker.isClaudeResponse || false;
  
  // Strategy 1: Try saved index with signature verification
  if (savedIndex !== undefined && savedIndex >= 0 && savedIndex < messages.length) {
    const messageAtIndex = messages[savedIndex];
    const currentSignature = generateSignature(messageAtIndex);
    
    if (currentSignature === savedSignature) {
      // Perfect match
      return { index: savedIndex, status: 'exact', message: messageAtIndex };
    }
  }
  
  // Strategy 2: Search all messages by content signature
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const msgSignature = generateSignature(msg);
    
    if (msgSignature === savedSignature) {
      // Found by signature
      if (updateCallback && i !== savedIndex) {
        updateCallback(marker.id, { index: i });
      }
      return { index: i, status: 'relocated', message: msg };
    }
  }
  
  // Strategy 3: Fuzzy search by preview text
  if (!strictMode && savedPreview) {
    const normalizedPreview = savedPreview.toLowerCase().trim().substring(0, 50);
    
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const msgPreview = generatePreview(msg, 50).toLowerCase().trim();
      
      if (msgPreview === normalizedPreview) {
        const newSignature = generateSignature(msg);
        if (updateCallback && (i !== savedIndex || newSignature !== savedSignature)) {
          updateCallback(marker.id, { index: i, contentSignature: newSignature });
        }
        return { index: i, status: 'fuzzy', message: msg };
      }
    }
  }
  
  // Strategy 4: For Claude responses, find by user message preview
  // This handles version changes where Claude response content changed
  if (!strictMode && savedUserPreview) {
    const normalizedUserPreview = savedUserPreview.toLowerCase().trim().substring(0, 50);
    
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const userText = getUserMessageText(msg, messages, i);
      const userPreview = userText.toLowerCase().trim().substring(0, 50);
      
      if (userPreview === normalizedUserPreview) {
        // Found the user message or its response
        // If marker was on Claude response, go to next message
        let targetIndex = i;
        if (isClaudeResponse && isUserMessage(msg) && i + 1 < messages.length) {
          targetIndex = i + 1;
        }
        
        const targetMsg = messages[targetIndex];
        const newSignature = generateSignature(targetMsg);
        const newPreview = generatePreview(targetMsg);
        
        if (updateCallback) {
          updateCallback(marker.id, { 
            index: targetIndex, 
            contentSignature: newSignature,
            messagePreview: newPreview
          });
        }
        
        console.log(`[MarkerUtils] Marker found by user message: ${savedIndex} → ${targetIndex}`);
        return { index: targetIndex, status: 'user_match', message: targetMsg };
      }
    }
  }
  
  // Not found
  console.warn(`[MarkerUtils] Marker not found: index=${savedIndex}, preview="${savedPreview?.substring(0, 30)}..."`);
  return { index: null, status: 'not_found', message: null };
}

/**
 * Create marker data with all necessary fields for robust resolution
 * @param {HTMLElement} messageEl - Message element
 * @param {number} messageIndex - Message index
 * @param {HTMLElement[]} allMessages - All messages array
 * @param {Object} extraData - Additional data to include
 * @returns {Object} - Marker data
 */
export function createMarkerData(messageEl, messageIndex, allMessages, extraData = {}) {
  const messageText = getCleanMessageText(messageEl);
  const userText = getUserMessageText(messageEl, allMessages, messageIndex);
  const isResponse = !isUserMessage(messageEl);
  
  return {
    index: messageIndex,
    contentSignature: generateSignature(messageEl),
    messagePreview: messageText.substring(0, 100).trim(),
    userMessagePreview: userText.substring(0, 100).trim(),
    isClaudeResponse: isResponse,
    timestamp: Date.now(),
    ...extraData
  };
}

/**
 * Batch resolve multiple markers
 * @param {Object[]} markers - Array of markers
 * @param {HTMLElement[]} messages - Array of current message elements
 * @param {Object} options - Options
 * @returns {Map<string, Object>} - Map of markerId -> resolution result
 */
export function resolveAllMarkers(markers, messages, options = {}) {
  const results = new Map();
  
  markers.forEach(marker => {
    const result = resolveMarkerIndex(marker, messages, options);
    results.set(marker.id, result);
  });
  
  return results;
}

/**
 * Filter markers to only those that can be resolved
 * @param {Object[]} markers - Array of markers
 * @param {HTMLElement[]} messages - Array of current message elements
 * @param {Object} options - Options
 * @returns {Object[]} - Array of { marker, resolvedIndex, status, message }
 */
export function getValidMarkers(markers, messages, options = {}) {
  return markers
    .map(marker => {
      const result = resolveMarkerIndex(marker, messages, options);
      return {
        marker,
        resolvedIndex: result.index,
        status: result.status,
        message: result.message
      };
    })
    .filter(item => item.resolvedIndex !== null);
}

export default {
  getCleanMessageText,
  generateSignature,
  generatePreview,
  isUserMessage,
  getUserMessageText,
  createMarkerData,
  resolveMarkerIndex,
  resolveAllMarkers,
  getValidMarkers
};
