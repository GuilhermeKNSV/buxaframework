/** Follow live Foundry sidebar panel layout without moving the native UI.
 * Folder popouts remain alive outside Edit Mode, so never gate their reflow
 * on the presence of the editing dock. */
export function installSidebarUiFollower({Hooks, documentRef, getEditor, queueReposition}) {
  documentRef.addEventListener('buxa:gm-controls-toggled', queueReposition);
  let following = false;
  const movingPanel = target => Boolean(target?.matches?.(
    '#sidebar, #sidebar .sidebar-tab, #sidebar .sidebar-content, #sidebar [data-part="content"], .buxa-gm-panel'
  ));
  documentRef.addEventListener('transitionrun', event => {
    if (following || !getEditor()?.nav || !movingPanel(event.target)) return;
    following = true;
    const start = performance.now();
    const tick = () => {
      getEditor()?.repositionFloating();
      if (performance.now() - start < 420 && typeof requestAnimationFrame === 'function') requestAnimationFrame(tick);
      else following = false;
    };
    tick();
  }, true);
  documentRef.addEventListener('transitionend', event => {
    if (movingPanel(event.target)) queueReposition();
  }, true);
  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(queueReposition);
    let watched = new Set();
    const attach = () => {
      const root = documentRef.querySelector('#sidebar');
      const next = new Set(root ? [root, getEditor()?.nav, ...root.querySelectorAll(
        '.sidebar-tab, .sidebar-content, [data-part="content"], [data-part="sidebar-content"]'
      )].filter(Boolean) : []);
      for (const node of watched) if (!next.has(node)) observer.unobserve(node);
      for (const node of next) if (!watched.has(node)) observer.observe(node);
      watched = next;
    };
    Hooks.on('renderSidebar', attach);
    Hooks.on('renderSidebarTab', attach);
    Hooks.on('collapseSidebar', () => { attach(); queueReposition(); });
    Hooks.on('expandSidebar', () => { attach(); queueReposition(); });
    attach();
  }
}
