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

  // 1. Try to find the specific content container first to avoid sidebar/avatar noise
  // User messages usually have data-testid="user-message"
  // Claude messages usually have .font-claude-message
  const userContent = messageEl.querySelector('[data-testid="user-message"]');
  const claudeContent = messageEl.querySelector('.font-claude-message');

  // Use the specific content element if found, otherwise fallback to the whole element
  const targetEl = userContent || claudeContent || messageEl;
  const clone = targetEl.cloneNode(true);

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
    'style',
    '[aria-label="Edit"]',
    '[aria-label="Copy"]',
    '[aria-label="Retry"]', // Added based on user snippet
    '[role="button"]',
    '.font-mono.text-xs', // Model version text
    '.opacity-0', // Hidden accessibility text
    '.sr-only',    // Screen reader only text
    '.gap-2 > .shrink-0', // Common avatar container pattern (fallback)
    '.select-none.rounded-full' // Specific avatar circle (fallback)
  ];

  selectorsToRemove.forEach(selector => {
    clone.querySelectorAll(selector).forEach(el => el.remove());
  });

  return clone.textContent.trim();
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching when exact match fails
 */
function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  // increment along the first column of each row
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  // increment each column in the first row
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Generate content signature for a message
 */
export function generateSignature(messageEl, maxLength = 5000) {
  const text = getCleanMessageText(messageEl);
  return hashString(text.substring(0, maxLength));
}

/**
 * Generate preview text for a message
 */
export function generatePreview(messageEl, maxLength = 300) {
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
function normalizeForComparison(text, maxLength = 300) {
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

    // ============================================
    // Strategy 1.5: Fuzzy Preview match at saved index (Fallback for UI noise)
    // If signature changed but preview text is SIMILAR at same index -> It's the same message
    // ============================================
    if (!strictMode && savedPreview) {
      const msgPreview = normalizeForComparison(generatePreview(messageAtIndex, 300), 300);
      const normalizedSavedPreview = normalizeForComparison(savedPreview, 300);

      // Allow up to 20% difference or 10 characters (increased for longer preview)
      const distance = levenshteinDistance(msgPreview, normalizedSavedPreview);
      const maxDist = Math.max(10, Math.floor(normalizedSavedPreview.length * 0.2));

      if (distance <= maxDist) {
        // Update signature to match new UI state
        if (updateCallback) {
          updateCallback(marker.id, { contentSignature: currentSignature });
        }
        return { index: savedIndex, status: 'fuzzy_match_index', message: messageAtIndex };
      }
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
    const normalizedSavedPreview = normalizeForComparison(savedPreview, 300);

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const msgPreview = normalizeForComparison(generatePreview(msg, 300), 300);

      // Use Levenshtein for search as well
      const distance = levenshteinDistance(msgPreview, normalizedSavedPreview);
      const maxDist = Math.max(10, Math.floor(normalizedSavedPreview.length * 0.2));

      if (distance <= maxDist) {
        const newSignature = generateSignature(msg);
        if (updateCallback) {
          updateCallback(marker.id, { index: i, contentSignature: newSignature });
        }
        return { index: i, status: 'fuzzy_preview_match', message: msg };
      }
    }
  }

  // ============================================
  // Strategy 4: For user messages, find by own preview
  // User message content doesn't change in same edit
  // ============================================
  if (!strictMode && savedUserPreview && !markerIsClaudeResponse) {
    const normalizedUserPreview = normalizeForComparison(savedUserPreview, 300);

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];

      if (isUserMessage(msg)) {
        const userMsgEl = msg.querySelector('[data-testid="user-message"]');
        const userText = getCleanMessageText(userMsgEl);
        const currentUserPreview = normalizeForComparison(userText, 300);

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
    messagePreview: messageText.substring(0, 300).trim(),
    userMessagePreview: userText.substring(0, 300).trim(),
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
