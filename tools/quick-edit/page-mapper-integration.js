/**
 * Page-Mapper Integration for Quick-Edit
 * Handles mapping between source and rendered elements
 */

import { createAuthorKitMapper } from './page-mapper-adapter.js';
import { serializePathToSource } from './utils.js';

let mapperService = null;

// Attributes to restore from source (may be lost during rendering)
const ATTRIBUTES_TO_RESTORE = [
  'data-cursor',
  'data-cursor-remote',
  'contenteditable',
];

/**
 * Copies configured attributes from source to rendered element
 * @param {HTMLElement} sourceElement
 * @param {HTMLElement} renderedElement
 * @returns {Object} { copiedAttributes }
 */
function copySourceAttributes(sourceElement, renderedElement) {
  const copiedAttributes = [];

  ATTRIBUTES_TO_RESTORE.forEach(attrName => {
    if (sourceElement.hasAttribute(attrName)) {
      const attrValue = sourceElement.getAttribute(attrName);
      renderedElement.setAttribute(attrName, attrValue);
      copiedAttributes.push(`${attrName}="${attrValue}"`);
    }
  });

  return { copiedAttributes };
}

/**
 * Initializes page-mapper with source HTML
 * @param {string} sourceHTML - Raw HTML from DA-NX
 */
export async function initializePageMapper(sourceHTML) {
  console.log('[Page-Mapper Integration] Initializing...');
  const startTime = performance.now();

  try {
    mapperService = await createAuthorKitMapper(sourceHTML);
    const duration = performance.now() - startTime;
    console.log(`[Page-Mapper Integration] ✓ Initialized in ${duration.toFixed(2)}ms`);
  } catch (error) {
    console.error('[Page-Mapper Integration] ✗ Failed to initialize:', error);
    mapperService = null;
  }
}

/**
 * Applies attributes to make mapped elements "live" and editable
 * Should be called AFTER page rendering (after loadPage)
 */
export function applyLiveElementAttributes() {
  if (!mapperService) {
    console.warn('[Page-Mapper Integration] Mapper not initialized');
    return;
  }

  const mappedPairs = mapperService.getAllMappedElements();
  let successCount = 0;
  let failureCount = 0;
  let totalAttributesRestored = 0;

  console.log(`[Page-Mapper Integration] Processing ${mappedPairs.length} elements...`);

  mappedPairs.forEach(({ source, page }) => {
    try {
      const pathBase64 = serializePathToSource(source.path);
      page.element.setAttribute('data-path-to-source', pathBase64);

      const { copiedAttributes } = copySourceAttributes(source.element, page.element);
      totalAttributesRestored += copiedAttributes.length;

      successCount++;
    } catch (error) {
      failureCount++;
      console.error('[Page-Mapper Integration] Error:', error);
    }
  });

  console.log(`[Page-Mapper Integration] ✓ ${successCount} success, ${failureCount} failed`);
  if (totalAttributesRestored > 0) {
    console.log(`[Page-Mapper Integration] ✓ Restored ${totalAttributesRestored} attributes`);
  }
}

