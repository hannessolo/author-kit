/* Page Mapper Library - ES Module */


// src/utils.js
function generateRandomId(length = null) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const idLength = length || (Math.random() < 0.5 ? 6 : 8);
  let result = "";
  for (let i = 0; i < idLength; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
function getElementPath(element, root) {
  const path = [];
  let current = element;
  while (current && current !== root) {
    const parent = current.parentElement;
    if (!parent || parent === root) {
      const siblings2 = Array.from(root.children);
      const index2 = siblings2.indexOf(current);
      path.unshift({
        tag: current.tagName,
        index: index2
      });
      break;
    }
    const siblings = Array.from(parent.children);
    const index = siblings.indexOf(current);
    path.unshift({
      tag: current.tagName,
      index
    });
    current = parent;
  }
  return path;
}
function getElementByPath(root, path) {
  let current = root;
  for (const step of path) {
    if (!current) return null;
    const candidate = current.children[step.index];
    if (!candidate) return null;
    if (candidate.tagName !== step.tag) {
      return null;
    }
    current = candidate;
  }
  return current;
}

// src/components/source-marker-embedder.js
function createMarker(elementType, contentType, prefix, idLength) {
  const randomId = generateRandomId(idLength);
  return `${prefix}${elementType}_${randomId}_${contentType}`;
}
function getDepth(element, root) {
  let depth = 0;
  let current = element;
  while (current && current !== root) {
    depth += 1;
    current = current.parentElement;
  }
  return depth;
}
function embedSourceMarkers(sourceHTML, config) {
  const {
    rootSelector,
    targetSelectors,
    markerPrefix,
    markerIdLength
  } = config;
  const parser = new DOMParser();
  const doc = parser.parseFromString(sourceHTML, "text/html");
  const markerMap = /* @__PURE__ */ new Map();
  const markerToSourcePath = /* @__PURE__ */ new Map();
  const root = doc.body.querySelector(rootSelector);
  if (!root) {
    console.warn(`[Source Embedder] No ${rootSelector} element found in source HTML`);
    return { markedHTML: sourceHTML, markerMap, markerToSourcePath };
  }
  const targetSelectorsStr = Array.isArray(targetSelectors) ? targetSelectors.join(", ") : targetSelectors;
  const targetElements = root.querySelectorAll(targetSelectorsStr);
  const elementsArray = Array.from(targetElements);
  elementsArray.sort((a, b) => {
    const depthA = getDepth(a, root);
    const depthB = getDepth(b, root);
    return depthB - depthA;
  });
  elementsArray.forEach((element) => {
    const elementType = element.tagName;
    const elementMarkers = [];
    if (elementType === "IMG") {
      const originalSrc = element.getAttribute("src") || "";
      if (originalSrc) {
        const srcMarker = createMarker(elementType, "SRC", markerPrefix, markerIdLength);
        markerMap.set(srcMarker, {
          type: "attribute",
          name: "src",
          value: originalSrc,
          element: elementType
        });
        element.setAttribute("src", srcMarker);
        elementMarkers.push(srcMarker);
      }
    } else if (["UL", "OL"].includes(elementType)) {
      const listItems = element.querySelectorAll(":scope > li");
      listItems.forEach((li) => {
        const originalLiHTML = li.innerHTML || "";
        if (originalLiHTML.trim()) {
          const htmlMarker = createMarker("LI", "HTML", markerPrefix, markerIdLength);
          markerMap.set(htmlMarker, {
            type: "html",
            value: originalLiHTML,
            element: "LI"
          });
          li.innerHTML = htmlMarker;
          const liPath = getElementPath(li, root);
          markerToSourcePath.set(htmlMarker, liPath);
          li.setAttribute("data-marker-ids", htmlMarker);
          li.setAttribute("data-source-marked", "true");
        }
      });
    } else {
      const hasContent = element.textContent.trim() || element.childNodes.length > 0;
      if (hasContent) {
        const htmlMarker = createMarker(elementType, "HTML", markerPrefix, markerIdLength);
        const originalHTML = element.innerHTML || "";
        markerMap.set(htmlMarker, {
          type: "html",
          value: originalHTML,
          element: elementType
        });
        const markerNode = element.ownerDocument.createTextNode(htmlMarker + " ");
        element.insertBefore(markerNode, element.firstChild);
        elementMarkers.push(htmlMarker);
      }
    }
    if (elementMarkers.length > 0) {
      const path = getElementPath(element, root);
      element.setAttribute("data-marker-ids", elementMarkers.join(","));
      element.setAttribute("data-source-marked", "true");
      elementMarkers.forEach((marker) => {
        markerToSourcePath.set(marker, path);
      });
    }
  });
  const markedHTML = doc.body.outerHTML;
  return {
    markedHTML,
    markerMap,
    markerToSourcePath,
    sourceDoc: doc
  };
}
var source_marker_embedder_default = embedSourceMarkers;

// src/components/iframe-page-renderer.js
function createHiddenIframe() {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.style.position = "absolute";
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "none";
    iframe.setAttribute("data-page-mapper-url", "true");
    iframe.addEventListener("load", () => {
      resolve(iframe);
    });
    document.body.appendChild(iframe);
  });
}
async function waitForCondition(iframeWindow, waitFor) {
  if (!waitFor) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return;
  }
  const startTime = Date.now();
  const timeout = waitFor.timeout || 1e4;
  if (waitFor.type === "delay") {
    await new Promise((resolve) => setTimeout(resolve, waitFor.ms));
    return;
  }
  if (waitFor.type === "event") {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`[URL Renderer] Timeout waiting for event: ${waitFor.name}`));
      }, timeout);
      iframeWindow.addEventListener(waitFor.name, () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
    });
  }
  while (Date.now() - startTime < timeout) {
    if (waitFor.type === "function") {
      if (iframeWindow[waitFor.fn]) {
        return;
      }
    } else if (waitFor.type === "selector") {
      if (iframeWindow.document.querySelector(waitFor.value)) {
        return;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  console.warn(`[URL Renderer] Wait condition timeout after ${timeout}ms`);
}
async function renderPageFromURL(markedHTML, options) {
  const {
    url,
    rootSelector = "main",
    waitFor,
    setupContext
  } = options;
  if (!url) {
    throw new Error("[URL Renderer] url is required");
  }
  let iframe = null;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`[URL Renderer] Failed to fetch ${url}: ${response.status}`);
    }
    let pageHTML = await response.text();
    const parser = new DOMParser();
    const pageDoc = parser.parseFromString(pageHTML, "text/html");
    const markedDoc = parser.parseFromString(markedHTML, "text/html");
    const pageRoot = pageDoc.querySelector(rootSelector);
    const markedRoot = markedDoc.querySelector(rootSelector);
    if (!pageRoot) {
      throw new Error(`[URL Renderer] Root element ${rootSelector} not found in page from ${url}`);
    }
    if (!markedRoot) {
      throw new Error(`[URL Renderer] Root element ${rootSelector} not found in marked HTML`);
    }
    pageRoot.innerHTML = markedRoot.innerHTML;
    iframe = await createHiddenIframe();
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    const iframeWindow = iframe.contentWindow;
    if (setupContext && typeof setupContext === "function") {
      setupContext(iframeWindow);
    }
    iframeDoc.open();
    iframeDoc.write(pageDoc.documentElement.outerHTML);
    iframeDoc.close();
    await waitForCondition(iframeWindow, waitFor);
    const renderedHTML = iframeDoc.documentElement.outerHTML;
    if (iframe && iframe.parentNode) {
      iframe.remove();
    }
    return renderedHTML;
  } catch (error) {
    console.error("[URL Renderer] Error during rendering:", error);
    if (iframe && iframe.parentNode) {
      iframe.remove();
    }
    throw error;
  }
}
var iframe_page_renderer_default = renderPageFromURL;

// src/components/decorator-page-renderer.js
async function renderPageWithRenderers(markedHTML, options = {}) {
  const { renderers = [], rootSelector = "main" } = options;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(markedHTML, "text/html");
    const root = doc.querySelector(rootSelector);
    if (!root) {
      throw new Error(`[Renderer] Root "${rootSelector}" not found`);
    }
    for (let i = 0; i < renderers.length; i++) {
      const renderer = renderers[i];
      if (typeof renderer !== "function") {
        throw new Error(`[Renderer] Renderer ${i} is not a function`);
      }
      await renderer(root, doc);
    }
    return doc.documentElement.outerHTML;
  } catch (error) {
    console.error("[Renderer] Error:", error);
    throw error;
  }
}
var decorator_page_renderer_default = renderPageWithRenderers;

// src/components/page-marker-mapper.js
function buildRenderedPageMarkerMap(root, doc, config) {
  const markerMap = /* @__PURE__ */ new Map();
  const markerPrefix = config.markerPrefix;
  const markerPattern = new RegExp(`\\b${markerPrefix}[A-Z0-9]+_[a-zA-Z0-9]+_[A-Z]+\\b`, "g");
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node = walker.currentNode;
  while (node) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent) {
      const matches = node.textContent.match(markerPattern);
      if (matches) {
        const parent = node.parentElement;
        if (parent) {
          matches.forEach((marker) => {
            if (marker.startsWith(markerPrefix)) {
              const existingInfo = markerMap.get(marker);
              const newPath = getElementPath(parent, root);
              if (!existingInfo || newPath.length > existingInfo.path.length) {
                markerMap.set(marker, { element: parent, path: newPath });
              }
            }
          });
        }
      }
    } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName === "IMG") {
      const src = node.getAttribute("src");
      if (src) {
        const matches = src.match(markerPattern);
        if (matches) {
          matches.forEach((marker) => {
            if (marker.startsWith(markerPrefix) && !markerMap.has(marker)) {
              const path = getElementPath(node, root);
              markerMap.set(marker, { element: node, path });
            }
          });
        }
      }
    }
    node = walker.nextNode();
  }
  return markerMap;
}
function buildPageMapping(renderedPageDoc, sourceDoc, markerToSourcePath, config) {
  const renderedPageRoot = renderedPageDoc.querySelector(config.rootSelector);
  const sourceRoot = sourceDoc.querySelector(config.rootSelector);
  const markerToPagePath = /* @__PURE__ */ new Map();
  if (!renderedPageRoot || !sourceRoot) {
    console.warn(`[Page Mapper] Cannot build mapping: missing ${config.rootSelector} elements`);
    return { markerToPagePath };
  }
  if (!markerToSourcePath || markerToSourcePath.size === 0) {
    console.warn("[Page Mapper] No markers registered in markerToSourcePath");
    return { markerToPagePath };
  }
  const renderedPageMarkerMap = buildRenderedPageMarkerMap(renderedPageRoot, renderedPageDoc, config);
  markerToSourcePath.forEach((sourcePath, marker) => {
    const renderedPageMarkerInfo = renderedPageMarkerMap.get(marker);
    if (renderedPageMarkerInfo && renderedPageMarkerInfo.path) {
      markerToPagePath.set(marker, renderedPageMarkerInfo.path);
    }
  });
  return { markerToPagePath };
}
var page_marker_mapper_default = buildPageMapping;

// src/mapper-service.js
function serializePathKey(path) {
  if (!path) return "";
  return path.map((s) => `${s.tag}[${s.index}]`).join(">");
}
var MapperService = class {
  constructor(options = {}) {
    const { sourceDoc, markerToSourcePath, markerToPagePath, config, markedHTML, decoratedHTML } = options;
    this.sourceDoc = sourceDoc;
    this.markerToSourcePath = markerToSourcePath;
    this.markerToPagePath = markerToPagePath;
    this.config = config;
    this._markedHTML = markedHTML;
    this._decoratedHTML = decoratedHTML;
    this.pagePathToMarker = /* @__PURE__ */ new Map();
    for (const [marker, pagePath] of markerToPagePath.entries()) {
      this.pagePathToMarker.set(serializePathKey(pagePath), marker);
    }
  }
  getMarkedHTML() {
    return this._markedHTML;
  }
  getDecoratedHTML() {
    return this._decoratedHTML;
  }
  findSourceElement(pageElement) {
    const doc = pageElement.ownerDocument;
    const pageRoot = doc.querySelector(this.config.rootSelector);
    if (!pageRoot) return null;
    const pagePath = getElementPath(pageElement, pageRoot);
    const marker = this.pagePathToMarker.get(serializePathKey(pagePath));
    if (!marker) return null;
    const sourcePath = this.markerToSourcePath.get(marker);
    if (!sourcePath) return null;
    const sourceRoot = this.sourceDoc.querySelector(this.config.rootSelector);
    if (!sourceRoot) return null;
    return getElementByPath(sourceRoot, sourcePath);
  }
  getSourceDoc() {
    return this.sourceDoc;
  }
  getAllMappedElements(pageDoc = null) {
    const mappedPairs = [];
    const sourceRoot = this.sourceDoc.querySelector(this.config.rootSelector);
    const targetDoc = pageDoc || (typeof document !== "undefined" ? document : null);
    if (!sourceRoot || !targetDoc) return mappedPairs;
    const pageRoot = targetDoc.querySelector(this.config.rootSelector);
    if (!pageRoot) return mappedPairs;
    for (const [marker, sourcePath] of this.markerToSourcePath.entries()) {
      const pagePath = this.markerToPagePath.get(marker);
      if (!pagePath) continue;
      const sourceElement = getElementByPath(sourceRoot, sourcePath);
      if (!sourceElement) continue;
      const pageElement = getElementByPath(pageRoot, pagePath);
      if (!pageElement) continue;
      mappedPairs.push({
        marker,
        source: { element: sourceElement, path: sourcePath },
        page: { element: pageElement, path: pagePath }
      });
    }
    return mappedPairs;
  }
};

// src/config.js
var DEFAULT_CONFIG = {
  rootSelector: "main",
  targetSelectors: ["h1", "h2", "h3", "h4", "h5", "h6", "p", "img", "ul", "ol"],
  timeout: 1e4,
  logPerformance: true,
  markerPrefix: "MARKER_",
  markerIdLength: 8,
  setupContext: null
};
var config_default = DEFAULT_CONFIG;

// src/orchestrator.js
var RENDERERS = {
  "iframe": iframe_page_renderer_default,
  "renderers": decorator_page_renderer_default
};
function logPerformanceMetrics(metrics, elementMappingCount) {
  console.log("[Page Mapper] Performance:", {
    embeddingMs: metrics.embeddingTime.toFixed(2),
    renderingMs: metrics.renderingTime.toFixed(2),
    mappingMs: metrics.mappingTime.toFixed(2),
    totalMs: metrics.totalTime.toFixed(2),
    elementMappingCount
  });
}
async function initializeMapper(sourceHTML, config = {}) {
  const mergedConfig = { ...config_default, ...config };
  const totalStart = performance.now();
  const metrics = {};
  try {
    const embeddingStart = performance.now();
    const { markedHTML, markerToSourcePath, sourceDoc } = source_marker_embedder_default(sourceHTML, mergedConfig);
    metrics.embeddingTime = performance.now() - embeddingStart;
    const { renderMode, renderOptions } = mergedConfig;
    if (!renderMode) {
      throw new Error("[Page Mapper] renderMode is required. Available: " + Object.keys(RENDERERS).join(", "));
    }
    const renderer = RENDERERS[renderMode];
    if (!renderer) {
      throw new Error(`[Page Mapper] Unknown renderMode "${renderMode}". Available: ${Object.keys(RENDERERS).join(", ")}`);
    }
    const renderingStart = performance.now();
    const renderedPageHTML = await renderer(markedHTML, renderOptions || {});
    metrics.renderingTime = performance.now() - renderingStart;
    const renderedPageDoc = new DOMParser().parseFromString(renderedPageHTML, "text/html");
    const mappingStart = performance.now();
    const { markerToPagePath } = page_marker_mapper_default(renderedPageDoc, sourceDoc, markerToSourcePath, mergedConfig);
    metrics.mappingTime = performance.now() - mappingStart;
    metrics.totalTime = performance.now() - totalStart;
    if (mergedConfig.logPerformance) {
      logPerformanceMetrics(metrics, markerToPagePath.size);
    }
    return new MapperService({
      sourceDoc,
      markerToSourcePath,
      markerToPagePath,
      config: mergedConfig,
      markedHTML,
      decoratedHTML: renderedPageHTML
    });
  } catch (error) {
    console.error("[Page Mapper] Initialization failed:", error);
    throw error;
  }
}
var orchestrator_default = initializeMapper;
export {
  config_default as DEFAULT_CONFIG,
  MapperService,
  page_marker_mapper_default as buildPageMapping,
  orchestrator_default as createMapper,
  source_marker_embedder_default as embedSourceMarkers,
  getElementByPath,
  getElementPath,
  orchestrator_default as initializeMapper,
  iframe_page_renderer_default as renderPageFromURL,
  decorator_page_renderer_default as renderPageWithRenderers
};
//# sourceMappingURL=page-mapper.js.map
