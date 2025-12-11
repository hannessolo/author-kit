/**
 * Hash Mapper Configuration
 * All configurable aspects of the hash mapper
 */

const DEFAULT_CONFIG = {
  // DOM selectors
  rootSelector: 'main',  // Root element selector
  targetSelectors: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'img', 'ul', 'ol'],

  // Performance
  timeout: 10000,
  logPerformance: true,

  // Hash generation
  hashPrefix: 'HASH_',
  hashIdLength: 8,

  // Context setup (for iframe)
  setupContext: null, // Function to setup iframe context (optional)
};

export default DEFAULT_CONFIG;

