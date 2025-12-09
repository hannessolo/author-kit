const hostname = window.location.hostname;
let initialized = false;

import { loadPage } from '../../scripts/scripts.js';

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

function setupContentEditableListeners(port) {
  const editableElements = document.querySelectorAll('[contenteditable="true"]');
  editableElements.forEach((element) => {
    element.addEventListener('click', (e) => {
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
    });

    element.addEventListener('input', (e) => {
      const newText = e.target.textContent;
      const dataCursor = e.target.getAttribute('data-cursor');
      // Send the update back to the editor
      if (port && dataCursor) {
        console.log('sending')
        port.postMessage({
          type: 'content-update',
          newText,
          cursorOffset: parseInt(dataCursor, 10),
        });
      }
    });
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
      setupContentEditableListeners(port1);
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
