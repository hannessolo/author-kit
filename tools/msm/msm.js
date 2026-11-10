import { comparePages, crawlPages, getSiteContext, promotionPrompt } from './utils.js';

function formatTime(time) {
  if (time === null) return 'Unknown';
  return new Date(time).toLocaleString();
}

export async function createApp(root, { context, actions, capabilities }) {
  const site = getSiteContext(context);
  const refresh = root.querySelector('#refresh');
  const status = root.querySelector('#status');
  const pages = root.querySelector('#pages');
  let loading = false;
  let disposed = false;
  root.querySelector('#site').textContent = `${site.org}/${site.repo}`;
  const canPromote = typeof actions.setPrompt === 'function';

  function render(rows) {
    pages.replaceChildren();
    rows.forEach((row) => {
      const tr = document.createElement('tr');
      tr.className = row.status;
      const labels = {
        current: 'Up to date',
        outdated: 'US is newer',
        unknown: 'Missing modification date',
        missing: 'Missing in CA',
      };
      [row.path, formatTime(row.usTime), row.ca ? formatTime(row.caTime) : 'Not created', labels[row.status]]
        .forEach((value) => {
          const td = document.createElement('td');
          td.textContent = value;
          tr.append(td);
        });
      const action = document.createElement('td');
      if (row.status === 'outdated' || row.status === 'missing') {
        const request = row.status === 'missing' ? 'CA copy' : 'Promotion';
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = row.status === 'missing' ? 'Create CA copy' : 'Promote change';
        button.disabled = !canPromote;
        if (!canPromote) button.title = 'This DA host does not support chat prompts.';
        button.addEventListener('click', () => {
          try {
            actions.setPrompt(promotionPrompt(site, row), { autoSend: true });
            status.textContent = `${request} requested for ${row.path}. Check chat for progress; refresh to verify the saved CA page.`;
          } catch (error) {
            status.textContent = `Could not request ${request.toLowerCase()}: ${error.message}`;
          }
        });
        action.append(button);
      }
      tr.append(action);
      pages.append(tr);
    });
  }

  async function load() {
    if (loading || disposed) return;
    loading = true;
    refresh.disabled = true;
    pages.replaceChildren();
    root.setAttribute('aria-busy', 'true');
    status.textContent = 'Scanning /us and /ca, including subdirectories...';
    try {
      const [us, ca] = await Promise.all([
        crawlPages(site, 'us', actions.daFetch),
        crawlPages(site, 'ca', actions.daFetch),
      ]);
      if (disposed) return;
      const rows = comparePages(us, ca);
      render(rows);
      const outdated = rows.filter((row) => row.status === 'outdated').length;
      const unknown = rows.filter((row) => row.status === 'unknown').length;
      const missing = rows.filter((row) => row.status === 'missing').length;
      status.textContent = rows.length
        ? `${rows.length} US pages. ${missing} missing in CA. ${outdated} with newer US changes. ${unknown} with unknown dates.`
        : 'No HTML pages found under /us.';
      if (!canPromote) status.textContent += ' This DA host does not support chat prompts.';
    } catch (error) {
      if (!disposed) status.textContent = `Scan failed: ${error.message}`;
    } finally {
      loading = false;
      refresh.disabled = false;
      root.removeAttribute('aria-busy');
    }
  }

  refresh.addEventListener('click', load);
  let unsubscribe;
  if (capabilities?.chatTurnCompleted === 1
    && typeof actions.subscribeChatTurnCompleted === 'function') {
    unsubscribe = actions.subscribeChatTurnCompleted(() => load());
  }
  const dispose = () => {
    disposed = true;
    unsubscribe?.();
    refresh.removeEventListener('click', load);
    window.removeEventListener('pagehide', dispose);
  };
  window.addEventListener('pagehide', dispose, { once: true });
  await load();
  return dispose;
}

async function init(root) {
  try {
    if (window.parent === window) throw new Error('Open MSM inside the DA fullscreen shell.');
    const branch = new URLSearchParams(window.location.search).get('nx');
    let origin = 'https://da.live';
    if (branch === 'local') origin = 'http://localhost:6456';
    else if (branch) origin = `https://${branch}--da-nx--adobe.aem.live`;
    const { default: sdk } = await import(`${origin}/nx/utils/sdk.js`);
    await createApp(root, await sdk);
  } catch (error) {
    root.querySelector('#status').textContent = error.message;
  }
}

const root = document.querySelector('#msm');
if (root) init(root);
