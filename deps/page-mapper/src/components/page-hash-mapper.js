/**
 * Page Hash Mapper Component
 * Pure function that builds mapping between rendered page and source elements
 */

import { getElementPath } from '../utils.js';

/**
 * Builds a map of all markers found in the rendered page document
 * Performs a single tree walk for better performance
 * @param {Element} root - Root element to search within
 * @param {Document} doc - Document to search in
 * @param {Object} config - Configuration object
 * @returns {Map<string, {element: Element, path: Array}>} Map of marker -> {element, path}
 */
function buildRenderedPageMarkerMap(root, doc, config) {
  const markerMap = new Map();
  const hashPrefix = config.hashPrefix;
  const markerPattern = new RegExp(`\\b${hashPrefix}[A-Z0-9]+_[a-zA-Z0-9]+_[A-Z]+\\b`, 'g');

  // Walk entire document tree
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node = walker.currentNode;

  while (node) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent) {
      // Check text node content for markers (handles H1, P, etc.)
      const matches = node.textContent.match(markerPattern);
      if (matches) {
        const parent = node.parentElement;
        if (parent) {
          matches.forEach((marker) => {
            if (marker.startsWith(hashPrefix)) {
              // Always use the deepest (leaf) element
              // If marker exists, only replace if this element is deeper
              const existingInfo = markerMap.get(marker);
              const newPath = getElementPath(parent, root);

              if (!existingInfo || newPath.length > existingInfo.path.length) {
                markerMap.set(marker, { element: parent, path: newPath });
              }
            }
          });
        }
      }
    } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'IMG') {
      // Special handling for IMG elements - check src attribute
      const src = node.getAttribute('src');
      if (src) {
        const matches = src.match(markerPattern);
        if (matches) {
          matches.forEach((marker) => {
            if (marker.startsWith(hashPrefix) && !markerMap.has(marker)) {
              const path = getElementPath(node, root);
              markerMap.set(marker, { element: node, path });
            }
          });
        }
      }
    }
    node = walker.nextNode();
  }

  return markerMap;
}

/**
 * Builds page element mapping
 * Pure function: takes documents and marker data, returns mapping
 * 
 * @param {Document} renderedPageDoc - Rendered page document
 * @param {Document} sourceDoc - Source document
 * @param {Map} markerToSourcePath - Marker to source path mapping (from embedder)
 * @param {Object} config - Configuration object (merged with defaults by orchestrator)
 * @returns {Object} Object containing markerToPagePath
 */
function buildPageMapping(renderedPageDoc, sourceDoc, markerToSourcePath, config) {
  const renderedPageRoot = renderedPageDoc.querySelector(config.rootSelector);
  const sourceRoot = sourceDoc.querySelector(config.rootSelector);
  const markerToPagePath = new Map();

  if (!renderedPageRoot || !sourceRoot) {
    console.warn(`[Page Mapper] Cannot build mapping: missing ${config.rootSelector} elements`);
    return { markerToPagePath };
  }

  if (!markerToSourcePath || markerToSourcePath.size === 0) {
    console.warn('[Page Mapper] No markers registered in markerToSourcePath');
    return { markerToPagePath };
  }

  // Build a map of all markers found in rendered page doc (single pass for performance)
  const renderedPageMarkerMap = buildRenderedPageMarkerMap(renderedPageRoot, renderedPageDoc, config);

  // Match registered markers to rendered page markers
  markerToSourcePath.forEach((sourcePath, marker) => {
    const renderedPageMarkerInfo = renderedPageMarkerMap.get(marker);

    if (renderedPageMarkerInfo && renderedPageMarkerInfo.path) {
      // Store marker -> page path mapping
      markerToPagePath.set(marker, renderedPageMarkerInfo.path);
    }
  });

  return { markerToPagePath };
}


export default buildPageMapping;

