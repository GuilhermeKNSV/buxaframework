/** "You got an item!" feedback: when an Item is created on an Actor, the new
 * item's inventory art gets a short arrival pop (CSS class buxa-item-new).
 * Purely visual: no document writes, class is removed again after the pop. */
const POP_MS = 1100;
const RETRY_DELAYS = [140, 420];

function flashItem(id) {
  const doc = globalThis.document;
  if (!doc?.querySelectorAll || !id) return false;
  const safe = globalThis.CSS?.escape ? globalThis.CSS.escape(id) : String(id).replace(/["\\]/g, '');
  const nodes = [...doc.querySelectorAll(`.buxa .buxa-inventory-item[data-item-id="${safe}"]`)];
  for (const node of nodes) {
    node.classList.remove('buxa-item-new');
    void node.offsetWidth; // restart the animation if the item is re-granted
    node.classList.add('buxa-item-new');
    setTimeout(() => node.classList.remove('buxa-item-new'), POP_MS);
  }
  return nodes.length > 0;
}

export function installRarityPickupFlash() {
  Hooks.on('createItem', (item) => {
    if (item?.parent?.documentName !== 'Actor') return;
    const id = item.id;
    // The sheet re-renders asynchronously after the create; retry until the art exists.
    let done = false;
    for (const delay of RETRY_DELAYS) setTimeout(() => { if (!done) done = flashItem(id); }, delay);
  });
}
