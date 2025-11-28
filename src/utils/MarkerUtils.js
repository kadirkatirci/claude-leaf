/**
 * MarkerUtils - Shared utilities for marker/bookmark index resolution
 * 
 * Problem: When user changes edit version, messages after that edit point change,
 * causing index-based markers to point to wrong messages.
 * 
 * Solution: Content-based verification with fallback search
 * 1. Try saved index first
 * 2. Verify with content signature
 * 3. If mismatch, search all messages
 * 4. Return resolved index or null if not found
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
    '[class*="bookmark"]'
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
 * Resolve marker/bookmark to current message index
 * 
 * Strategy:
 * 1. Try saved index first
 * 2. Verify with content signature
 * 3. If mismatch, search all messages by signature
 * 4. If still not found, search by preview text (fuzzy)
 * 
 * @param {Object} marker - Marker/bookmark object with index, contentSignature, messagePreview
 * @param {HTMLElement[]} messages - Array of current message elements
 * @param {Object} options - Options
 * @param {boolean} options.updateCallback - Callback to update marker with new index
 * @param {boolean} options.strictMode - If true, don't use fuzzy matching (default: false)
 * @returns {Object} - { index: number|null, status: 'exact'|'relocated'|'fuzzy'|'not_found', message: HTMLElement|null }
 */
export function resolveMarkerIndex(marker, messages, options = {}) {
  const { updateCallback = null, strictMode = false } = options;
  
  if (!marker || !messages || messages.length === 0) {
    return { index: null, status: 'not_found', message: null };
  }
  
  const savedIndex = marker.index;
  const savedSignature = marker.contentSignature;
  const savedPreview = marker.messagePreview || marker.previewText || '';
  
  // Strategy 1: Try saved index with signature verification
  if (savedIndex !== undefined && savedIndex >= 0 && savedIndex < messages.length) {
    const messageAtIndex = messages[savedIndex];
    const currentSignature = generateSignature(messageAtIndex);
    
    if (currentSignature === savedSignature) {
      // Perfect match - index is correct
      return { index: savedIndex, status: 'exact', message: messageAtIndex };
    }
  }
  
  // Strategy 2: Search all messages by content signature
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const msgSignature = generateSignature(msg);
    
    if (msgSignature === savedSignature) {
      // Found by signature - index changed but content matches
      console.log(`[MarkerUtils] Marker relocated: ${savedIndex} → ${i}`);
      
      // Update marker index if callback provided
      if (updateCallback && i !== savedIndex) {
        updateCallback(marker.id, { index: i });
      }
      
      return { index: i, status: 'relocated', message: msg };
    }
  }
  
  // Strategy 3: Fuzzy search by preview text (if not strict mode)
  if (!strictMode && savedPreview) {
    const normalizedPreview = savedPreview.toLowerCase().trim().substring(0, 50);
    
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const msgPreview = generatePreview(msg, 50).toLowerCase().trim();
      
      // Match first 50 chars
      if (msgPreview === normalizedPreview) {
        console.log(`[MarkerUtils] Marker found by fuzzy match: ${savedIndex} → ${i}`);
        
        // Update marker with new signature and index
        if (updateCallback && i !== savedIndex) {
          const newSignature = generateSignature(msg);
          updateCallback(marker.id, { index: i, contentSignature: newSignature });
        }
        
        return { index: i, status: 'fuzzy', message: msg };
      }
    }
  }
  
  // Not found
  console.warn(`[MarkerUtils] Marker not found: index=${savedIndex}, preview="${savedPreview?.substring(0, 30)}..."`);
  return { index: null, status: 'not_found', message: null };
}

/**
 * Batch resolve multiple markers
 * Returns a Map of markerId -> resolvedIndex
 * 
 * @param {Object[]} markers - Array of markers
 * @param {HTMLElement[]} messages - Array of current message elements
 * @param {Object} options - Options (same as resolveMarkerIndex)
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
 * Useful for displaying only valid markers
 * 
 * @param {Object[]} markers - Array of markers
 * @param {HTMLElement[]} messages - Array of current message elements
 * @param {Object} options - Options (same as resolveMarkerIndex)
 * @returns {Object[]} - Array of { marker, resolvedIndex, status }
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
  resolveMarkerIndex,
  resolveAllMarkers,
  getValidMarkers
};
