/**
 * Tests for main entry point (index.js)
 * Focus: Testing exported API
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import {
  initializeMapper,
  createMapper,
  MapperService,
  embedSourceMarkers,
  renderPage,
  buildPageMapping,
  getElementPath,
  getElementByPath,
  DEFAULT_CONFIG,
} from '../src/index.js';
import { createMockDecorationOptions } from './setup.js';

describe('Page Mapper Package Exports', () => {
  let mockOptions;
  let sourceHTML;

  beforeEach(() => {
    mockOptions = createMockDecorationOptions();
    sourceHTML = '<main><h1>Test</h1><p>Paragraph</p></main>';
  });

  afterEach(() => {
    // Clean up iframes
    const iframes = document.querySelectorAll('iframe[data-hash-simulator]');
    iframes.forEach((iframe) => iframe.remove());
  });

  describe('Main exports', () => {
    it('should export initializeMapper function', () => {
      expect(initializeMapper).to.be.a('function');
    });

    it('should export createMapper alias', () => {
      expect(createMapper).to.be.a('function');
      expect(createMapper).to.equal(initializeMapper);
    });

    it('should export MapperService class', () => {
      expect(MapperService).to.be.a('function');
    });

    it('should export DEFAULT_CONFIG', () => {
      expect(DEFAULT_CONFIG).to.be.an('object');
      expect(DEFAULT_CONFIG.rootSelector).to.equal('main');
    });
  });

  describe('Component exports', () => {
    it('should export embedSourceMarkers function', () => {
      expect(embedSourceMarkers).to.be.a('function');

      const result = embedSourceMarkers(sourceHTML, DEFAULT_CONFIG);
      expect(result).to.have.property('markedHTML');
      expect(result).to.have.property('markerMap');
      expect(result).to.have.property('markerToSourcePath');
    });

    it('should export renderPage function', async () => {
      expect(renderPage).to.be.a('function');

      const markedHTML = '<body><main><p>HASH_P_test_HTML</p></main></body>';
      const result = await renderPage(markedHTML, mockOptions);

      expect(result).to.be.a('string');
      expect(result).to.include('HASH_P_test_HTML');
    });

    it('should export buildPageMapping function', () => {
      expect(buildPageMapping).to.be.a('function');

      const doc = new DOMParser().parseFromString(sourceHTML, 'text/html');
      const result = buildPageMapping(doc, doc, new Map(), DEFAULT_CONFIG);

      expect(result).to.have.property('markerToPagePath');
    });
  });

  describe('Helper exports', () => {

    it('should export getElementPath function', () => {
      expect(getElementPath).to.be.a('function');

      const root = document.createElement('main');
      const child = document.createElement('p');
      root.appendChild(child);

      const path = getElementPath(child, root);
      expect(path).to.be.an('array');
    });

    it('should export getElementByPath function', () => {
      expect(getElementByPath).to.be.a('function');

      const root = document.createElement('main');
      const child = document.createElement('p');
      root.appendChild(child);

      const path = [{ tag: 'P', index: 0 }];
      const found = getElementByPath(root, path);
      expect(found).to.equal(child);
    });
  });

  describe('initializeMapper integration', () => {
    it('should create fully initialized service', async () => {
      const config = {
        ...DEFAULT_CONFIG,
        decorationOptions: mockOptions,
        logPerformance: false,
      };

      const service = await initializeMapper(sourceHTML, config);

      expect(service).to.be.instanceOf(MapperService);
      expect(service.sourceDoc).to.exist;
      expect(service.markerToSourcePath).to.exist;
    });
  });
});
