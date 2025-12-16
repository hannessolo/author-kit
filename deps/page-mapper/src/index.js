/**
 * ES Module wrapper for page-mapper bundle
 * Re-exports everything from the bundled page-mapper.js
 */

export {
  initializeMapper,
  createMapper,
  MapperService,
  embedSourceMarkers,
  renderPageFromURL,
  renderPageWithRenderers,
  buildPageMapping,
  getElementPath,
  getElementByPath,
  DEFAULT_CONFIG
} from '../dist/page-mapper.js';

