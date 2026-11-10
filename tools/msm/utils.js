export function getSiteContext(context) {
  const target = context.hash?.match(/^#\/([^/]+)\/([^/]+)(?:\/|$)/);
  const [org, repo] = target ? target.slice(1) : [context.org, context.repo];
  if (![org, repo].every((part) => typeof part === 'string' && /^[a-z0-9._-]+$/i.test(part))) {
    throw new Error('MSM needs a DA organization and site.');
  }
  return { org, repo, daOrigin: context.daOrigin || 'https://admin.da.live' };
}

export async function crawlPages({ org, repo, daOrigin }, region, daFetch) {
  const root = `/${org}/${repo}/${region}`;
  const folders = [root];
  const visited = new Set(folders);
  const pages = new Map();
  while (folders.length) {
    const folder = folders.pop();
    let token;
    do {
      const options = token ? { headers: { 'da-continuation-token': token } } : {};
      const path = folder.split('/').map(encodeURIComponent).join('/');
      const response = await daFetch(`${daOrigin}/list${path}`, options);
      if (response.status === 404 && folder === root && region === 'ca' && !token) {
        return pages;
      }
      if (!response.ok) throw new Error(`Could not list ${folder} (${response.status}).`);
      const children = await response.json();
      children.forEach((child) => {
        if (!child.name || !child.path?.startsWith(`${folder}/`)) return;
        if (!child.ext && !visited.has(child.path)) {
          visited.add(child.path);
          folders.push(child.path);
        } else if (child.ext === 'html') pages.set(child.path.slice(root.length), child);
      });
      token = response.headers.get('da-continuation-token');
    } while (token);
  }
  return pages;
}

export function getModifiedTime(value) {
  if (value === undefined || value === null || value === '') return null;
  const raw = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof raw !== 'number' && typeof raw !== 'string') return null;
  const time = new Date(raw).getTime();
  return Number.isFinite(time) && time >= 0 ? time : null;
}

export function comparePages(usPages, caPages) {
  return [...usPages.entries()]
    .map(([path, us]) => {
      const ca = caPages.get(path);
      const usTime = getModifiedTime(us.lastModified);
      const caTime = getModifiedTime(ca?.lastModified);
      let status = ca ? 'unknown' : 'missing';
      if (ca && usTime !== null && caTime !== null) {
        status = usTime > caTime ? 'outdated' : 'current';
      }
      return {
        path, us, ca, usTime, caTime, status,
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}

export function promotionPrompt({ org, repo }, { path, us, ca }) {
  if (!ca) {
    return [
      `Create a Canadian copy of the US page in the DA site ${org}/${repo}.`,
      `Source US page: ${JSON.stringify(us.path)}.`,
      `Target CA page: ${JSON.stringify(`/${org}/${repo}/ca${path}`)}.`,
      'Check whether the target CA page already exists. If it does, do not overwrite it; report that it already exists.',
      'Read the US page and relevant existing CA pages for regional conventions, then create the copy at the target path, including any needed parent folders.',
      'Adapt the content for Canada, including spelling, regional references, and internal links where appropriate. Preserve the page structure and intent.',
      'Do not invent Canadian prices, offers, availability, or legal claims; ask for clarification when these need a regional decision.',
      'Only create the target CA page; do not modify the US page or any other pages.',
      'Save the new CA page as a draft. Do not publish it. Summarize the regional adjustments made.',
    ].join('\n');
  }
  return [
    `Promote changes from the US page to the matching CA page in the DA site ${org}/${repo}.`,
    `Source US page: ${JSON.stringify(us.path)}.`,
    `Target CA page: ${JSON.stringify(ca.path)}.`,
    'Read both pages and use their version history, where available, to identify the new US changes.',
    'Apply those changes to the CA page, preserving Canadian localization and CA-specific content and links.',
    'Only modify the target CA page; do not modify the US page or any other pages.',
    'Save the updated CA page as a draft. Do not publish it. Summarize the changes made.',
  ].join('\n');
}
