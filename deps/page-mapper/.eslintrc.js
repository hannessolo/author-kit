module.exports = {
  extends: ['../../.eslintrc.js'],
  rules: {
    // Allow private methods/properties with underscore prefix
    'no-underscore-dangle': ['error', {
      allow: ['_initialized', '_undecorateSections', '_generateId', '_buildElementMapping', '_buildDecoratedHashMap', '_getElementPath', '_getElementByPath', '_findSourceElement', '_extractHashFromLiveElement', '_logPerformanceMetrics'],
      allowAfterThis: true,
      allowAfterSuper: true,
    }],
    // Allow console statements for debugging/logging
    'no-console': 'off',
    // Allow for loops (needed for performance-critical code)
    'no-restricted-syntax': ['error', 'ForInStatement', 'LabeledStatement', 'WithStatement'],
    // Allow unary operators (++ and --)
    'no-plusplus': 'off',
  },
};

