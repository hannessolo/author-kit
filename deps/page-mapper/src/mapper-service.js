/**
 * Mapper Service
 * Pure lookup service for element mapping
 */

import { getElementPath, getElementByPath } from './utils.js';

/**
 * Serializes a path array to a string key for Map lookups
 * @param {Array} path - Path array
 * @returns {string} Serialized path key
 */
function serializePathKey(path) {
  if (!path) return '';
  return JSON.stringify(path);
}
/**
 * Page Mapper Service
 * Provides pure lookup from page elements to source elements
 */
export class MapperService {
  constructor(options = {}) {
    const {
      sourceDoc,
      markerToSourcePath,
      markerToPagePath,
      config,
    } = options;

    this.sourceDoc = sourceDoc;
    this.markerToSourcePath = markerToSourcePath;
    this.markerToPagePath = markerToPagePath;
    this.config = config;

    // Build reverse index: pagePath → marker for fast lookup
    this.pagePathToMarker = new Map();
    for (const [marker, pagePath] of markerToPagePath.entries()) {
      const pathKey = serializePathKey(pagePath);
      this.pagePathToMarker.set(pathKey, marker);
    }
  }

  /**
   * Finds the source element for a page element using structural path lookup
   * This is the core lookup function - just answers what the source element is
   * @param {Element} pageElement - The rendered page element
   * @returns {Element|null} The source element or null if not found
   */
  findSourceElement(pageElement) {
    // Step 1: Get the page element's structural path in the rendered page DOM
    const doc = pageElement.ownerDocument;
    const pageRoot = doc.querySelector(this.config.rootSelector);
    if (!pageRoot) return null;

    const pagePath = getElementPath(pageElement, pageRoot);

    // Step 2: Find marker by page path (reverse lookup)
    const pathKey = serializePathKey(pagePath);
    const marker = this.pagePathToMarker.get(pathKey);
    if (!marker) return null;

    // Step 3: Get source path from marker
    const sourcePath = this.markerToSourcePath.get(marker);
    if (!sourcePath) return null;

    // Step 4: Navigate to source element by path
    const sourceRoot = this.sourceDoc.querySelector(this.config.rootSelector);
    if (!sourceRoot) return null;

    const sourceElement = getElementByPath(sourceRoot, sourcePath);
    return sourceElement;
  }


  /**
   * Gets the current source document
   * @returns {Document} Source document
   */
  getSourceDoc() {
    return this.sourceDoc;
  }

  /**
   * Gets all mapped element pairs (source → page)
   * Uses paths from iframe mapping to find elements in LIVE document
   * 
   * @returns {Array<{source: {element: Element, path: Array}, page: {element: Element, path: Array}}>} Array of mapped pairs with paths
   */
  getAllMappedElements() {
    const mappedPairs = [];
    const sourceRoot = this.sourceDoc.querySelector(this.config.rootSelector);

    // Get LIVE document root (not iframe)
    const livePageDoc = typeof document !== 'undefined' ? document : null;
    if (!sourceRoot || !livePageDoc) return mappedPairs;

    const livePageRoot = livePageDoc.querySelector(this.config.rootSelector);
    if (!livePageRoot) return mappedPairs;

    // Iterate through all markers
    for (const [marker, sourcePath] of this.markerToSourcePath.entries()) {
      const pagePath = this.markerToPagePath.get(marker);
      if (!pagePath) continue;

      // Get source element
      const sourceElement = getElementByPath(sourceRoot, sourcePath);
      if (!sourceElement) continue;

      // Use pagePath (from iframe) to find element in LIVE document
      const livePageElement = getElementByPath(livePageRoot, pagePath);
      if (!livePageElement) continue;

      mappedPairs.push({
        source: {
          element: sourceElement,
          path: sourcePath
        },
        page: {
          element: livePageElement,
          path: pagePath
        }
      });
    }

    return mappedPairs;
  }

}

export default MapperService;

