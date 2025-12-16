/**
 * Saves the current cursor position within an element
 * @param {HTMLElement} element - The element containing the cursor
 * @returns {number|null} The cursor offset, or null if not found
 */
export function saveCursorPosition(element) {
  const selection = window.getSelection();
  if (!selection.rangeCount) return null;

  const range = selection.getRangeAt(0);

  // Check if the selection is within the target element
  if (!element.contains(range.commonAncestorContainer)) {
    return null;
  }

  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(element);
  preCaretRange.setEnd(range.endContainer, range.endOffset);

  return preCaretRange.toString().length;
}

/**
 * Restores the cursor position within an element
 * @param {HTMLElement} element - The element to restore the cursor in
 * @param {number} offset - The character offset to restore to
 */
export function restoreCursorPosition(element, offset) {
  if (offset === null || offset === undefined) return;

  const selection = window.getSelection();
  const range = document.createRange();

  let currentOffset = 0;
  let found = false;

  function traverseNodes(node) {
    if (found) return;

    if (node.nodeType === Node.TEXT_NODE) {
      const length = node.textContent.length;
      if (currentOffset + length >= offset) {
        range.setStart(node, offset - currentOffset);
        range.setEnd(node, offset - currentOffset);
        found = true;
        return;
      }
      currentOffset += length;
    } else {
      for (let i = 0; i < node.childNodes.length; i++) {
        traverseNodes(node.childNodes[i]);
        if (found) return;
      }
    }
  }

  traverseNodes(element);

  if (found) {
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

/**
 * Serializes a structural path to base64 for compact storage
 * @param {Array} path - Path array from page-mapper (e.g., [{tag: 'DIV', index: 0}])
 * @returns {string} Base64 encoded path
 */
export function serializePathToSource(path) {
  if (!path || path.length === 0) return '';
  const json = JSON.stringify(path);
  return btoa(json);
}
