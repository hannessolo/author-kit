# Page Mapper Architecture

## Problem Statement

The page mapper needs to map elements from the **live rendered page** (what users see and interact with) back to their corresponding elements in the **source HTML** (what gets saved).

The challenge: Page rendering transforms the HTML structure significantly, making direct content matching unreliable.

## Solution: Marker-Based Structural Mapping

### Key Insight

The mapper uses **tracking markers as anchors** to track how elements move during rendering, then builds **structural path mappings** that can be used to find elements in the live page.

**Critical**: The mapper **never modifies the live page**. It only uses the pre-built mappings to translate between live DOM structure and source DOM structure.

## Three-Phase Initialization

### Phase 1: Source Marker Embedding

```javascript
// Input: Source HTML
<main>
  <div>
    <p>Hello World</p>
  </div>
</main>

// Output: Marked HTML (internal representation)
<main>
  <div>
    <p data-source-marked="true" 
       data-marker-ids="MARKER_P_abc123">
      MARKER_P_abc123_HTML
    </p>
  </div>
</main>

// Also creates: markerToSourcePath
Map {
  "MARKER_P_abc123_HTML" => [{ tag: "DIV", index: 0 }, { tag: "P", index: 0 }]
}
```

### Phase 2: Page Rendering

```javascript
// Input: Marked HTML (in isolated iframe)
<main>
  <div>
    <p>MARKER_P_abc123_HTML</p>
  </div>
</main>

// After rendering (e.g., AEM's decorateMain + loadSections)
<main>
  <div class="section">
    <div class="default-content-wrapper">
      <p>MARKER_P_abc123_HTML</p>
    </div>
  </div>
</main>
```

### Phase 3: Path Mapping

```javascript
// Scans rendered page HTML to find where each marker ended up
// Creates: markerToPagePath
Map {
  "MARKER_P_abc123_HTML" => [
    { tag: "DIV", index: 0 },      // .section
    { tag: "DIV", index: 0 },      // .default-content-wrapper
    { tag: "P", index: 0 }         // <p>
  ]
}

// Also creates reverse index: pagePathToMarker
Map {
  '[{"tag":"DIV","index":0},{"tag":"DIV","index":0},{"tag":"P","index":0}]' 
    => "MARKER_P_abc123_HTML"
}
```

## Runtime Mapping Flow

When a client application calls `mapper.findSourceElement(pageElement)`:

```javascript
// Step 1: Get structural path of page element
const pageRoot = document.querySelector('main');
const pagePath = getElementPath(pageElement, pageRoot);
// Result: [{ tag: "DIV", index: 0 }, { tag: "DIV", index: 0 }, { tag: "P", index: 0 }]

// Step 2: Look up marker by page path (reverse lookup)
const pathKey = JSON.stringify(pagePath);
const marker = pagePathToMarker.get(pathKey);
// Result: "MARKER_P_abc123_HTML"

// Step 3: Get source path from marker
const sourcePath = markerToSourcePath.get(marker);
// Result: [{ tag: "DIV", index: 0 }, { tag: "P", index: 0 }]

// Step 4: Navigate to source element
const sourceRoot = sourceDoc.querySelector('main');
const sourceElement = getElementByPath(sourceRoot, sourcePath);
// Result: <p>Hello World</p> (from source DOM)
```

## Why This Works

1. **Markers survive rendering**: Even though rendering adds wrapper divs and classes, the marker text/attributes remain intact
2. **Structural paths are reliable**: As long as rendering is deterministic, the same source element always ends up at the same page path
3. **No live page modification**: The live page runs normally; the mapper just observes its structure
4. **O(1) lookups**: All mappings are pre-built Maps, so runtime lookups are instant

## Data Structures

```javascript
class MapperService {
  // DOM Documents
  sourceDoc: Document              // Parsed source HTML (mutable - gets edited)
  
  // Forward mappings (from initialization)
  markerToSourcePath: Map<marker, path[]>   // marker → where in source
  markerToPagePath: Map<marker, path[]>     // marker → where in rendered page
  
  // Reverse index (built in constructor)
  pagePathToMarker: Map<pathKey, marker>    // page path → marker
  
  // Configuration
  config: Config                            // Mapper configuration
}
```

## Path Format

Paths are arrays of `{ tag, index }` objects representing the route from root to element:

```javascript
// Example: main > div.section > div.wrapper > p
[
  { tag: "DIV", index: 0 },  // First div child of main
  { tag: "DIV", index: 0 },  // First div child of that div
  { tag: "P", index: 0 }     // First p child of that div
]
```

## Component Responsibilities

### Pure Functions (in `/src/components/`)

- **`source-hash-embedder.js`**: Takes source HTML, embeds tracking markers, returns marked HTML + marker maps
- **`source-to-page-renderer.js`**: Takes marked HTML, renders in iframe using provided decorators, returns rendered page HTML
- **`page-hash-mapper.js`**: Takes rendered page document + marker data, returns path mappings

### Orchestrator (`/src/orchestrator.js`)

- Coordinates the three phases
- Measures performance metrics
- Creates `MapperService` instance

### Service Layer (`/src/mapper-service.js`)

- Provides application-facing API
- Manages runtime lookups using the pre-built mappings
- Implements core mapping logic using structural paths

### Adapter (Optional, External)

- Framework-specific configuration
- Imports framework rendering functions
- Constructs rendering options for the orchestrator
- Lives outside the page-mapper package

## API Contract

The `MapperService` provides a clean API to client applications:

```javascript
// Find source element for a page element
const sourceElement = mapper.findSourceElement(pageElement);

// Get the source document
const sourceDoc = mapper.getSourceDoc();

// The service uses pre-built mappings for O(1) lookups
// No need to "initialize" elements - just query directly
```

## Rendering Pipeline

The page rendering happens in an isolated iframe to ensure accurate simulation:

```javascript
// In iframe:
1. Write marked HTML to iframe document
2. Copy stylesheets from main page
3. Setup context (hlx, window variables, etc.)
4. Run decorators sequentially:
   - decorateMain(root)       // AEM decoration
   - loadSections(root)       // Load blocks/components
   - waitForBlocks(root)      // Wait for async loading
5. Serialize final HTML
6. Clean up iframe

// Result: Fully rendered page HTML with all transformations applied
```

## Key Design Decisions

### 1. Structural Path Matching over Content Matching
**Why**: More reliable when rendering changes content, handles duplicates, works with transformed HTML

**Example**:
```javascript
// Content matching would fail here (duplicate "Hello")
<p>Hello</p>
<p>Hello</p>

// Path matching succeeds:
[DIV[0] > P[0]] → first <p>
[DIV[0] > P[1]] → second <p>
```

### 2. Pre-built Reverse Index
**Why**: Trades memory for O(1) lookup speed

**Impact**:
- Initialization: ~75ms (one time, typical page)
- Runtime lookup: ~0.1ms (every call)
- Memory: ~100 bytes per element

### 3. JSON Serialization for Path Keys
**Why**: Simple and effective for Map lookups

```javascript
const pathKey = JSON.stringify([
  { tag: "DIV", index: 0 },
  { tag: "P", index: 0 }
]);
// Result: '[{"tag":"DIV","index":0},{"tag":"P","index":0}]'
```

### 4. Separation of Concerns
**Why**: Pure functions for core logic, service for state management

**Benefits**:
- Testable components
- Reusable functions
- Clear responsibilities

### 5. Non-invasive Design
**Why**: Never modifies the live page, only observes it

**Benefits**:
- No interference with page functionality
- No need to re-initialize on DOM changes
- Works with any JavaScript framework

## Implementation Details

### Marker Format

Markers follow this pattern: `{PREFIX}_{ELEMENT}_{ID}_{TYPE}`

```javascript
// Examples:
"HASH_H1_abc123_HTML"    // Heading text
"HASH_P_xyz789_HTML"     // Paragraph text
"HASH_IMG_def456_SRC"    // Image source
```

**Note**: The prefix "HASH_" is kept for backward compatibility, but internally we call them "markers" to clarify they're tracking markers, not cryptographic hashes.

### Element Tracking

Elements are tracked using data attributes:

```html
<h1 data-source-marked="true" 
    data-marker-ids="HASH_H1_abc123_HTML">
  HASH_H1_abc123_HTML
</h1>
```

**Attributes**:
- `data-source-marked="true"` - Indicates element has been marked
- `data-marker-ids` - Comma-separated list of markers for this element

### Path Navigation

```javascript
// Navigate from root to element using path
function getElementByPath(root, path) {
  let current = root;
  
  for (const step of path) {
    const children = Array.from(current.children)
      .filter(child => child.tagName === step.tag);
    
    if (step.index >= children.length) {
      return null;  // Path invalid
    }
    
    current = children[step.index];
  }
  
  return current;
}
```

## Error Handling

### Scenario 1: Element Not Found
```javascript
const sourceElement = mapper.findSourceElement(pageElement);
// Returns: null

// Reasons:
// - Page element is dynamically generated (not in source)
// - Page element is outside tracked selectors
// - Rendering is non-deterministic
```

### Scenario 2: Multiple Markers Per Element
```javascript
// List items may have multiple markers
<li data-marker-ids="HASH_LI_abc123_HTML">
  <strong>HASH_STRONG_xyz789_HTML</strong>
</li>

// The mapper tracks both markers:
// - HASH_LI_abc123_HTML → <li> content
// - HASH_STRONG_xyz789_HTML → <strong> content
```

### Scenario 3: Rendering Timeout
```javascript
// If rendering takes too long:
Error: [Page Renderer] Rendering timeout after 10000ms

// Solution: Increase timeout in config
const mapper = await createAEMPageMapper(sourceHTML, {
  timeout: 20000  // 20 seconds
});
```

## Performance Characteristics

### Initialization (One-time)
```
Phase 1: Embed Markers       ~2ms     O(n) where n = # of elements
Phase 2: Render Page         ~70ms    O(n) + decoration cost (varies)
Phase 3: Build Mapping       ~1ms     O(n)
────────────────────────────────────────────────────────
Total:                       ~75ms    O(n)

Example: 36 elements
  embeddingMs: 2.10ms
  renderingMs: 66.40ms
  mappingMs: 1.00ms
  totalMs: 69.70ms
```

### Runtime Lookups (Per call)
```
findSourceElement()          ~0.1ms   O(1)
  - Get page path            ~0.05ms  O(depth)
  - Map lookup (marker)      ~0.01ms  O(1)
  - Map lookup (source path) ~0.01ms  O(1)
  - Navigate to element      ~0.03ms  O(depth)
```

### Memory Usage
```
Source document:     ~size of HTML
Marker mappings:     ~100 bytes per element
Path mappings:       ~50 bytes per element
────────────────────────────────────────
Example (100 elements): ~15KB total
```

## Testing Strategy

The test suite validates each component independently:

### Unit Tests
- `source-hash-embedder.test.js` - Marker embedding logic
- `source-to-page-renderer.test.js` - Page rendering in iframe
- `page-hash-mapper.test.js` - Path mapping extraction

### Integration Tests
- `integration.test.js` - Full initialization flow
- `index.test.js` - Public API contracts

### Test Coverage
- ✅ Basic marker embedding
- ✅ Image attribute tracking
- ✅ List item handling
- ✅ Path serialization
- ✅ Element navigation
- ✅ Error scenarios
- ✅ Edge cases (duplicates, empty elements, etc.)

## Future Enhancements

### Potential Improvements
1. **Bidirectional lookup**: Source → Page element mapping
2. **Change detection**: Detect when page structure changes
3. **Incremental updates**: Update mappings without full re-initialization
4. **Custom marker format**: Allow user-defined marker patterns
5. **Performance profiling**: Built-in performance monitoring

### Limitations
- Assumes deterministic rendering (same source → same page)
- Requires re-initialization if page structure changes significantly
- Cannot track dynamically added elements (not in source)

## Summary

The Page Mapper provides a robust, performant solution for mapping rendered page elements to source elements:

- **Fast**: O(1) lookups after one-time O(n) initialization
- **Reliable**: Uses structural paths, not fragile content matching
- **Non-invasive**: Observes page without modifications
- **Maintainable**: Clear separation of concerns, well-tested components

The three-phase approach (embed → render → map) ensures accurate tracking even through complex rendering transformations.
