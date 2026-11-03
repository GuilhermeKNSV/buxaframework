/**
 * Incremental folder-panel DOM reconciliation.
 * Preserves existing panels, active drags, scroll positions and CSS animations
 * when an unrelated document updates. Replaces only panels whose markup changed.
 */
export function reconcileFolderPanelDOM(container, panels) {
  if (!container) return false;
  let changed = false;
  const doc = container.ownerDocument;
  for (let index = 0; index < panels.length; index++) {
    const { id, markup } = panels[index];
    let node = container.children[index];
    if (node?.dataset?.buxaFolderPanel === id && node._buxaRenderedMarkup === markup) continue;
    const previous = [...container.children].find(el => el.dataset?.buxaFolderPanel === id);
    if (previous?._buxaRenderedMarkup === markup) {
      container.insertBefore(previous, node || null);
      changed = true;
      continue;
    }
    const template = doc.createElement('template');
    template.innerHTML = markup;
    const next = template.content.firstElementChild;
    if (!next) continue;
    next._buxaRenderedMarkup = markup;
    if (previous) {
      const oldEntries = previous.querySelector('.buxa-folder-entries');
      const newEntries = next.querySelector('.buxa-folder-entries');
      if (oldEntries && newEntries) newEntries.scrollTop = oldEntries.scrollTop;
      previous.replaceWith(next);
      if (container.children[index] !== next) container.insertBefore(next, container.children[index] || null);
    } else {
      next.classList.add('is-opening');
      container.insertBefore(next, node || null);
    }
    changed = true;
  }
  while (container.children.length > panels.length) {
    container.lastElementChild.remove();
    changed = true;
  }
  return changed;
}
