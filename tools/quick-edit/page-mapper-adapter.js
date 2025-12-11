/**
 * Page-Mapper Adapter for Author Kit
 * 
 * Configures page-mapper to simulate Author Kit's rendering pipeline.
 * This adapter ensures the mapper accurately tracks how elements transform
 * during block initialization and decoration.
 */

import { initializeMapper, DEFAULT_CONFIG } from '../../deps/page-mapper/src/index.js';
import { loadArea, setConfig } from '../../scripts/ak.js';

/**
 * Decorates the area for page-mapper simulation
 * Replicates the same rendering pipeline as the live page
 * 
 * @param {HTMLElement} root - The root element to decorate (usually <main>)
 * @param {Document} doc - The iframe document context
 */
async function decorateForMapper(root, doc) {
  try {
    // Verify we have valid inputs
    if (!root) {
      console.warn('[Page-Mapper Adapter] No root element provided');
      return;
    }

    // Set up the same configuration as the main page
    const hostnames = ['authorkit.dev'];

    const locales = {
      '': { lang: 'en' },
      '/de': { lang: 'de' },
      '/es': { lang: 'es' },
      '/fr': { lang: 'fr' },
      '/hi': { lang: 'hi' },
      '/ja': { lang: 'ja' },
      '/zh': { lang: 'zh' },
    };

    const widgets = [
      { fragment: '/fragments/' },
      { schedule: '/schedules/' },
      { youtube: 'https://www.youtube' },
    ];

    const components = ['fragment', 'schedule'];

    const decorateArea = ({ area = doc }) => {
      const eagerLoad = (parent, selector) => {
        if (!parent) return;
        const img = parent.querySelector(selector);
        if (!img) return;
        img.removeAttribute('loading');
        img.fetchPriority = 'high';
      };
      eagerLoad(area, 'img');
    };

    // Configure the same way as the main page
    setConfig({ hostnames, locales, widgets, components, decorateArea });

    // Load the area (this runs block initialization)
    await loadArea({ area: root });

  } catch (error) {
    console.error('[Page-Mapper Adapter] Error during decoration:', error);
    throw error; // Re-throw so page-mapper knows it failed
  }
}

/**
 * Creates a page mapper configured for Author Kit rendering
 * 
 * @param {string} sourceHTML - The source HTML from DA-NX
 * @returns {Promise<MapperService>} Initialized mapper service
 */
export async function createAuthorKitMapper(sourceHTML) {
  return initializeMapper(sourceHTML, {
    ...DEFAULT_CONFIG,
    rootSelector: 'main',
    // Track elements that DA-NX marked as contenteditable in the source
    // This automatically matches whatever DA-NX's EDITABLES configuration is
    targetSelectors: ['[contenteditable="true"]'],
    decorationOptions: {
      decorators: [
        // Simulate the full Author Kit rendering pipeline
        decorateForMapper
      ],
      rootSelector: 'main',
      timeout: 45000, // 45 second timeout (increased for block loading)
    },
    logPerformance: true, // Enable performance logging for debugging
  });
}

export default createAuthorKitMapper;

