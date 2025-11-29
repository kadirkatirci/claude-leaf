/**
 * MarkerUtils - Shared utilities for marker/bookmark index resolution
 * 
 * Problem: When user changes edit version, messages after that edit point change,
 * causing index-based markers to point to wrong messages.
 * 
 * Solution: Multi-strategy content-based verification with robust fallbacks
 * 1. Try saved index first with signature verification (exact match)
 * 2. Search all messages by content signature (content moved)
 * 3. Fuzzy search by preview text (content slightly changed)
 * 4. For Claude responses: Find by user message preview (version changed)
 * 5. For user messages: Find by own preview text (fallback)
 * 
 * Key Insight:
 * - Edit'ten ÖNCE olan mesajlar: Index ve content aynı kalır, signature match olmalı
 * - Edit'ten SONRA olan mesajlar: Index kayabilir ama content aynı kalır (Claude yanıtı hariç)
 * - Claude yanıtları: Content değişir ama parent user message aynı kalır
 */

import { hashString } from './HashUtils.js';

/**
 * Get clean text content from a message element
 * Excludes marker buttons, bookmark buttons, and other injected UI
 */
export function getCleanMessageText(messageEl) {
  if (!messageEl) return '';
  
  const clone = messageEl.cloneNode(true);
  
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
 */
export function generateSignature(messageEl, maxLength = 1000) {
  const text = getCleanMessageText(messageEl);
  return hashString(text.substring(0, maxLength));
}

/**
 * Generate preview text for a message
 */
export function generatePreview(messageEl, maxLength = 100) {
  const text = getCleanMessageText(messageEl);
  return text.substring(0, maxLength).trim();
}

/**
 * Check if message is a user message
 */
export function isUserMessage(messageEl) {
  return !!messageEl.querySelector('[data-testid="user-message"]');
}

/**
 * Get user message element from a message (or find parent)
 */
export function getUserMessageElement(messageEl, allMessages, currentIndex) {
  // If this is a user message, return it
  const userMsgEl = messageEl.querySelector('[data-testid="user-message"]');
  if (userMsgEl) {
    return { element: userMsgEl, index: currentIndex };
  }
  
  // Find parent user message (look backwards)
  for (let i = currentIndex - 1; i >= 0; i--) {
    const prevUserMsg = allMessages[i]?.querySelector('[data-testid="user-message"]');
    if (prevUserMsg) {
      return { element: prevUserMsg, index: i };
    }
  }
  
  return { element: null, index: -1 };
}

/**
 * Get user message text from a message element
 */
export function getUserMessageText(messageEl, allMessages, currentIndex) {
  const { element } = getUserMessageElement(messageEl, allMessages, currentIndex);
  return element ? getCleanMessageText(element) : '';
}

/**
 * Normalize text for comparison (case-insensitive, trimmed, limited length)
 */
function normalizeForComparison(text, maxLength = 50) {
  if (!text) return '';
  return text.toLowerCase().trim().substring(0, maxLength);
}

/**
 * Resolve marker/bookmark to current message index
 * 
 * Multi-strategy resolution with detailed logging
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
  const markerIsClaudeResponse = marker.isClaudeResponse || false;
  
  // ============================================
  // Strategy 1: Exact match at saved index
  // ============================================
  if (savedIndex !== undefined && savedIndex >= 0 && savedIndex < messages.length) {
    const messageAtIndex = messages[savedIndex];
    const currentSignature = generateSignature(messageAtIndex);
    
    if (currentSignature === savedSignature) {
      return { index: savedIndex, status: 'exact', message: messageAtIndex };
    }
  }
  
  // ============================================
  // Strategy 2: Search by content signature
  // Message content same but index shifted
  // ============================================
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const msgSignature = generateSignature(msg);
    
    if (msgSignature === savedSignature) {
      if (updateCallback && i !== savedIndex) {
        updateCallback(marker.id, { index: i });
      }
      return { index: i, status: 'signature_match', message: msg };
    }
  }
  
  // ============================================
  // Strategy 3: Fuzzy match by preview text
  // Handles minor content changes
  // ============================================
  if (!strictMode && savedPreview) {
    const normalizedSavedPreview = normalizeForComparison(savedPreview);
    
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const msgPreview = normalizeForComparison(generatePreview(msg, 50));
      
      if (msgPreview === normalizedSavedPreview) {
        const newSignature = generateSignature(msg);
        if (updateCallback) {
          updateCallback(marker.id, { index: i, contentSignature: newSignature });
        }
        return { index: i, status: 'preview_match', message: msg };
      }
    }
  }
  
  // ============================================
  // Strategy 4: For user messages, find by own preview
  // User message content doesn't change in same edit
  // ============================================
  if (!strictMode && savedUserPreview && !markerIsClaudeResponse) {
    const normalizedUserPreview = normalizeForComparison(savedUserPreview);
    
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      
      if (isUserMessage(msg)) {
        const userMsgEl = msg.querySelector('[data-testid="user-message"]');
        const userText = getCleanMessageText(userMsgEl);
        const currentUserPreview = normalizeForComparison(userText);
        
        if (currentUserPreview === normalizedUserPreview) {
          const newSignature = generateSignature(msg);
          const newPreview = generatePreview(msg);
          
          if (updateCallback) {
            updateCallback(marker.id, { 
              index: i, 
              contentSignature: newSignature,
              messagePreview: newPreview
            });
          }
          return { index: i, status: 'user_message_match', message: msg };
        }
      }
    }
  }
  
  // ============================================
  // NO INDEX FALLBACK
  // If content doesn't match, marker is invalid
  // Edit sonrası mesajlar versiyon değişince kaybolmalı
  // ============================================
  
  // Not found - marker's message no longer exists
  console.warn(`[MarkerUtils] Marker not found (message removed): index=${savedIndex}, preview="${savedPreview?.substring(0, 30)}..."`);
  return { index: null, status: 'not_found', message: null };
}

/**
 * Create marker data with all necessary fields for robust resolution
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
  getUserMessageElement,
  getUserMessageText,
  createMarkerData,
  resolveMarkerIndex,
  resolveAllMarkers,
  getValidMarkers
};
