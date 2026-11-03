/** Open a folder entry through Foundry's public sidebar navigation API.
 * The native tab DOM is hidden while that tab lives inside a Buxa folder,
 * so synthetic clicks on the hidden element cannot reliably activate V14 tabs.
 * Keep the flyout lifecycle separate: activation never closes the folder. */
export function activateSidebarFolderTab(id, {
  sidebar = globalThis.ui?.sidebar,
  nativeButton = null
} = {}) {
  if (!id) return false;
  if (id === 'collapse') {
    if (typeof sidebar?.toggleExpanded === 'function') {
      sidebar.toggleExpanded();
      return true;
    }
  } else if (typeof sidebar?.changeTab === 'function') {
    // V14 Sidebar's navigation group is named "primary". Opening the already
    // active tab should not collapse it: this is a folder navigation action.
    if (sidebar.expanded === false && typeof sidebar.expand === 'function') sidebar.expand();
    if (sidebar.tabGroups?.primary !== id || sidebar.expanded === false)
      sidebar.changeTab(id, 'primary');
    return true;
  }
  // Legacy/fork fallback. Always click the native interactive face rather
  // than assuming that the data-tab wrapper is itself clickable.
  const face = nativeButton?.querySelector?.('button[data-tab],a[data-tab],[role="tab"][data-tab]')
    || nativeButton;
  if (typeof face?.click === 'function') {
    face.click();
    return true;
  }
  return false;
}
