// Map to track data-cursor attribute changes: oldValue -> newValue
let cursorChangeMap = new Map();

function syncAttributes(bEl, aEl) {
  // Remove attributes not in a
  for (const attr of Array.from(bEl.attributes)) {
    if (!aEl.hasAttribute(attr.name)) {
      bEl.removeAttribute(attr.name)
    }
  }

  // Add / update attributes from a
  for (const attr of Array.from(aEl.attributes)) {
    if (bEl.getAttribute(attr.name) !== attr.value) {
      // Track data-cursor changes
      if (attr.name === 'data-cursor') {
        const oldValue = bEl.getAttribute(attr.name);
        if (oldValue !== null) {
          cursorChangeMap.set(oldValue, attr.value);
        }
      }
      
      bEl.setAttribute(attr.name, attr.value)
      console.log('setAttribute', attr.name, attr.value);
    }
  }
}

function attributesEqual(a, b) {
  if (a.attributes.length !== b.attributes.length) return false
  for (const attr of Array.from(a.attributes)) {
    if (b.getAttribute(attr.name) !== attr.value) return false
  }
  return true
}

function canUpdate(a, b) {
  if (!sameNodeType(a, b)) return false
  return true
}


function nodesEqual(a, b) {
  if (!sameNodeType(a, b)) return false

  if (a.nodeType === Node.TEXT_NODE) {
    return a.nodeValue === b.nodeValue
  }

  const aEl = a
  const bEl = b

  if (!attributesEqual(aEl, bEl)) return false

  return true
}

function findMatch(
  aNode,
  bChildren,
  start,
  maxLookahead = 5
) {
  for (let i = start; i < Math.min(start + maxLookahead, bChildren.length); i++) {
    if (nodesEqual(aNode, bChildren[i])) {
      return i
    }
  }
  return -1
}

function sameNodeType(a, b) {
  if (a.nodeType !== b.nodeType) return false

  if (a.nodeType === Node.ELEMENT_NODE) {
    return (a).tagName === (b).tagName
  }

  return true
}

function reconcileChildren(aParent, bParent) {
  const aChildren = Array.from(aParent.childNodes)
  const bChildren = Array.from(bParent.childNodes)

  let i = 0 // index in aChildren
  let j = 0 // index in bChildren

  while (i < aChildren.length) {
    const aChild = aChildren[i]
    const bChild = bChildren[j]

    // Strategy 1: exact match (with lookahead)
    const matchIndex = findMatch(aChild, bChildren, j)

    if (matchIndex === j) {
      reconcile(aChild, bChild)
      i++; j++
      continue
    }

    if (matchIndex > j) {
      const nodeToMove = bChildren[matchIndex]
      bParent.insertBefore(nodeToMove, bChild || null)
      bChildren.splice(matchIndex, 1)
      bChildren.splice(j, 0, nodeToMove)

      reconcile(aChild, nodeToMove)
      i++; j++
      continue
    }

    // Strategy 2: update in place
    if (bChild && canUpdate(aChild, bChild)) {
      reconcile(aChild, bChild)
      i++; j++
      continue
    }

    // Strategy 3: insert new
    const newNode = aChild.cloneNode(false)
    bParent.insertBefore(newNode, bChild || null)
    bChildren.splice(j, 0, newNode)

    if (aChild.nodeType === Node.ELEMENT_NODE) {
      reconcileChildren(aChild, newNode)
    } else if (aChild.nodeType === Node.TEXT_NODE) {
      newNode.nodeValue = aChild.nodeValue
    }

    i++; j++
  }

  // Cleanup: remove extra b children
  while (bChildren.length > aChildren.length) {
    const node = bChildren.pop()
    bParent.removeChild(node)
  }
}


export function reconcile(aNode, bNode) {
  // Fast path
  if (aNode.isEqualNode(bNode)) return

  // Node type mismatch → replace
  if (!sameNodeType(aNode, bNode)) {
    bNode.replaceWith(aNode.cloneNode(true))
    return
  }

  // Text node
  if (aNode.nodeType === Node.TEXT_NODE) {
    if (bNode.nodeValue !== aNode.nodeValue) {
      bNode.nodeValue = aNode.nodeValue
    }
    return
  }

  // Element node
  const aEl = aNode
  const bEl = bNode

  syncAttributes(bEl, aEl)
  reconcileChildren(aEl, bEl)
}

function fixStyles(iframeDoc) {
  iframeDoc.head.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
    const url = new URL(link.href);
    const path = url.pathname;
    if (!document.head.querySelector(`link[href="${path}"]`)) {
      document.head.appendChild(link.cloneNode(true));
    }
  });
}

export function startReconcile(textBody, callback) {
  const iframe = document.getElementById('reconcile-iframe');
  const iframeDoc = iframe.contentDocument;

  console.log(textBody)

  const fullHtml = `<html><head>
    <script type="module">
      import { loadPage } from '/scripts/scripts.js';
      loadPage().then(() => {
        console.log('loadPage');
        const editableElements = document.body.querySelectorAll('[data-cursor]');
          editableElements.forEach(element => {
          const editorParent = document.createElement('div');
          editorParent.setAttribute('data-cursor', element.getAttribute('data-cursor'));
          editorParent.classList.add('prosemirror-editor');
          const editorMiddle = document.createElement('div');
          editorMiddle.classList.add('ProseMirror');
          editorMiddle.setAttribute('contenteditable', 'true');
          editorMiddle.setAttribute('translate', 'no');
          editorParent.appendChild(editorMiddle);
          element.parentElement.insertBefore(editorParent, element);
          editorMiddle.appendChild(element);
          element.removeAttribute('data-cursor');
        });
      });
  </script>
  </head><body>${textBody}</body></html>`;

  iframeDoc.open();
  iframeDoc.write(fullHtml);
  iframeDoc.close();

  setTimeout(() => {
    // Reset the cursor change map before reconciliation
    cursorChangeMap.clear();
    
    reconcileChildren(iframeDoc.body.querySelector('main'), document.body.querySelector('main'));
    fixStyles(iframeDoc);
    
    // Pass the cursor change map to the callback
    console.log('cursorChangeMap', cursorChangeMap);
    callback(cursorChangeMap);
  }, 2000);
}

let cooldownTimeout = null;
let pendingCall = false;
let pendingArgs = null;
let pendingCallback = null;
export function startReconcileDebounced(textBody, callback) {
  if (!cooldownTimeout) {
    // Not in cooldown - execute immediately
    startReconcile(textBody, callback);
    
    // Start cooldown period
    cooldownTimeout = setTimeout(() => {
      // Cooldown expired
      cooldownTimeout = null;
      
      // If there was a pending call, execute it now
      if (pendingCall) {
        pendingCall = false;
        const args = pendingArgs;
        const cb = pendingCallback;
        pendingArgs = null;
        pendingCallback = null;
        startReconcileDebounced(args, cb);
      }
    }, 2000);
  } else {
    // In cooldown - mark that we need to run again
    pendingCall = true;
    pendingArgs = textBody;
    pendingCallback = callback;
  }
}

export function initializeReconcile() {
  const iframe = document.createElement('iframe');
  iframe.id = 'reconcile-iframe';
  // iframe.style.display = 'none';
  iframe.src = window.location.href;
  document.documentElement.prepend(iframe);
}