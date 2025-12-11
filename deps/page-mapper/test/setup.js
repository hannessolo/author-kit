/**
 * Test setup for hash-mapper tests
 * Configures jsdom environment for Node.js testing
 */

import { JSDOM } from 'jsdom';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create a global DOM environment
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
  resources: 'usable',
});

global.window = dom.window;
global.document = dom.window.document;
global.DOMParser = dom.window.DOMParser;
global.HTMLIFrameElement = dom.window.HTMLIFrameElement;
global.Node = dom.window.Node;
global.NodeFilter = dom.window.NodeFilter;

// Create a proper performance polyfill to avoid jsdom recursion issues
const startTime = Date.now();
global.performance = {
  now: () => Date.now() - startTime,
  mark: () => {},
  measure: () => {},
  getEntriesByType: () => [],
  getEntriesByName: () => [],
  clearMarks: () => {},
  clearMeasures: () => {},
};

// Polyfill for iframe contentDocument/contentWindow in jsdom
const originalCreateElement = document.createElement.bind(document);
document.createElement = function(tagName, options) {
  const element = originalCreateElement(tagName, options);
  if (tagName.toLowerCase() === 'iframe') {
    // Create a mock iframe with contentDocument
    const iframeDom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
      url: 'http://localhost',
    });
    const iframeDoc = iframeDom.window.document;
    const iframeWindow = iframeDom.window;
    
    Object.defineProperty(element, 'contentDocument', {
      get: () => iframeDoc,
      configurable: true,
    });
    Object.defineProperty(element, 'contentWindow', {
      get: () => iframeWindow,
      configurable: true,
    });
    
    // Mock load event
    setTimeout(() => {
      if (element.onload) {
        element.onload();
      }
      const event = new dom.window.Event('load');
      element.dispatchEvent(event);
    }, 0);
  }
  return element;
};

// Helper to load test HTML files
export function loadTestHTML(filename) {
  const filePath = join(__dirname, filename);
  return readFileSync(filePath, 'utf-8');
}

// Helper to create a simple decoration function for testing
export function createMockDecorationFunctions() {
  return {
    decorateMain: (mainElement) => {
      // Simple decoration: wrap sections in divs
      const sections = Array.from(mainElement.children);
      sections.forEach((section) => {
        if (section.tagName === 'DIV' && !section.classList.contains('decorated-section')) {
          section.classList.add('decorated-section');
        }
      });
    },
    loadSections: async (mainElement) => {
      // Mock section loading - mark blocks as loaded
      const blocks = mainElement.querySelectorAll('[data-block-name]');
      blocks.forEach((block) => {
        block.setAttribute('data-block-status', 'loaded');
      });
      return Promise.resolve();
    },
    setupContext: (iframeWindow) => {
      // Mock context setup
      iframeWindow.hlx = {
        codeBasePath: '/',
        rum: { isSelected: false },
      };
    },
  };
}

// Helper to create decorator-specific options (for iframe decorator)
export function createMockDecorationOptions() {
  const functions = createMockDecorationFunctions();
  return {
    decorators: [
      // Decorator 1: Mock decorateMain
      (root) => {
        root.classList.add('decorated');
      },
      // Decorator 2: Mock loadSections
      async (root) => {
        const blocks = root.querySelectorAll('[data-block-name]');
        blocks.forEach((block) => {
          block.setAttribute('data-block-status', 'loaded');
        });
      },
    ],
    setupContext: functions.setupContext,
    rootSelector: 'main',
    timeout: 10000,
  };
}

