// Test block for quick-edit: simulates a block that takes a while to decorate and then
// rebuilds its markup by moving the authored content into new elements (like a block that
// collects links into a list). If quick-edit attached editors before this finishes, moving
// the content out of them empties their paragraphs, which gets written back as an edit.
//
// Variants:
//   slow-block        - decoration (and therefore section loading) waits ~3s, then rebuilds.
//   slow-block (late) - decoration finishes immediately; the rebuild happens ~3s later.

const DELAY_MS = 3000;

const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

function getLines(block) {
  return [...block.querySelectorAll(':scope > div > div')].flatMap((cell) => {
    const lines = [...cell.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li')];
    return lines.length ? lines : [cell];
  });
}

function rebuild(block) {
  const list = document.createElement('div');
  list.className = 'slow-block-lines';
  getLines(block).forEach((line) => {
    const item = document.createElement('p');
    // Move (not copy) the content, so it leaves the original element.
    item.append(...line.childNodes);
    list.append(item);
  });
  block.replaceChildren(list);
  block.classList.add('slow-block-done');
}

export default async function init(block) {
  if (block.classList.contains('late')) {
    setTimeout(() => rebuild(block), DELAY_MS);
    return;
  }
  await wait(DELAY_MS);
  rebuild(block);
}
