/**
 * Tests for source hash embedder component
 * Focus: Testing pure function behavior - inputs and outputs
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
import embedSourceMarkers from '../src/components/source-hash-embedder.js';
import DEFAULT_CONFIG from '../src/config.js';

describe('Source Hash Embedder', () => {
  let sourceHTML;

  beforeEach(() => {
    sourceHTML = `
      <main>
        <div>
          <h1>Test Heading</h1>
          <p>Test paragraph</p>
          <h2>Subheading</h2>
          <img src="/test.jpg" alt="Test image" />
          <ul>
            <li>Item 1</li>
            <li>Item 2</li>
          </ul>
        </div>
      </main>
    `;
  });

  describe('Basic marker embedding', () => {
    it('should embed markers into HTML elements', () => {
      const result = embedSourceMarkers(sourceHTML, DEFAULT_CONFIG);

      expect(result.markedHTML).to.include('HASH_');
      expect(result.markerMap).to.be.instanceOf(Map);
      expect(result.markerMap.size).to.be.greaterThan(0);
    });

    it('should return marker maps and HTML', () => {
      const result = embedSourceMarkers(sourceHTML, DEFAULT_CONFIG);

      expect(result).to.have.property('markedHTML');
      expect(result).to.have.property('markerMap');
      expect(result).to.have.property('markerToSourcePath');
      expect(result.markedHTML).to.be.a('string');
    });

    it('should embed markers into text elements', () => {
      const result = embedSourceMarkers(sourceHTML, DEFAULT_CONFIG);
      const doc = new DOMParser().parseFromString(result.markedHTML, 'text/html');

      const h1 = doc.querySelector('h1');
      const p = doc.querySelector('p');

      expect(h1.textContent).to.match(/^HASH_H1_[a-zA-Z0-9]+_HTML$/);
      expect(p.textContent).to.match(/^HASH_P_[a-zA-Z0-9]+_HTML$/);
    });

    it('should preserve element attributes', () => {
      const htmlWithAttrs = '<main><h1 id="title" class="heading">Test</h1></main>';
      const result = embedSourceMarkers(htmlWithAttrs, DEFAULT_CONFIG);
      const doc = new DOMParser().parseFromString(result.markedHTML, 'text/html');

      const h1 = doc.querySelector('h1');
      expect(h1.id).to.equal('title');
      expect(h1.className).to.equal('heading');
    });
  });

  describe('Image marker embedding', () => {
    it('should embed markers into img src attributes', () => {
      const result = embedSourceMarkers(sourceHTML, DEFAULT_CONFIG);
      const doc = new DOMParser().parseFromString(result.markedHTML, 'text/html');
      const img = doc.querySelector('img');

      expect(img.src).to.match(/HASH_IMG_[a-zA-Z0-9]+_SRC$/);
    });

    it('should preserve img alt attributes', () => {
      const result = embedSourceMarkers(sourceHTML, DEFAULT_CONFIG);
      const doc = new DOMParser().parseFromString(result.markedHTML, 'text/html');
      const img = doc.querySelector('img');

      // Alt attribute should be preserved, not hashed
      expect(img.alt).to.equal('Test image');
    });

    it('should handle images without alt attribute', () => {
      const html = '<main><img src="/test.jpg" /></main>';
      const result = embedSourceMarkers(html, DEFAULT_CONFIG);
      const doc = new DOMParser().parseFromString(result.markedHTML, 'text/html');
      const img = doc.querySelector('img');

      expect(img.src).to.match(/HASH_IMG_[a-zA-Z0-9]+_SRC$/);
    });
  });

  describe('List marker embedding', () => {
    it('should embed markers into list items', () => {
      const result = embedSourceMarkers(sourceHTML, DEFAULT_CONFIG);
      const doc = new DOMParser().parseFromString(result.markedHTML, 'text/html');
      const lis = doc.querySelectorAll('ul li');

      expect(lis.length).to.be.greaterThan(0);
      lis.forEach((li) => {
        expect(li.innerHTML).to.match(/HASH_LI_[a-zA-Z0-9]+_HTML/);
      });
    });

    it('should track marker values in markerMap for list items', () => {
      const result = embedSourceMarkers(sourceHTML, DEFAULT_CONFIG);

      // Find a LI marker in the map
      let liMarkerFound = false;
      for (const [marker, info] of result.markerMap.entries()) {
        if (info.element === 'LI') {
          expect(info.type).to.equal('html');
          expect(info.value).to.be.a('string');
          liMarkerFound = true;
          break;
        }
      }
      expect(liMarkerFound).to.be.true;
    });
  });

  describe('Path tracking', () => {
    it('should create marker-to-source-path mappings', () => {
      const result = embedSourceMarkers(sourceHTML, DEFAULT_CONFIG);

      expect(result.markerToSourcePath).to.be.instanceOf(Map);
      expect(result.markerToSourcePath.size).to.be.greaterThan(0);
      expect(result.markerToSourcePath.size).to.equal(result.markerMap.size);
    });

    it('should create valid path arrays', () => {
      const result = embedSourceMarkers(sourceHTML, DEFAULT_CONFIG);

      for (const [marker, path] of result.markerToSourcePath.entries()) {
        expect(path).to.be.an('array');
        if (path.length > 0) {
          expect(path[0]).to.have.property('tag');
          expect(path[0]).to.have.property('index');
        }
      }
    });
  });

  describe('Element skipping', () => {
    it('should skip elements with child editable elements', () => {
      const html = '<main><div><p>Outer</p><div><p>Inner</p></div></div></main>';
      const result = embedSourceMarkers(html, DEFAULT_CONFIG);
      const doc = new DOMParser().parseFromString(result.markedHTML, 'text/html');

      // Should only inject into leaf elements
      const paragraphs = doc.querySelectorAll('p');
      paragraphs.forEach((p) => {
        expect(p.textContent).to.match(/HASH_/);
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle HTML without main element', () => {
      const result = embedSourceMarkers('<div>test</div>', DEFAULT_CONFIG);

      expect(result.markerMap.size).to.equal(0);
      expect(result.markerToSourcePath.size).to.equal(0);
    });

    it('should handle elements with empty text content', () => {
      const html = '<main><p></p><p>Text</p></main>';
      const result = embedSourceMarkers(html, DEFAULT_CONFIG);

      // Should only embed into non-empty elements
      expect(result.markerMap.size).to.be.greaterThan(0);
    });

    it('should use custom root selector', () => {
      const html = '<article><h1>Title</h1></article>';
      const config = { ...DEFAULT_CONFIG, rootSelector: 'article' };
      const result = embedSourceMarkers(html, config);

      expect(result.markerMap.size).to.be.greaterThan(0);
    });

    it('should use custom target selectors', () => {
      const html = '<main><h1>Title</h1><span>Text</span></main>';
      const config = { ...DEFAULT_CONFIG, targetSelectors: ['span'] };
      const result = embedSourceMarkers(html, config);

      const doc = new DOMParser().parseFromString(result.markedHTML, 'text/html');
      const span = doc.querySelector('span');
      const h1 = doc.querySelector('h1');

      expect(span.textContent).to.match(/HASH_/);
      expect(h1.textContent).to.equal('Title'); // Should not be hashed
    });
  });

  describe('Marker format', () => {
    it('should use custom marker prefix', () => {
      const config = { ...DEFAULT_CONFIG, hashPrefix: 'TEST_' };
      const result = embedSourceMarkers(sourceHTML, config);

      expect(result.markedHTML).to.include('TEST_');
      expect(result.markedHTML).to.not.include('HASH_');
    });

    it('should respect marker ID length', () => {
      const config = { ...DEFAULT_CONFIG, hashIdLength: 12 };
      const result = embedSourceMarkers(sourceHTML, config);
      const doc = new DOMParser().parseFromString(result.markedHTML, 'text/html');
      const h1 = doc.querySelector('h1');

      // Format: HASH_H1_{12chars}_HTML
      const match = h1.textContent.match(/HASH_H1_([a-zA-Z0-9]+)_HTML/);
      expect(match).to.exist;
      expect(match[1].length).to.equal(12);
    });
  });
});
