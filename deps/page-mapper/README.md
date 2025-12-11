# Page Mapper

Maps rendered page elements back to their original source elements. Perfect for live editing systems where you need to know which source element corresponds to a rendered page element.

## Problem & Solution

**Problem**: You have source HTML (simple, semantic) that gets transformed into a rendered page (complex, decorated). You need to map page elements → source elements.

**Solution**: Page Mapper creates a bidirectional mapping using a three-phase process:
1. **Embed markers** in source → track elements
2. **Render page** in iframe → simulate transformation  
3. **Build mapping** → fast O(1) lookups

## Features

- ✅ **Fast**: O(1) lookups (~0.1ms per call)
- ✅ **Reliable**: Works with complex transformations and duplicate content
- ✅ **Non-invasive**: Never modifies the live page
- ✅ **Framework-agnostic**: Works with any rendering system

## Quick Start

```javascript
import { initializeMapper, DEFAULT_CONFIG } from './src/index.js';

// Define your rendering pipeline
const config = {
  ...DEFAULT_CONFIG,
  decorationOptions: {
    decorators: [
      (root) => decorateMain(root),
      async (root) => loadSections(root),
    ],
    rootSelector: 'main',
    timeout: 10000,
  },
};

// Initialize (one-time, ~75ms for typical pages)
const mapper = await initializeMapper(sourceHTML, config);

// Use (fast, ~0.1ms per lookup)
const sourceElement = mapper.findSourceElement(pageElement);
```

## API

### `initializeMapper(sourceHTML, config)`

Creates and initializes the mapper.

**Returns**: `Promise<MapperService>`

```javascript
const mapper = await initializeMapper(sourceHTML, {
  rootSelector: 'main',
  targetSelectors: ['h1', 'h2', 'h3', 'p', 'img'],
  decorationOptions: {
    decorators: [/* your functions */],
    rootSelector: 'main',
    timeout: 10000,
  },
});
```

### MapperService

```javascript
class MapperService {
  // Find source element for a page element
  findSourceElement(pageElement: HTMLElement): HTMLElement | null
  
  // Get the source document
  getSourceDoc(): Document
}
```

## Configuration

```javascript
{
  rootSelector: 'main',                    // Root element selector
  targetSelectors: ['h1', 'h2', 'p', ...], // Elements to track
  hashPrefix: 'HASH_',                     // Internal marker prefix
  hashIdLength: 8,                         // Marker ID length
  timeout: 10000,                          // Rendering timeout (ms)
  logPerformance: true,                    // Log performance metrics
  decorationOptions: {
    decorators: [...],                     // Your rendering functions
    rootSelector: 'main',
    timeout: 10000,
  }
}
```

## Creating an Adapter

For framework-specific usage, create an adapter:

```javascript
// aem-adapter.js
import { initializeMapper, DEFAULT_CONFIG } from './src/index.js';

async function createAEMPageMapper(sourceHTML, options = {}) {
  const { decorateMain } = await import('./your-scripts.js');
  const { loadSections } = await import('./your-aem.js');
  
  return initializeMapper(sourceHTML, {
    ...DEFAULT_CONFIG,
    ...options,
    decorationOptions: {
      decorators: [
        (root) => decorateMain(root),
        (root) => loadSections(root),
      ],
      rootSelector: 'main',
      timeout: options.timeout || 10000,
    },
  });
}
```

## Usage Example

```javascript
// Initialize
const mapper = await createAEMPageMapper(sourceHTML);

// Add click handlers
document.addEventListener('click', (e) => {
  const el = e.target.closest('h1, h2, h3, p, img');
  if (el) {
    const source = mapper.findSourceElement(el);
    if (source) {
      // Edit the source element
      showEditor(source);
    }
  }
});
```

## Architecture

```
page-mapper/
├── src/
│   ├── components/              # Core logic
│   │   ├── source-hash-embedder.js
│   │   ├── source-to-page-renderer.js
│   │   └── page-hash-mapper.js
│   ├── orchestrator.js          # Coordinates phases
│   ├── mapper-service.js        # Public API
│   ├── config.js               # Configuration
│   └── index.js                # Main entry
└── test/                       # Test suite
```

## Performance

| Phase | Time | When |
|-------|------|------|
| **Initialization** | ~75ms | One-time (varies by page complexity) |
| **Lookup** | ~0.1ms | Per call |

**Memory**: ~100 bytes per tracked element

**Scaling**: Handles 1000+ elements efficiently

## Testing

```bash
cd scripts/page-mapper
npm install
npm test
```

## Advanced Usage

### Direct Component Access

```javascript
import { embedSourceMarkers, renderPage, buildPageMapping } from './src/index.js';

// Phase 1: Embed markers
const { markedHTML, markerMap, markerToSourcePath } = 
  embedSourceMarkers(sourceHTML, config);

// Phase 2: Render page
const renderedHTML = await renderPage(markedHTML, decorationOptions);

// Phase 3: Build mapping
const { markerToPagePath } = buildPageMapping(
  renderedPageDoc, sourceDoc, markerToSourcePath, config
);
```

### Error Handling

```javascript
try {
  const mapper = await initializeMapper(sourceHTML, config);
  const source = mapper.findSourceElement(pageElement);
  
  if (!source) {
    // Element not found - might be dynamic
    console.warn('No source element found');
  }
} catch (error) {
  // Initialization failed
  console.error('Mapper failed:', error.message);
}
```

## Common Issues

| Issue | Solution |
|-------|----------|
| **Timeout error** | Increase `timeout` in config |
| **Element not found** | Element might be dynamic (not in source) |
| **Root selector missing** | Check your source HTML structure |

## Documentation

- **[FLOW_DIAGRAM.md](./FLOW_DIAGRAM.md)** - Detailed flow diagrams, complete examples, integration patterns
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Technical architecture and design decisions
- **[test/README.md](./test/README.md)** - Test documentation

## Key Concepts

**Phase 1 - Embed**: Replace source content with tracking markers
```html
<h1>Hello</h1> → <h1>MARKER_H1_abc123</h1>
```

**Phase 2 - Render**: Simulate your rendering in an iframe
```html
<h1>MARKER_H1_abc123</h1> → <div class="section"><h1>MARKER_H1_abc123</h1></div>
```

**Phase 3 - Map**: Build path mappings
```javascript
MARKER_H1_abc123 → sourcePath: [H1[0]]
MARKER_H1_abc123 → pagePath: [DIV[0] > H1[0]]
```

**Runtime**: Fast lookups using pre-built mappings
```javascript
pageElement → pagePath → marker → sourcePath → sourceElement
```

## License

Apache 2.0 (same as parent project)
