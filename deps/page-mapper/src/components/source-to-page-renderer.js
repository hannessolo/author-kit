/**
 * Source to Page Renderer Component
 * Pure function that renders source HTML into a page in a hidden iframe
 * 
 * Returns rendered page HTML string (iframe is cleaned up internally)
 */

/**
 * Creates a hidden iframe for page rendering
 * @returns {Promise<HTMLIFrameElement>} The created iframe
 */
function createHiddenIframe() {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.style.position = 'absolute';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.setAttribute('data-hash-simulator', 'true');

    iframe.addEventListener('load', () => {
      resolve(iframe);
    });

    document.body.appendChild(iframe);
  });
}

/**
 * Copies stylesheets from main page to iframe
 * @param {Document} iframeDoc - The iframe document
 */
function copyStylesheets(iframeDoc) {
  const stylesheets = document.querySelectorAll('link[rel="stylesheet"]');
  stylesheets.forEach((link) => {
    const newLink = iframeDoc.createElement('link');
    newLink.rel = 'stylesheet';
    newLink.href = link.href;
    iframeDoc.head.appendChild(newLink);
  });

  // Also copy inline styles
  const styles = document.querySelectorAll('style');
  styles.forEach((style) => {
    const newStyle = iframeDoc.createElement('style');
    newStyle.textContent = style.textContent;
    iframeDoc.head.appendChild(newStyle);
  });
}

/**
 * Sets up the iframe window context
 * @param {Window} iframeWindow - The iframe window
 * @param {Function} setupContext - Optional custom context setup function
 */
function setupIframeContext(iframeWindow, setupContext) {
  // Call custom setup if provided
  if (setupContext && typeof setupContext === 'function') {
    setupContext(iframeWindow);
  }

  // Also apply default: Copy hlx configuration
  if (window.hlx) {
    iframeWindow.hlx = {
      ...window.hlx,
      codeBasePath: window.hlx.codeBasePath,
      rum: { isSelected: false }, // Disable RUM in iframe
    };
  }
}

/**
 * Renders source HTML into a page in an iframe using a list of transform functions
 * Pure async function: takes HTML and options, returns rendered page HTML string
 * 
 * @param {string} markedHTML - HTML with embedded markers
 * @param {Object} options - Rendering options (prepared by orchestrator/adapter)
 * @param {Array<Function>} options.decorators - Array of decorator functions to call sequentially
 * @param {Function} options.setupContext - Optional function to setup iframe context
 * @param {string} options.rootSelector - Root element selector
 * @param {number} options.timeout - Overall timeout in milliseconds
 * @returns {Promise<string>} Rendered page HTML as a string
 */
async function renderPage(markedHTML, options) {
  const {
    decorators,
    setupContext,
    rootSelector,
    timeout,
  } = options;

  if (!decorators || decorators.length === 0) {
    throw new Error('[Page Renderer] At least one decorator function is required');
  }

  let iframe = null;

  try {
    iframe = await createHiddenIframe();

    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    const iframeWindow = iframe.contentWindow;

    // Setup context
    setupIframeContext(iframeWindow, setupContext);

    // Copy stylesheets
    copyStylesheets(iframeDoc);

    // Write the marked HTML
    iframeDoc.open();
    iframeDoc.write(markedHTML);
    iframeDoc.close();

    const root = iframeDoc.querySelector(rootSelector);
    if (!root) {
      throw new Error(`[Page Renderer] No ${rootSelector} element found in marked HTML`);
    }

    // Call all decorators sequentially
    // Each decorator receives the root element and can be sync or async
    for (const decorator of decorators) {
      await decorator(root, iframeDoc);
    }

    // Serialize the rendered page document to HTML string
    const renderedPageHTML = iframeDoc.documentElement.outerHTML;

    // Clean up iframe immediately - we don't need it anymore
    cleanupIframe(iframe);

    return renderedPageHTML;
  } catch (error) {
    console.error('[Page Renderer] Error during rendering:', error);
    if (iframe) {
      iframe.remove();
    }
    throw error;
  }
}

/**
 * Cleans up an iframe
 * @param {HTMLIFrameElement} iframe - The iframe to remove
 */
export function cleanupIframe(iframe) {
  if (iframe && iframe.parentNode) {
    iframe.remove();
  }
}

export default renderPage;

