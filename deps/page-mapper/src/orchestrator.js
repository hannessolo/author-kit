/**
 * Page Mapper Orchestrator
 * Coordinates pure components, measures performance, creates service
 */

import embedSourceMarkers from './components/source-hash-embedder.js';
import renderPage from './components/source-to-page-renderer.js';
import buildPageMapping from './components/page-hash-mapper.js';
import MapperService from './mapper-service.js';
import DEFAULT_CONFIG from './config.js';

/**
 * Logs performance metrics
 * @param {Object} metrics - Performance metrics
 * @param {number} elementMappingCount - Number of element mappings
 */
function logPerformanceMetrics(metrics, elementMappingCount) {
  console.log('[Page Mapper] Performance:', {
    embeddingMs: metrics.embeddingTime.toFixed(2),
    renderingMs: metrics.renderingTime.toFixed(2),
    mappingMs: metrics.mappingTime.toFixed(2),
    totalMs: metrics.totalTime.toFixed(2),
    elementMappingCount,
  });
}

/**
 * Creates and initializes a page mapper service
 * 
 * @param {string} sourceHTML - Raw semantic HTML
 * @param {Object} config - Configuration object (merged with DEFAULT_CONFIG)
 * @returns {Promise<MapperService>} Initialized mapper service
 */
async function initializeMapper(sourceHTML, config = {}) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const totalStart = performance.now();
  const metrics = {};

  try {
    // Step 1: Embed markers into source HTML
    const embeddingStart = performance.now();
    const { markedHTML, markerMap, markerToSourcePath } = embedSourceMarkers(sourceHTML, mergedConfig);
    metrics.embeddingTime = performance.now() - embeddingStart;
    // Step 2: Render page
    const { decorationOptions } = mergedConfig;
    if (!decorationOptions) {
      throw new Error(
        '[Page Mapper] Rendering options must be provided in config.decorationOptions'
      );
    }

    const renderingStart = performance.now();
    const renderedPageHTML = await renderPage(markedHTML, decorationOptions);
    metrics.renderingTime = performance.now() - renderingStart;

    // Parse rendered page HTML back to document
    const renderedPageDoc = new DOMParser().parseFromString(renderedPageHTML, 'text/html');

    // Step 3: Build marker-to-page-path mapping
    const mappingStart = performance.now();
    const sourceDoc = new DOMParser().parseFromString(sourceHTML, 'text/html');
    const { markerToPagePath } = buildPageMapping(
      renderedPageDoc,
      sourceDoc,
      markerToSourcePath,
      mergedConfig
    );
    metrics.mappingTime = performance.now() - mappingStart;

    metrics.totalTime = performance.now() - totalStart;

    // Step 4: Log performance metrics
    if (mergedConfig.logPerformance) {
      logPerformanceMetrics(metrics, markerToPagePath.size);
    }

    // Step 5: Create service with all data
    const service = new MapperService({
      sourceDoc,
      markerToSourcePath,
      markerToPagePath,
      config: mergedConfig,
    });

    return service;
  } catch (error) {
    console.error('[Page Mapper] Initialization failed:', error);
    throw error;
  }
}

export default initializeMapper;
