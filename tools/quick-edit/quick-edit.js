const hostname = window.location.hostname;
let initialized = false;

import { loadStyle } from '../../scripts/ak.js';
import { loadPage } from '../../scripts/scripts.js';
import { getSchema } from 'https://main--da-live--adobe.aem.live/blocks/edit/prose/schema.js';
import { EditorState, EditorView } from 'https://main--da-live--adobe.aem.live/deps/da-y-wrapper/dist/index.js';
import { showToolbar, hideToolbar, setCurrentEditorView, updateToolbarState, handleToolbarKeydown, positionToolbar } from './toolbar.js';
import { createSimpleKeymap } from './simple-keymap.js';

let remoteUpdate = false;

loadStyle('/tools/quick-edit/quick-edit.css');

const QUICK_EDIT_ID = 'quick-edit-iframe';
const QUICK_EDIT_SRC =
  hostname != "localhost"
    ? "https://main--da-live--adobe.aem.live/drafts/wysiwyg/init?nx=da-fusion"
    : `https://main--da-live--adobe.aem.live/drafts/wysiwyg/init?nx=local&ref=local`;

function pollConnection(action) {
  initialized = false;
  let count = 0;
  const interval = setInterval(() => {
    count += 1;
    if (initialized || count > 20) {
      clearInterval(interval);
      return;
    }
    action?.();
  }, 500);
}

function setupContentEditableListeners(port) {
  const editableElements = document.querySelectorAll('[data-cursor]');
  editableElements.forEach((element) => {
    const dataCursor = parseInt(element.getAttribute('data-cursor'), 10);

    port.postMessage({
      type: 'get-editor',
      cursorOffset: dataCursor,
    });
  });
}

function setupImageDropListeners(port) {
  const images = document.querySelectorAll('main picture img');

  images.forEach((img) => {
    const picture = img.closest('picture');

    img.addEventListener('dragenter', (e) => {
      e.preventDefault();
      e.stopPropagation();
      picture?.classList.add('image-drop-target');
    });

    img.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
    });

    img.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Only remove if we're actually leaving the picture element
      const relatedTarget = e.relatedTarget;
      if (!picture?.contains(relatedTarget)) {
        picture?.classList.remove('image-drop-target');
      }
    });

    img.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      picture?.classList.remove('image-drop-target');

      const file = e.dataTransfer.files[0];
      if (!file?.type.startsWith('image/')) return;

      // Get tracking attributes
      const dataCursor = img.getAttribute('data-cursor');
      const originalSrc = img.src;

      // Show loading state
      picture?.classList.add('image-uploading');

      // Read and send the image to DA editor for upload
      const reader = new FileReader();
      reader.onload = () => {
        port.postMessage({
          type: 'image-replace',
          cursorOffset: dataCursor ? parseInt(dataCursor, 10) : null,
          imageData: reader.result,
          fileName: file.name,
          mimeType: file.type,
          originalSrc,
        });
      };
      reader.onerror = () => {
        picture?.classList.remove('image-uploading');
        console.error('Failed to read image file');
      };
      reader.readAsDataURL(file);
    });
  });
}

function updateImageSrc(originalSrc, newSrc) {
  // First, try to find by the uploading state (most reliable)
  let picture = document.querySelector('main picture.image-uploading');
  let targetImg = picture?.querySelector('img');

  // If not found by uploading state, try to match by src
  if (!targetImg) {
    const images = document.querySelectorAll('main picture img');
    
    // Extract pathname from originalSrc for comparison
    let originalPath = originalSrc;
    try {
      const originalUrl = new URL(originalSrc);
      originalPath = originalUrl.pathname;
    } catch {
      // originalSrc might be a relative path
    }

    images.forEach((img) => {
      // Compare by full src
      if (img.src === originalSrc) {
        targetImg = img;
        return;
      }
      // Compare by pathname only (ignoring query params)
      try {
        const imgUrl = new URL(img.src);
        if (imgUrl.pathname === originalPath || img.src.includes(originalPath)) {
          targetImg = img;
        }
      } catch {
        // Fallback to simple includes check
        if (img.src.includes(originalSrc) || originalSrc.includes(img.src)) {
          targetImg = img;
        }
      }
    });

    picture = targetImg?.closest('picture');
  }

  if (!targetImg) {
    console.warn('Could not find image to update:', originalSrc);
    return;
  }

  picture?.classList.remove('image-uploading');

  // Update the img src
  targetImg.src = newSrc;

  // Update all source elements in the picture
  if (picture) {
    const newUrl = new URL(newSrc, window.location.href);
    const basePath = `${newUrl.origin}${newUrl.pathname}`;

    picture.querySelectorAll('source').forEach((source) => {
      const srcset = source.getAttribute('srcset');
      if (srcset) {
        // Extract width and format params from existing srcset
        try {
          const existingUrl = new URL(srcset, window.location.href);
          const width = existingUrl.searchParams.get('width');
          const format = existingUrl.searchParams.get('format');
          const optimize = existingUrl.searchParams.get('optimize');

          let newSrcset = basePath;
          const params = [];
          if (width) params.push(`width=${width}`);
          if (format) params.push(`format=${format}`);
          if (optimize) params.push(`optimize=${optimize}`);
          if (params.length) newSrcset += `?${params.join('&')}`;

          source.setAttribute('srcset', newSrcset);
        } catch {
          // If URL parsing fails, just use the new basePath
          source.setAttribute('srcset', basePath);
        }
      }
    });
  }
}

function updateInstrumentation(lengthDiff, offset) {
  const editableElements = document.querySelectorAll('[data-cursor]');
  editableElements.forEach((element) => {
    const cursorValue = parseInt(element.getAttribute('data-cursor'), 10);
    if (cursorValue > offset) {
      const newCursorValue = cursorValue + lengthDiff;
      element.setAttribute('data-cursor', newCursorValue);
    }
    // update lengths where they're saved
    if (element.getAttribute('data-initial-length')) {
      element.setAttribute('data-initial-length', element.textContent.length);
    }
  });
}

function setRemoteCursors() {
  document.querySelectorAll('.remote-cursor-indicator').forEach((element) => {
    element.classList.remove('remote-cursor-indicator');
  });

  const remoteCursorElements = document.querySelectorAll('[data-cursor-remote]');
  remoteCursorElements.forEach((element) => {
    element.classList.add('remote-cursor-indicator');
    const color = element.getAttribute('data-cursor-remote-color');
    element.style.outlineColor = color;
    element.style.setProperty('--cursor-remote-color', color);
  });
}

function createProsemirrorEditor(cursorOffset, state, port1) {
  const existingEditorParent = document.querySelector(`.prosemirror-editor[data-cursor="${cursorOffset}"]`);
  if (existingEditorParent) {
    const editorEl = existingEditorParent.view;
    if (editorEl) {
      // Editor already exists, update it with a transaction
      const view = editorEl;
      const schema = view.state.schema;
      const node = schema.nodeFromJSON(state);
      
      // Create transaction to replace the root node (first child of doc)
      const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, node);
      remoteUpdate = true;
      view.dispatch(tr);
      remoteUpdate = false;
      return;
    }
  }

  const schema = getSchema();

  const node = schema.nodeFromJSON(state);

  const doc = schema.node('doc', null, [node]);

  const editorState = EditorState.create({
    doc,
    schema,
    plugins: [createSimpleKeymap()],
  });

  const editorParent = document.createElement('div');
  editorParent.setAttribute('data-cursor', cursorOffset);
  editorParent.classList.add('prosemirror-editor');

  const element = document.querySelector(`[data-cursor="${cursorOffset}"]`);

  if (!element) {
    port1.postMessage({
      type: 'reload',
    });
    return;
  }
  if (element.getAttribute('data-cursor-remote')) {
    editorParent.setAttribute('data-cursor-remote', element.getAttribute('data-cursor-remote'));
    editorParent.setAttribute('data-cursor-remote-color', element.getAttribute('data-cursor-remote-color'));
  }

  const editorView = new EditorView(
    editorParent, { 
      state: editorState,
      handleDOMEvents: {
        focus: (view, event) => {
          setCurrentEditorView(view);
          showToolbar();
          return false;
        },
        blur: (view, event) => {
          hideToolbar();
          setCurrentEditorView(null);
          port1.postMessage({
            type: 'cursor-move',
          });
          return false; // Let other handlers run
        },
        keydown: (view, event) => {
          return handleToolbarKeydown(event);
        }
      },
      dispatchTransaction: (tr) => {
        const numChanges = tr.steps.length;
        const currentCursorOffset = parseInt(editorParent.getAttribute('data-cursor'));
        const oldLength = editorView.state.doc.firstChild.nodeSize;
        const oldSelection = editorView.state.selection.from;
        const newState = editorView.state.apply(tr);
        editorView.updateState(newState);
        updateInstrumentation(newState.doc.firstChild.nodeSize - oldLength, currentCursorOffset);

        if (remoteUpdate) { return; }
        
        if (numChanges > 0) {
          const editedEl = newState.doc.firstChild;
          port1.postMessage({
            type: 'node-update',
            node: editedEl.toJSON(),
            cursorOffset: currentCursorOffset,
          });
        }

        // Check if selection changed
        const newSelection = newState.selection.from;
        if (oldSelection !== newSelection) {
          port1.postMessage({
            type: 'cursor-move',
            cursorOffset: currentCursorOffset - 1,
            textCursorOffset: newSelection,
          });
        }
        
        // Update toolbar button states and position
        updateToolbarState();
        positionToolbar();
      }
    });
  element.replaceWith(editorParent);
  editorParent.view = editorView;
  
  setRemoteCursors();
}

function setupCloseButton() {
  const button = document.createElement('button');
  button.className = 'quick-edit-close';
  button.title = 'Close Quick Edit';
  
  const icon = document.createElement('i');
  icon.className = 'icon-close';
  button.appendChild(icon);
  
  button.addEventListener('click', () => {
    window.location.reload();
  });
  document.body.appendChild(button);
}

function handleLoad({ target, config, location }) {
  const CHANNEL = new MessageChannel();
  const { port1, port2 } = CHANNEL;

  target.contentWindow.postMessage({ init: config, location }, "*", [port2]);

  port1.onmessage = async (e) => {
    initialized = true;

    if (e.data.set && e.data.set === 'body') {
      const doc = new DOMParser().parseFromString(e.data.body, 'text/html');
      document.body.innerHTML = doc.body.innerHTML;
      await loadPage();
      setupContentEditableListeners(port1);
      setupImageDropListeners(port1);
      setupCloseButton();
    }

    if (e.data.set === 'editor') {
      const { editor, cursorOffset } = e.data;
      createProsemirrorEditor(cursorOffset, editor, port1);
    }

    if (e.data.set === 'cursors') {
      const doc = new DOMParser().parseFromString(e.data.body, 'text/html');
      
      // Remove all existing data-cursor attributes from current document
      const currentElements = document.querySelectorAll('[data-cursor-remote]');
      currentElements.forEach((element) => {
        element.removeAttribute('data-cursor-remote');
        element.removeAttribute('data-cursor-remote-color');
      });
      
      // Get all elements with data-cursor from the parsed doc
      const parsedElements = doc.querySelectorAll('[data-cursor-remote]');
      
      // For each element in parsed doc, find matching element in current doc by data-cursor
      parsedElements.forEach((parsedElement) => {
        const remoteCursorValue = parsedElement.getAttribute('data-cursor-remote');
        const remoteCursorColor = parsedElement.getAttribute('data-cursor-remote-color');
        const dataCursor = parsedElement.getAttribute('data-cursor');
        
        // Find element in current document with the same data-cursor value
        if (dataCursor) {
          const matchingElement = document.querySelector(`[data-cursor="${dataCursor}"]`);
          if (matchingElement) {
            matchingElement.setAttribute('data-cursor-remote', remoteCursorValue);
            matchingElement.setAttribute('data-cursor-remote-color', remoteCursorColor);
          }
        }
      });
      
      setRemoteCursors();
    }

    if (e.data.set === 'image') {
      const { newSrc, originalSrc } = e.data;
      updateImageSrc(originalSrc, newSrc);
    }

    if (e.data.set === 'image-error') {
      // Remove loading state on error
      const images = document.querySelectorAll('main picture.image-uploading');
      images.forEach((picture) => {
        picture.classList.remove('image-uploading');
      });
      console.error('Image upload failed:', e.data.error);
    }
  };
}

export default async function loadQuickEdit({ detail: payload }) {
  if (document.getElementById(QUICK_EDIT_ID)) return;

  const iframe = document.createElement("iframe");
  iframe.id = QUICK_EDIT_ID;
  iframe.src = QUICK_EDIT_SRC;
  iframe.allow = "local-network-access *; clipboard-write *";

  pollConnection(() => {
    handleLoad({ target: iframe, config: payload.config, location: payload.location });
  });
  document.documentElement.append(iframe);
  iframe.id = 'quick-edit-iframe';
  iframe.style.visibility = 'hidden';
}
