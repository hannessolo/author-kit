const hostname = window.location.hostname;
let initialized = false;

import { loadPage } from '../../scripts/scripts.js';
import { saveCursorPosition, restoreCursorPosition } from './utils.js';

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

function getCursorPosition(element) {
  const selection = window.getSelection();
  if (!selection.rangeCount) return 0;
  
  const range = selection.getRangeAt(0);
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(element);
  preCaretRange.setEnd(range.endContainer, range.endOffset);
  
  return preCaretRange.toString().length;
}

function handleInteraction(e, port) {
  const dataCursor = e.target.getAttribute('data-cursor');
  // Send cursor position when user clicks into the element
  if (port && dataCursor) {
    const textCursorOffset = getCursorPosition(e.target);
    port.postMessage({
      type: 'cursor-move',
      cursorOffset: parseInt(dataCursor, 10),
      textCursorOffset,
    });
  }
  // save the length before we started editing it
  e.target.setAttribute('data-initial-length', e.target.textContent.length);
}

function setupContentEditableListeners(port) {
  const editableElements = document.querySelectorAll('[contenteditable="true"]');
  editableElements.forEach((element) => {
    element.addEventListener('click', (e) => {
      handleInteraction(e, port);
    });

    element.addEventListener('keyup', (e) => {
      handleInteraction(e, port);
    });

    element.addEventListener('blur', (e) => {
      port.postMessage({
        type: 'cursor-move',
      });
    });

    element.addEventListener('input', (e) => {
      const newText = e.target.textContent;
      const dataCursor = e.target.getAttribute('data-cursor');
      // Send the update back to the editor
      if (port && dataCursor) {
        port.postMessage({
          type: 'content-update',
          newText,
          cursorOffset: parseInt(dataCursor, 10),
        });
      }
    });
  });
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

function getCssPathFromMain(element) {
  const path = [];
  let current = element;
  
  // Traverse up to the closest main element
  while (current && current.tagName && current.tagName.toLowerCase() !== 'main') {
    const parent = current.parentElement;
    if (!parent) break;
    
    const siblings = Array.from(parent.children);
    const index = siblings.indexOf(current);
    const tagName = current.tagName.toLowerCase();
    
    path.unshift(`${tagName}:nth-child(${index + 1})`);
    current = parent;
  }
  
  if (current && current.tagName && current.tagName.toLowerCase() === 'main') {
    path.unshift('main');
  }
  
  return path.join(' > ');
}

function setRemoteCursors() {
  // Add CSS rule for ::before pseudo-element if not already added
  if (!document.getElementById('remote-cursor-styles')) {
    const style = document.createElement('style');
    style.id = 'remote-cursor-styles';
    style.textContent = `
      .remote-cursor-indicator::before {
        content: attr(data-cursor-remote);
        position: absolute;
        background: red;
        color: white;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 12px;
        font-weight: bold;
        transform: translateY(-100%);
        margin-top: -4px;
        white-space: nowrap;
        z-index: 1000;
      }
      .remote-cursor-indicator {
        position: relative;
        border: 2px solid red;
      }
    `;
    document.head.appendChild(style);
  }

  document.querySelectorAll('.remote-cursor-indicator').forEach((element) => {
    element.classList.remove('remote-cursor-indicator');
  });

  const remoteCursorElements = document.querySelectorAll('[data-cursor-remote]');
  remoteCursorElements.forEach((element) => {
    element.classList.add('remote-cursor-indicator');
  });
}

function handleLoad({ target, config, location }) {
  const CHANNEL = new MessageChannel();
  const { port1, port2 } = CHANNEL;

  target.contentWindow.postMessage({ init: config, location }, "*", [port2]);

  port1.onmessage = async (e) => {
    initialized = true;
    console.log("quick-edit message received", e.data);

    if (e.data.set && e.data.set === 'body') {
      const doc = new DOMParser().parseFromString(e.data.body, 'text/html');
      document.body.innerHTML = doc.body.innerHTML;
      await loadPage();
      setRemoteCursors();
      setupContentEditableListeners(port1);
    }

    if (e.data.set === 'text') {
      const { text, cursorOffset } = e.data;
      const element = document.querySelector(`[data-cursor="${cursorOffset - 1}"]`);
      if (element) {
        // if we're editing this element ourselves, we need to use the stored length instead of the current, post edit length
        const oldLength = parseInt(element.getAttribute('data-initial-length'), 10) || element.textContent.length;
        
        // Save cursor position if user is currently editing this element
        const savedCursorPosition = saveCursorPosition(element);
        
        element.textContent = text;
        
        // Restore cursor position if it was saved
        if (savedCursorPosition !== null) {
          restoreCursorPosition(element, savedCursorPosition);
        }
        
        const lengthDiff = text.length - oldLength;
        updateInstrumentation(lengthDiff, cursorOffset - 1);
      } else {
        // request a reload, since it's probably a new paragraph element
        port1.postMessage({
          type: 'reload',
        });
      }
    }

    if (e.data.set === 'cursors') {
      const doc = new DOMParser().parseFromString(e.data.body, 'text/html');
      
      // Remove all existing data-cursor attributes from current document
      const currentElements = document.querySelectorAll('[data-cursor-remote]');
      currentElements.forEach((element) => {
        element.removeAttribute('data-cursor-remote');
      });
      
      // Get all elements with data-cursor from the parsed doc
      const parsedElements = doc.querySelectorAll('[data-cursor-remote]');
      
      // For each element in parsed doc, find matching element in current doc by data-cursor
      parsedElements.forEach((parsedElement) => {
        const remoteCursorValue = parsedElement.getAttribute('data-cursor-remote');
        const dataCursor = parsedElement.getAttribute('data-cursor');
        
        // Find element in current document with the same data-cursor value
        if (dataCursor) {
          const matchingElement = document.querySelector(`[data-cursor="${dataCursor}"]`);
          if (matchingElement) {
            matchingElement.setAttribute('data-cursor-remote', remoteCursorValue);
          }
        }
      });
      
      setRemoteCursors();
    }
  };
}

export default async function loadQuickEdit({ detail: payload }) {
  if (document.getElementById(QUICK_EDIT_ID)) return;

  console.log("quick-edit", payload);
  const iframe = document.createElement("iframe");
  iframe.id = QUICK_EDIT_ID;
  iframe.src = QUICK_EDIT_SRC;
  iframe.allow = "local-network-access *; clipboard-write *";

  pollConnection(() => {
    handleLoad({ target: iframe, config: payload.config, location: payload.location });
  });
  document.documentElement.append(iframe);
  iframe.id = 'quick-edit-iframe';
  // iframe.style.visibility = 'hidden';
}
