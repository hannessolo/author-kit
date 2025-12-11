/**
 * Page Mapper Package
 * Standalone, reusable DOM element mapper
 * 
 * Main entry point for the page mapper package
 */

// Main API - hides implementation details
export { default as initializeMapper } from './orchestrator.js';
export { default as createMapper } from './orchestrator.js'; // Alias for backward compatibility

// Service
export { MapperService } from './mapper-service.js';

// Pure components (for advanced usage - exposes internal implementation)
export { default as embedSourceMarkers } from './components/source-hash-embedder.js';
export { default as renderPage, cleanupIframe } from './components/source-to-page-renderer.js';
export { default as buildPageMapping } from './components/page-hash-mapper.js';

// Utility functions
export { getElementPath, getElementByPath } from './utils.js';

// Configuration
export { default as DEFAULT_CONFIG } from './config.js';
