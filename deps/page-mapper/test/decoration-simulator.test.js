/**
 * Tests for page renderer component
 * Focus: Testing pure function behavior - rendering in iframe
 */

import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import renderPage, { cleanupIframe } from '../src/components/source-to-page-renderer.js';
import DEFAULT_CONFIG from '../src/config.js';
import { createMockDecorationOptions } from './setup.js';

describe('Page Renderer', () => {
  let mockOptions;

  beforeEach(() => {
    mockOptions = createMockDecorationOptions();

    if (!document.body) {
      const body = document.createElement('body');
      document.documentElement.appendChild(body);
    }
  });

  afterEach(() => {
    // Iframes are now cleaned up automatically by renderer
  });

  describe('Basic rendering', () => {
    it('should create iframe and render page', async () => {
      const markedHTML = '<body><main><p>HASH_P_test123_HTML</p></main></body>';
      const options = { ...mockOptions };

      const result = await renderPage(markedHTML, options);

      expect(result).to.be.a('string');
      expect(result).to.include('HASH_P_test123_HTML');
      expect(result).to.include('main');
    });

    it('should write HTML into iframe', async () => {
      const markedHTML = '<body><main><h1>HASH_H1_test123_HTML</h1></main></body>';
      const options = { ...mockOptions };

      const result = await renderPage(markedHTML, options);
      const doc = new DOMParser().parseFromString(result, 'text/html');

      const h1 = doc.querySelector('h1');
      expect(h1).to.exist;
      expect(h1.textContent).to.include('HASH_H1_test123_HTML');
    });

    it('should call first decorator function', async () => {
      let decorateMainCalled = false;
      const customDecorators = [
        (root) => {
          decorateMainCalled = true;
        },
      ];

      const markedHTML = '<body><main><p>Test</p></main></body>';
      const result = await renderPage(markedHTML, {
        decorators: customDecorators,
        rootSelector: 'main',
        timeout: 10000,
      });

      expect(decorateMainCalled).to.be.true;
      expect(result).to.be.a('string');
    });

    it('should call second decorator function', async () => {
      let loadSectionsCalled = false;
      const customDecorators = [
        (root) => { },
        async (root) => {
          loadSectionsCalled = true;
        },
      ];

      const markedHTML = '<body><main><p>Test</p></main></body>';
      const result = await renderPage(markedHTML, {
        decorators: customDecorators,
        rootSelector: 'main',
        timeout: 10000,
      });

      expect(loadSectionsCalled).to.be.true;
      expect(result).to.be.a('string');
    });
  });

  describe('Block loading', () => {
    it('should execute decorators in sequence', async () => {
      const markedHTML = '<body><main><div data-block-name="test">Block</div></main></body>';
      const customDecorators = [
        (root) => {
          root.classList.add('first');
        },
        async (root) => {
          // Simulate async block loading
          const block = root.querySelector('[data-block-name]');
          block.setAttribute('data-block-status', 'loaded');
        },
      ];

      const result = await renderPage(markedHTML, {
        decorators: customDecorators,
        rootSelector: 'main',
        timeout: 10000,
      });

      const doc = new DOMParser().parseFromString(result, 'text/html');
      const block = doc.querySelector('[data-block-name]');
      expect(block.getAttribute('data-block-status')).to.equal('loaded');
      expect(doc.querySelector('main').classList.contains('first')).to.be.true;
    });
  });

  describe('Context setup', () => {
    it('should setup iframe context with custom function', async () => {
      // Test that providing a custom setup function doesn't break rendering
      let contextSetupCalled = false;
      const markedHTML = '<body><main><p>Test</p></main></body>';
      const result = await renderPage(markedHTML, {
        decorators: [(root) => root.classList.add('test')],
        setupContext: (iframeWindow) => {
          contextSetupCalled = true;
          iframeWindow.testFlag = true;
        },
        rootSelector: 'main',
        timeout: 10000,
      });

      // Should complete successfully
      expect(result).to.be.a('string');
      expect(contextSetupCalled).to.be.true;
    });
  });

  describe('Error handling', () => {

    it('should throw error if root selector not found', async () => {
      const markedHTML = '<body><div><p>No main</p></div></body>';

      try {
        await renderPage(markedHTML, {
          decorators: [(root) => root.classList.add('test')],
          rootSelector: 'main',
        });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('main');
      }
    });
  });

  describe('Cleanup', () => {
    it('should handle cleanup of non-existent iframe gracefully', () => {
      expect(() => cleanupIframe(null)).to.not.throw();
      expect(() => cleanupIframe(undefined)).to.not.throw();
    });
  });
});
