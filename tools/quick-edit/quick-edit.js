import { loadPage } from '../../scripts/scripts.js';

async function loadMoudle(origin, payload, ref) {
  const { default: loadQuickEdit } = await import(`${origin}/nx/blocks/wysiwyg-portal/init-host.js`);
  loadQuickEdit(payload, ref, loadPage);
}

export default function init(payload) {
  const { search } = window.location;
  const ref = new URLSearchParams(search).get('quick-edit');
  let origin;
  if (ref === 'on' || !ref) origin = 'https://da-fusion--da-nx--adobe.aem.live';
  if (ref === 'local') origin = 'http://localhost:6456';
  if (!origin) origin = `https://${ref}--da-nx--adobe.aem.live`;
  loadMoudle(origin, payload, ref);
}