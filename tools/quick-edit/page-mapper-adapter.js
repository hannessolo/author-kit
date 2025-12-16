/**
 * Page-Mapper Adapter for Author Kit
 * 
 * Configures page-mapper to use the iframe renderer with Author Kit's production URL.
 * This ensures the mapper accurately tracks how elements transform during the full
 * rendering pipeline including block initialization and decoration.
 */

import { initializeMapper, DEFAULT_CONFIG } from '../../deps/page-mapper/src/index.js';

/**
 * Gets the current page URL for iframe rendering
 * This should be the production/live URL of the current page
 * 
 * @returns {string} Current page URL
 */
function getCurrentPageURL() {
  // Return the current page URL
  // The iframe renderer will fetch this URL and inject marked HTML into it
  return window.location.href;
}

/**
 * Waits for Author Kit's page to be fully decorated
 * 
 * Author Kit's loadArea function decorates sections and removes their data-status
 * attribute when complete. We wait for the first section to have no data-status,
 * which indicates decoration is complete.
 * 
 * @returns {Object} waitFor configuration
 */
function getWaitForConfig() {
  return {
    type: 'selector',
    value: 'main .section:not([data-status])',
    timeout: 45000, // 45 second timeout for block loading
  };
}

/**
 * Sets up the iframe context before page loads
 * Can be used to inject configuration or override behavior
 * 
 * @param {Window} iframeWindow - The iframe window object
 */
function setupIframeContext(iframeWindow) {
  // Optional: Add any global configuration needed for the iframe
  // For example, you might want to disable analytics or modify behavior

  // Signal that we're in page-mapper mode
  iframeWindow.pageMapperMode = true;
}

/**
 * Creates a page mapper configured for Author Kit rendering
 * Uses the new iframe-based renderer that loads the production URL
 * 
 * @param {string} sourceHTML - The source HTML from DA-NX
 * @returns {Promise<MapperService>} Initialized mapper service
 */
export async function createAuthorKitMapper(sourceHTML) {
  const pageURL = getCurrentPageURL();

  return initializeMapper(sourceHTML, {
    ...DEFAULT_CONFIG,
    rootSelector: 'main',

    // Track elements that DA-NX marked as contenteditable in the source
    // This automatically matches whatever DA-NX's EDITABLES configuration is
    // Also track IMG elements for image drag & drop functionality
    targetSelectors: [
      '[contenteditable="true"]',
      'img'
    ],

    // Use the new iframe renderer mode
    renderMode: 'iframe',

    // Configure iframe rendering
    renderOptions: {
      url: pageURL,
      rootSelector: 'main',
      waitFor: getWaitForConfig(),
      setupContext: setupIframeContext,
    },

    logPerformance: true, // Enable performance logging for debugging
  });
}

export default createAuthorKitMapper;

