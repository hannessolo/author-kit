/**
 * Integration tests for page mapper
 * Focus: End-to-end workflows and real-world scenarios
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import { initializeMapper } from '../src/index.js';
import DEFAULT_CONFIG from '../src/config.js';
import { createMockDecorationOptions } from './setup.js';

describe('Page Mapper Integration', () => {
  let sourceHTML;
  let mockOptions;

  beforeEach(() => {
    mockOptions = createMockDecorationOptions();
    sourceHTML = `
      <main>
        <div>
          <h1>Main Title</h1>
          <p>First paragraph</p>
          <p>Second paragraph</p>
          <img src="/image.jpg" alt="Test image" />
          <h2>Section Title</h2>
          <p>Third paragraph</p>
        </div>
      </main>
    `;
  });

  describe('End-to-end workflow', () => {
    it('should complete full initialization flow', async () => {
      const config = {
        ...DEFAULT_CONFIG,
        decorationOptions: mockOptions,
        logPerformance: false,
      };

      const service = await initializeMapper(sourceHTML, config);

      expect(service).to.exist;
      expect(service.sourceDoc).to.exist;
      expect(service.markerToSourcePath).to.exist;
    });

    it('should handle complete lookup workflow', async () => {
      const config = {
        ...DEFAULT_CONFIG,
        decorationOptions: mockOptions,
        logPerformance: false,
      };

      const service = await initializeMapper(sourceHTML, config);

      // Test that service provides lookup capability
      expect(service.findSourceElement).to.be.a('function');
      expect(service.getSourceDoc).to.be.a('function');

      const sourceDoc = service.getSourceDoc();
      expect(sourceDoc).to.exist;
      expect(sourceDoc.querySelector('main')).to.exist;
    });
  });

  describe('Multiple element handling', () => {
    it('should handle multiple elements of same type', async () => {
      const config = {
        ...DEFAULT_CONFIG,
        decorationOptions: mockOptions,
        logPerformance: false,
      };

      const service = await initializeMapper(sourceHTML, config);

      // Source has 3 paragraphs
      const sourceDoc = service.sourceDoc;
      const paragraphs = sourceDoc.querySelectorAll('p');
      expect(paragraphs.length).to.equal(3);
    });
  });

  describe('Image handling', () => {
    it('should handle image src and alt attributes', async () => {
      const config = {
        ...DEFAULT_CONFIG,
        decorationOptions: mockOptions,
        logPerformance: false,
      };

      const service = await initializeMapper(sourceHTML, config);

      const sourceImg = service.sourceDoc.querySelector('img');
      expect(sourceImg).to.exist;
    });
  });

  describe('Error handling', () => {
    it('should handle HTML with no editable elements', async () => {
      const emptyHTML = '<main></main>';
      const config = {
        ...DEFAULT_CONFIG,
        decorationOptions: mockOptions,
        logPerformance: false,
      };

      const service = await initializeMapper(emptyHTML, config);

      expect(service).to.exist;
      expect(service.markerToSourcePath.size).to.equal(0);
    });

    it('should handle large HTML documents', async () => {
      // Generate large HTML
      let largeHTML = '<main><div>';
      for (let i = 0; i < 100; i++) {
        largeHTML += `<p>Paragraph ${i}</p>`;
      }
      largeHTML += '</div></main>';

      const config = {
        ...DEFAULT_CONFIG,
        decorationOptions: mockOptions,
        logPerformance: false,
      };

      const service = await initializeMapper(largeHTML, config);

      expect(service).to.exist;
      expect(service.markerToSourcePath.size).to.be.greaterThan(50);
    });
  });

  describe('Configuration', () => {
    it('should respect custom configuration', async () => {
      const customHTML = '<body><article><h1>Title</h1></article></body>';
      const customOptions = {
        ...mockOptions,
        rootSelector: 'article',
      };
      const config = {
        ...DEFAULT_CONFIG,
        rootSelector: 'article',
        decorationOptions: customOptions,
        logPerformance: false,
      };

      const service = await initializeMapper(customHTML, config);

      expect(service.config.rootSelector).to.equal('article');
    });
  });
});
