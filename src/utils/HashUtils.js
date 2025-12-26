/**
 * HashUtils - String hashing utilities
 * Provides consistent hashing functionality across modules
 */

/**
 * Generate a hash from a string using a simple hash algorithm
 * @param {string} str - The string to hash
 * @returns {string} - Hash as a base-36 string
 */
export function hashString(str) {
  if (!str || typeof str !== 'string') {
    return '0';
  }

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(36);
}

/**
 * Generate a hash from the first N characters of a string
 * Useful for content signatures
 * @param {string} str - The string to hash
 * @param {number} maxLength - Maximum characters to use (default: 1000)
 * @returns {string} - Hash as a base-36 string
 */
export function hashContent(str, maxLength = 1000) {
  if (!str || typeof str !== 'string') {
    return '0';
  }

  const content = str.substring(0, maxLength);
  return hashString(content);
}

export default {
  hashString,
  hashContent,
};
