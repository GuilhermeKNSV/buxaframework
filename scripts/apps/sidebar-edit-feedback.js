/** Presentation feedback without replacing the native navigation controls. */
export function syncSidebarFolderState(editor) {
  const layout = editor.edit ? editor.draft : editor.active();
  for (const button of editor.nav.querySelectorAll('.buxa-sb-folder')) {
    const folder = layout.folders.find(f => f.id === button.dataset.buxaButtonId);
    const expanded = editor.openFolder === folder?.id;
    button.classList.toggle('is-open', expanded);
    button.setAttribute('aria-expanded', String(expanded));
    button.setAttribute('aria-label', `${folder?.name || 'Folder'}, ${folder?.items.length || 0} buttons`);
    button.classList.toggle('has-active-tab', Boolean(folder?.items.some(id => {
      const tab = editor.tabs.get(id);
      return tab?.classList.contains('active') || tab?.getAttribute('aria-selected') === 'true';
    })));
  }
}

export function sidebarWorldRestricts(world, id) {
  return world.visibility.allPlayers.includes(id) || Object.values(world.visibility.users).some(ids => ids.includes(id));
}

export function annotateSidebarDrag(editor, drag) {
  const label = drag.source.getAttribute('aria-label') || drag.source.title || drag.id;
  drag.ghost.dataset.dragLabel = label;
  drag.ghost.dataset.dragSide = editor.nav.getBoundingClientRect().left < window.innerWidth / 2 ? 'left' : 'right';
  drag.ghost.setAttribute('aria-hidden', 'true');
  drag.ghost.tabIndex = -1;
}
