import { expect } from '@esm-bundle/chai';
import sinon from 'sinon';
import { createApp } from '../../tools/msm/msm.js';
import { comparePages, crawlPages, getSiteContext } from '../../tools/msm/utils.js';

const site = { org: 'test', repo: 'site', daOrigin: 'https://admin.da.live' };
const context = { ...site, hash: '' };
const page = (region, name, lastModified) => ({
  name: name.split('/').pop(),
  path: `/test/site/${region}/${name}.html`,
  ext: 'html',
  lastModified,
});
const response = (children, token) => new Response(JSON.stringify(children), { headers: token ? { 'da-continuation-token': token } : {} });

describe('MSM', () => {
  let root;
  let dispose;

  afterEach(() => {
    dispose?.();
    dispose = undefined;
    root?.remove();
    sinon.restore();
  });

  it('uses the target site hash, falling back to the hosting site', () => {
    expect(getSiteContext(context)).to.deep.equal(site);
    expect(getSiteContext({ ...context, hash: '#/other/target/us/page' })).to.deep.equal({ org: 'other', repo: 'target', daOrigin: site.daOrigin });
    expect(() => getSiteContext({})).to.throw('organization and site');
  });

  it('crawls nested HTML pages and all list continuations, ignoring assets and other roots', async () => {
    const fetcher = sinon.stub();
    fetcher.onCall(0).resolves(response([
      page('us', 'home', 100),
      { name: 'nested', path: '/test/site/us/nested' },
      { name: 'image', ext: 'png', path: '/test/site/us/image.png' },
      { name: 'other', path: '/test/site/ca/other' },
      { name: '', path: '/test/site/us/' },
    ], 'next'));
    fetcher.onCall(1).resolves(response([page('us', 'second', 200)]));
    fetcher.onCall(2).resolves(response([page('us', 'nested/page', 300)]));
    const pages = await crawlPages(site, 'us', fetcher);
    expect([...pages.keys()]).to.deep.equal(['/home.html', '/second.html', '/nested/page.html']);
    expect(fetcher.getCall(1).args).to.deep.equal([
      `${site.daOrigin}/list/test/site/us`,
      { headers: { 'da-continuation-token': 'next' } },
    ]);
    expect(fetcher.getCall(2).args[0]).to.equal(`${site.daOrigin}/list/test/site/us/nested`);
  });

  it('rejects inaccessible subdirectories instead of returning a partial scan', async () => {
    const fetcher = sinon.stub();
    fetcher.onCall(0).resolves(response([{ name: 'private', path: '/test/site/us/private' }]));
    fetcher.onCall(1).resolves(new Response(null, { status: 403 }));
    try {
      await crawlPages(site, 'us', fetcher);
      expect.fail('Expected the crawl to reject');
    } catch (error) {
      expect(error.message).to.include('/us/private (403)');
    }
  });

  it('treats a nonexistent CA root as empty but still rejects missing nested folders', async () => {
    const fetcher = sinon.stub().callsFake(async () => new Response(null, { status: 404 }));
    expect((await crawlPages(site, 'ca', fetcher)).size).to.equal(0);
    fetcher.onCall(1).resolves(response([{ name: 'nested', path: '/test/site/ca/nested' }]));
    try {
      await crawlPages(site, 'ca', fetcher);
      expect.fail('Expected a missing nested directory to reject');
    } catch (error) {
      expect(error.message).to.include('/ca/nested (404)');
    }
  });

  it('matches exact relative paths, compares dates, and leaves missing dates unknown', () => {
    const us = new Map([
      ['/earlier.html', page('us', 'earlier', 100)],
      ['/equal.html', page('us', 'equal', 200)],
      ['/later.html', page('us', 'later', '2026-02-02T00:00:00Z')],
      ['/nested/page.html', page('us', 'nested/page', '300')],
      ['/missing.html', page('us', 'missing', undefined)],
      ['/invalid.html', page('us', 'invalid', 'not-a-date')],
      ['/only-us.html', page('us', 'only-us', 100)],
      ['/different/page.html', page('us', 'different/page', 100)],
      ['/no-date.html', page('us', 'no-date')],
    ]);
    const ca = new Map([
      ['/earlier.html', page('ca', 'earlier', 200)],
      ['/equal.html', page('ca', 'equal', 200)],
      ['/later.html', page('ca', 'later', '2026-02-01T00:00:00Z')],
      ['/nested/page.html', page('ca', 'nested/page', 200)],
      ['/missing.html', page('ca', 'missing', 200)],
      ['/invalid.html', page('ca', 'invalid', 200)],
      ['/only-ca.html', page('ca', 'only-ca', 100)],
      ['/another/page.html', page('ca', 'another/page', 100)],
    ]);
    const rows = comparePages(us, ca);
    expect(rows.map(({ path, status }) => [path, status])).to.deep.equal([
      ['/different/page.html', 'missing'],
      ['/earlier.html', 'current'],
      ['/equal.html', 'current'],
      ['/invalid.html', 'unknown'],
      ['/later.html', 'outdated'],
      ['/missing.html', 'unknown'],
      ['/nested/page.html', 'outdated'],
      ['/no-date.html', 'missing'],
      ['/only-us.html', 'missing'],
    ]);
  });

  async function mount({ us, ca, chat = true, notifications = true } = {}) {
    const markup = await (await fetch('/tools/msm/msm.html')).text();
    root = new DOMParser().parseFromString(markup, 'text/html').querySelector('main');
    document.body.append(root);
    const actions = {
      daFetch: sinon.stub().callsFake(async (url) => response(url.endsWith('/us') ? us : ca)),
      ...(chat ? { setPrompt: sinon.spy() } : {}),
      subscribeChatTurnCompleted: sinon.stub().returns(sinon.spy()),
    };
    dispose = await createApp(root, {
      context,
      actions,
      capabilities: notifications ? { chatTurnCompleted: 1 } : {},
    });
    return actions;
  }

  it('renders green current rows and sends US-to-CA prompts only for newer US pages', async () => {
    const actions = await mount({
      us: [page('us', 'current', 100), page('us', 'newer', 300), page('us', 'unknown')],
      ca: [page('ca', 'current', 200), page('ca', 'newer', 200), page('ca', 'unknown')],
    });
    expect(root.querySelectorAll('tr.current')).to.have.length(1);
    expect(root.querySelectorAll('tr.unknown')).to.have.length(1);
    const buttons = root.querySelectorAll('#pages button');
    expect(buttons).to.have.length(1);
    buttons[0].click();
    const [prompt, options] = actions.setPrompt.firstCall.args;
    expect(prompt).to.include('Source US page: "/test/site/us/newer.html"');
    expect(prompt).to.include('Target CA page: "/test/site/ca/newer.html"');
    expect(prompt).to.include('do not modify the US page');
    expect(options).to.deep.equal({ autoSend: true });
    expect(root.querySelector('#status').textContent).to.include('Promotion requested');
    expect(root.querySelector('tr.outdated')).not.to.equal(null);
  });

  it('rescans after chat finishes and unsubscribes when disposed', async () => {
    const us = [page('us', 'page', 300)];
    const ca = [page('ca', 'page', 200)];
    const actions = await mount({ us, ca });
    ca[0].lastModified = 400;
    await actions.subscribeChatTurnCompleted.firstCall.args[0]({ status: 'completed' });
    expect(root.querySelectorAll('tr.current')).to.have.length(1);
    expect(root.querySelectorAll('#pages button')).to.have.length(0);
    dispose();
    dispose = undefined;
    expect(actions.subscribeChatTurnCompleted.firstCall.returnValue.calledOnce).to.equal(true);
  });

  it('requests a regionally adapted CA draft for US-only pages and detects creation on refresh', async () => {
    const ca = [];
    const actions = await mount({ us: [page('us', 'nested/new', 300)], ca });
    const row = root.querySelector('tr.missing');
    expect(row.children[2].textContent).to.equal('Not created');
    expect(root.querySelector('#status').textContent).to.include('1 missing in CA');
    const button = row.querySelector('button');
    expect(button.textContent).to.equal('Create CA copy');
    button.click();
    const [prompt, options] = actions.setPrompt.firstCall.args;
    expect(prompt).to.include('Source US page: "/test/site/us/nested/new.html"');
    expect(prompt).to.include('Target CA page: "/test/site/ca/nested/new.html"');
    expect(prompt).to.include('Adapt the content for Canada');
    expect(prompt).to.include('do not overwrite it');
    expect(prompt).to.include('do not modify the US page');
    expect(prompt).to.include('Save the new CA page as a draft. Do not publish it.');
    expect(options).to.deep.equal({ autoSend: true });
    expect(root.querySelector('#status').textContent).to.include('CA copy requested');
    expect(root.querySelector('tr.missing')).not.to.equal(null);
    ca.push(page('ca', 'nested/new', 400));
    await actions.subscribeChatTurnCompleted.firstCall.args[0]({ status: 'completed' });
    expect(root.querySelector('tr.missing')).to.equal(null);
    expect(root.querySelector('tr.current')).not.to.equal(null);
    expect(root.querySelectorAll('#pages button')).to.have.length(0);
  });

  it('supports manual refresh without notifications and disables unsupported chat actions', async () => {
    const actions = await mount({
      us: [page('us', 'page', 300), page('us', 'new')],
      ca: [page('ca', 'page', 200)],
      chat: false,
      notifications: false,
    });
    const buttons = [...root.querySelectorAll('#pages button')];
    expect(buttons).to.have.length(2);
    expect(buttons.every((button) => button.disabled)).to.equal(true);
    expect(root.querySelector('#status').textContent).to.include('does not support chat');
    expect(actions.subscribeChatTurnCompleted.called).to.equal(false);
    const rescanned = new Promise((resolve) => {
      const observer = new MutationObserver(() => {
        if (root.querySelector('#status').textContent.includes('No HTML pages')) {
          observer.disconnect();
          resolve();
        }
      });
      observer.observe(root.querySelector('#status'), { childList: true });
    });
    actions.daFetch.callsFake(async () => response([]));
    root.querySelector('#refresh').click();
    await rescanned;
    expect(actions.daFetch.callCount).to.equal(4);
  });

  it('shows empty results and scan errors without retaining stale rows', async () => {
    const actions = await mount({
      us: [page('us', 'page', 100)],
      ca: [page('ca', 'page', 200)],
    });
    expect(root.querySelector('#pages').children).to.have.length(1);
    actions.daFetch.resolves(new Response(null, { status: 403 }));
    await actions.subscribeChatTurnCompleted.firstCall.args[0]({ status: 'completed' });
    expect(root.querySelector('#status').textContent).to.include('Scan failed:');
    expect(root.querySelector('#pages').children).to.have.length(0);
    expect(root.querySelector('#refresh').disabled).to.equal(false);
    actions.daFetch.callsFake(async () => response([]));
    await actions.subscribeChatTurnCompleted.firstCall.args[0]({ status: 'completed' });
    expect(root.querySelector('#status').textContent).to.include('No HTML pages');
  });
});
