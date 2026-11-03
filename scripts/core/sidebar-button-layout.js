/** Pure layout/permission helpers for the Foundry V14 sidebar navigator.
 * Nothing here depends on DOM or mutates Foundry documents. */
export const SIDEBAR_LAYOUT_KEY = 'sidebarButtonsLayout';
export const SIDEBAR_WORLD_KEY = 'sidebarButtonsWorld';
export const SIDEBAR_DEFAULT_TABS = Object.freeze([
  'chat', 'combat', 'scenes', 'actors', 'items', 'journal', 'tables',
  'cards', 'macros', 'playlists', 'compendium', 'settings', 'collapse'
]);
const RESERVED = new Set(['settings']);
const MAX_FOLDERS = 32;
const MAX_TABS = 64;
const validId = (id) => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,70}$/.test(id);
const distinct = (ids) => [...new Set(ids)];
const validTab = (id, tabs) => validId(id) && tabs.includes(id);
const cleanIcon = (icon) => {
  if (icon?.type === 'image' && typeof icon.value === 'string' &&
      icon.value.length <= 400 && /^(?:modules\/|worlds\/|systems\/|icons\/|assets\/|https?:\/\/|data:image\/svg\+xml,)/i.test(icon.value)) {
    return { type: 'image', value: icon.value };
  }
  if (icon?.type === 'fa' && typeof icon.value === 'string' && /^fa-(?:solid|regular|brands|light) fa-[a-z0-9-]+$/.test(icon.value)) {
    return { type: 'fa', value: icon.value };
  }
  return { type: 'fa', value: 'fa-solid fa-folder' };
};
export function defaultSidebarLayout(tabs = SIDEBAR_DEFAULT_TABS) {
  return { version: 1, order: distinct(tabs.filter(validId)).slice(0, MAX_TABS),
    folders: [], hidden: [], removed: [], snap: true, autoAlign: true };
}
export function normalizeSidebarLayout(raw, tabs = SIDEBAR_DEFAULT_TABS) {
  const available = distinct(tabs.filter(validId)).slice(0, MAX_TABS);
  const base = defaultSidebarLayout(available);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const folders = [], folderIds = new Set();
  for (const folder of Array.isArray(raw.folders) ? raw.folders.slice(0, MAX_FOLDERS) : []) {
    if (!folder || !validId(folder.id) || !folder.id.startsWith('folder-') || folderIds.has(folder.id)) continue;
    folderIds.add(folder.id);
    folders.push({ id: folder.id, name: String(folder.name || 'New folder').trim().slice(0, 36) || 'New folder',
      icon: cleanIcon(folder.icon), items: distinct((Array.isArray(folder.items) ? folder.items : [])
        .filter(id => validTab(id, available) && !RESERVED.has(id))) });
  }
  const folderKeys = new Set(folders.map(f => f.id));
  const removed = distinct((Array.isArray(raw.removed) ? raw.removed : [])
    .filter(id => validTab(id, available) && !RESERVED.has(id)));
  const hidden = distinct((Array.isArray(raw.hidden) ? raw.hidden : [])
    .filter(id => validTab(id, available) && !RESERVED.has(id) && !removed.includes(id)));
  const consumed = new Set([...removed]);
  for (const folder of folders) {
    folder.items = folder.items.filter(id => {
      if (consumed.has(id)) return false;
      consumed.add(id); return true;
    });
  }
  const order = [];
  for (const id of Array.isArray(raw.order) ? raw.order : []) {
    if (folderKeys.has(id) && !order.includes(id)) order.push(id);
    else if (validTab(id, available) && !consumed.has(id)) {
      order.push(id); consumed.add(id);
    }
  }
  for (const id of available) if (!consumed.has(id) && !order.includes(id)) {
    // Native/other modules' newly-added tabs must not disappear merely because
    // they did not exist when the user saved their layout.
    order.push(id); consumed.add(id);
  }
  for (const folder of folders) if (!order.includes(folder.id)) order.push(folder.id);
  // A layout can move Settings but can never remove/hide/nest it.
  return { version: 1, order, folders, hidden, removed,
    snap: raw.snap !== false, autoAlign: raw.autoAlign !== false };
}
export function normalizeSidebarWorld(raw, tabs = SIDEBAR_DEFAULT_TABS) {
  const available = distinct(tabs.filter(validId));
  const input = raw && typeof raw === 'object' ? raw : {};
  const visibility = input.visibility && typeof input.visibility === 'object' ? input.visibility : {};
  const allPlayers = distinct((Array.isArray(visibility.allPlayers) ? visibility.allPlayers : [])
    .filter(id => validTab(id, available) && !RESERVED.has(id)));
  const users = {};
  if (visibility.users && typeof visibility.users === 'object') {
    for (const [userId, ids] of Object.entries(visibility.users).slice(0, 200)) {
      if (!validId(userId)) continue;
      const subset = distinct((Array.isArray(ids) ? ids : []).filter(id => validTab(id, available) && !RESERVED.has(id)));
      if (subset.length) users[userId] = subset;
    }
  }
  return { layout: normalizeSidebarLayout(input.layout, available), visibility: { allPlayers, users } };
}
export function isSidebarButtonHidden(id, user, layout, world) {
  if (id === 'settings') return false;
  if (layout.removed.includes(id) || layout.hidden.includes(id)) return true;
  if (user?.isGM) return false;
  return world.visibility.allPlayers.includes(id) || (world.visibility.users[user?.id] || []).includes(id);
}
export function moveSidebarButton(input, id, { into = null, before = null } = {}) {
  const layout = structuredClone(input);
  const folder = layout.folders.find(f => f.id === into);
  const isFolder = layout.folders.some(f => f.id === id);
  if (id === into || (isFolder && folder) || (id === 'settings' && folder)) return layout; // no nested folders; Settings stays reachable
  const wasPresent = layout.order.includes(id) || layout.folders.some(f => f.items.includes(id));
  if (!wasPresent && !layout.hidden.includes(id) && !layout.removed.includes(id)) return layout;
  layout.order = layout.order.filter(entry => entry !== id);
  for (const f of layout.folders) f.items = f.items.filter(entry => entry !== id);
  layout.hidden = layout.hidden.filter(entry => entry !== id);
  layout.removed = layout.removed.filter(entry => entry !== id);
  if (folder) folder.items.push(id);
  else {
    const index = layout.order.indexOf(before);
    layout.order.splice(index >= 0 ? index : layout.order.length, 0, id);
  }
  return layout;
}
export function setSidebarButtonVisibility(input, id, state) {
  const layout = structuredClone(input);
  if (id === 'settings') return layout;
  layout.hidden = layout.hidden.filter(entry => entry !== id);
  layout.removed = layout.removed.filter(entry => entry !== id);
  if (state === 'hidden') layout.hidden.push(id);
  if (state === 'removed') layout.removed.push(id);
  return layout;
}
export function addSidebarFolder(input, id, name = 'New folder') {
  const layout = structuredClone(input);
  if (!validId(id) || !id.startsWith('folder-') || layout.folders.length >= MAX_FOLDERS || layout.folders.some(f => f.id === id)) return layout;
  layout.folders.push({ id, name: String(name).slice(0, 36), icon: cleanIcon(null), items: [] });
  layout.order.push(id);
  return layout;
}
export function removeSidebarFolder(input, id) {
  const layout = structuredClone(input);
  const folder = layout.folders.find(f => f.id === id);
  if (!folder) return layout;
  const index = layout.order.indexOf(id);
  layout.order.splice(index, 1, ...folder.items);
  layout.folders = layout.folders.filter(f => f.id !== id);
  return layout;
}
