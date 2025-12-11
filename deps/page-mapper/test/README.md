# Page Mapper Tests

Comprehensive test suite for the page-mapper implementation using Mocha and Chai.

## Running Tests

```bash
# Install dependencies first
npm install

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Test Structure

- `setup.js` - Test setup and utilities for jsdom environment
- `hash-injector.test.js` - Tests for source marker embedding
- `decoration-simulator.test.js` - Tests for page rendering
- `hash-mapper.test.js` - Tests for MapperService class
- `integration.test.js` - Integration tests for full workflow
- `index.test.js` - Tests for package exports and API

## Test Coverage

### Source Hash Embedder Tests (`hash-injector.test.js`)
- Basic marker embedding for text elements (h1-h6, p)
- Marker embedding for images (src attributes)
- Marker embedding for lists (ul, ol, li)
- Path tracking for all embedded markers
- Element skipping logic (elements with child editables)
- Edge cases (empty HTML, missing root, etc.)
- Marker format validation

### Page Renderer Tests (`decoration-simulator.test.js`)
- Iframe creation and HTML rendering
- Decorator function execution
- Block loading and async operations
- Context setup in iframe
- Error handling
- Cleanup functionality

### MapperService Tests (`hash-mapper.test.js`)
- Service initialization via orchestrator
- findSourceElement (mapping page elements to source)
- getSourceDoc (retrieve source document)
- Error handling for missing configuration
- Cleanup

### Integration Tests (`integration.test.js`)
- Full workflow from source HTML to rendered page
- Complex nested structures
- Multiple element mapping
- Image handling
- Large document handling
- Custom configuration

### Package Exports Tests (`index.test.js`)
- Main API exports (initializeMapper, createMapper)
- Component exports (embedSourceMarkers, renderPage, buildPageMapping)
- Utility exports (getElementPath, getElementByPath)
- Service class export
- End-to-end initialization

## Test Environment

Tests run in a Node.js environment using jsdom to simulate browser APIs. The setup file configures:
- Global window and document objects
- DOMParser for HTML parsing
- Performance API
- Iframe support (with jsdom limitations)

## Mock Rendering Functions

Tests use mock rendering functions that simulate typical page rendering:
- Simple decorators that add classes and attributes
- Async operation simulation
- Block loading simulation

## Performance

All 49 tests run in ~300ms:
- Source marker embedding tests: Fast
- Page rendering tests: Most time (iframe operations)
- Mapping tests: Very fast
- Integration tests: Complete workflows

## Notes

- Tests use a timeout of 30 seconds to accommodate async operations
- Iframe simulation in jsdom has limitations; some browser-specific features may not work
- Performance metrics are tracked and logged when `logPerformance: true`
- All tests pass with the refactored architecture ✅
