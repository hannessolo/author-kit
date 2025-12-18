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
      bEl.setAttribute(attr.name, attr.value)
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
      loadPage();
    </script>
  </head><body>${textBody}</body></html>`;

  // iframe.style.display = 'none';
  iframeDoc.open();
  iframeDoc.write(fullHtml);
  iframeDoc.close();

  setTimeout(() => {
    reconcileChildren(iframeDoc.body.querySelector('main'), document.body.querySelector('main'));
    fixStyles(iframeDoc);
    callback();
  }, 2000);
}

let cooldownTimeout = null;
let pendingCall = false;
let pendingArgs = null;
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
        pendingArgs = null;
        startReconcileDebounced(args, callback);
      }
    }, 2000);
  } else {
    // In cooldown - mark that we need to run again
    pendingCall = true;
    pendingArgs = textBody;
  }
}

export function initializeReconcile() {
  const iframe = document.createElement('iframe');
  iframe.id = 'reconcile-iframe';
  iframe.style.display = 'none';
  iframe.src = window.location.href;
  document.documentElement.prepend(iframe);
}