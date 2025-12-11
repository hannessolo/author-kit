/**
 * Utility functions for hash mapper
 */

/**
 * Generates a unique random ID
 * @param {number} length - Length of the ID (default: random between 6-8)
 * @returns {string} Random alphanumeric string
 */
export function generateRandomId(length = null) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const idLength = length || (Math.random() < 0.5 ? 6 : 8);
  let result = '';
  for (let i = 0; i < idLength; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Builds a stable path from root to element
 * @param {Element} element - Element to get path for
 * @param {Element} root - Root element to stop at
 * @returns {Array} Path descriptor array with {tag, index} objects
 */
export function getElementPath(element, root) {
  const path = [];
  let current = element;

  while (current && current !== root) {
    const parent = current.parentElement;

    // Stop if we've reached root or no parent
    if (!parent || parent === root) {
      // Add current element to path before stopping (direct child of root)
      const siblings = Array.from(root.children);
      const index = siblings.indexOf(current);

      path.unshift({
        tag: current.tagName,
        index,
      });
      break;
    }

    // Add current element to path
    const siblings = Array.from(parent.children);
    const index = siblings.indexOf(current);

    path.unshift({
      tag: current.tagName,
      index,
    });

    current = parent;
  }

  return path;
}

/**
 * Gets an element by its path descriptor
 * @param {Element} root - Root element
 * @param {Array} path - Path descriptor array
 * @returns {Element|null} Element or null if not found
 */
export function getElementByPath(root, path) {
  let current = root;

  for (const step of path) {
    if (!current) return null;

    // Direct index access - no need to convert HTMLCollection to Array
    const candidate = current.children[step.index];

    if (!candidate) return null;

    // Verify tag name matches
    if (candidate.tagName !== step.tag) {
      return null;
    }

    current = candidate;
  }

  return current;
}

