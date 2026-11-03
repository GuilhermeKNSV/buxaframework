/** Bottom tabs shared by the world Item, Actor, and Scene directories.
 * Each tab is a real, flagged world Folder. It contains ordinary documents and
 * folders; switching tabs never copies or re-creates any Foundry documents. */
import { MODULE_ID } from '../core/constants.js';
import { folderIdOf } from './item-directory-cards.js';
import { ensureMainFolder, isMainFolder } from './directory-main-folder.js';

export const isDirectoryTab = (folder, type) => Boolean(folder?.type === type &&
  folder.flags?.[MODULE_ID]?.directoryTab === type && !isMainFolder(folder));
export const directoryTabs = (type, all = globalThis.game?.folders?.contents ?? []) =>
  all.filter(folder => isDirectoryTab(folder, type)).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));

/** Each tab is a VIEW, not a folder to click into.
 * The flagged Folder remains only as an invisible, native Foundry persistence
 * container. Its immediate children render at the directory root. Main is the
 * sole shared folder tree; unassigned root entries stay on the Main tab only.
 * No saved Folder/Document is mutated while computing presentation. */
export function directoryTabContents(type, active, folders, docs) {
  const byId = new Map(folders.map(folder => [folder.id, folder]));
  const tabs = new Set(folders.filter(folder => isDirectoryTab(folder, type)).map(folder => folder.id));
  const selected = tabs.has(active) ? active : null;

  // Resolve the *nearest* tab or Main in an entry's ancestry. Do not treat
  // unrelated world-root folders as globally shared across views.
  const workspace = entry => {
    const visited = new Set();
    let node = entry;
    while (node && !visited.has(node.id)) {
      if (isMainFolder(node)) return 'main';
      if (tabs.has(node.id)) return node.id;
      visited.add(node.id);
      node = byId.get(folderIdOf(node));
    }
    return null;
  };
  const belongs = entry => {
    const owner = workspace(entry);
    return owner === 'main' || (selected ? owner === selected : owner === null);
  };
  const shownFolders = folders.filter(folder => !tabs.has(folder.id) && belongs(folder));
  const shownDocs = docs.filter(belongs);
  return { folders: shownFolders, docs: shownDocs, rootFolderId: null, tabContentsFolderId: selected };
}

/** Allocate a simple number without a naming popup. Existing tab names survive. */
export function nextDirectoryTabName(type, folders = globalThis.game?.folders?.contents ?? []) {
  const used = new Set(directoryTabs(type, folders).map(folder => String(folder.name).trim()));
  let number = 1;
  while (used.has(String(number))) number++;
  return String(number);
}

const worldDocs = type => type === 'Item' ? globalThis.game?.items?.contents ?? [] :
  type === 'Actor' ? globalThis.game?.actors?.contents ?? [] : globalThis.game?.scenes?.contents ?? [];
const worldDoc = (type, id) => worldDocs(type).find(d => d.id === id);
const cleanName = value => String(value ?? '').trim().slice(0, 80);
const safeUuid = (type, data) => {
  if (data?.type !== type || typeof data.uuid !== 'string' || !new RegExp(`^${type}\\.[^.]+$`).test(data.uuid)) return null;
  return worldDoc(type, data.uuid.split('.').at(-1));
};
function draggedSource(type, event, activeDrag) {
  let data;
  try { data = JSON.parse(event.dataTransfer?.getData('text/plain') || 'null'); } catch { data = null; }
  const folderId = activeDrag?.kind === 'folder' ? activeDrag.id :
    data?.type === 'Folder' ? (data.uuid?.startsWith('Folder.') ? data.uuid.slice(7) : data.id) : null;
  const folder = folderId && globalThis.game?.folders?.get?.(folderId);
  if (folder?.type === type) return { kind: 'folder', doc: folder };
  const id = activeDrag?.kind === 'doc' ? activeDrag.id : null;
  const doc = (id ? worldDoc(type, id) : null) || safeUuid(type, data);
  return doc ? { kind: 'doc', doc } : null;
}

export function canPutInDirectoryTab(entry, type, destination, lookup = id => globalThis.game?.folders?.get?.(id)) {
  if (!entry?.id || !destination) return false;
  const destinationFolder = lookup(destination);
  if (!destinationFolder || destinationFolder.type !== type ||
      (!isMainFolder(destinationFolder) && !isDirectoryTab(destinationFolder, type))) return false;
  const isFolder = lookup(entry.id) === entry;
  if (isFolder) {
    if (entry.type !== type || isMainFolder(entry) || isDirectoryTab(entry, type)) return false;
    const seen = new Set();
    for (let current = lookup(destination); current; current = lookup(folderIdOf(current))) {
      if (current.id === entry.id || seen.has(current.id)) return false;
      seen.add(current.id);
    }
    return true;
  }
  return entry.documentName === type || entry.constructor?.name === type;
}

export async function moveToDirectoryTab(type, source, destinationId, { lookup = id => globalThis.game?.folders?.get?.(id) } = {}) {
  if (!globalThis.game?.user?.isGM) throw Error('Only the GM can move world entries.');
  const entry = source?.doc;
  const destination = lookup(destinationId);
  if (!entry || !destination || destination.type !== type || (!isMainFolder(destination) && !isDirectoryTab(destination, type))) throw Error('Invalid destination tab.');
  if (!canPutInDirectoryTab(entry, type, destinationId, lookup)) throw Error('Cannot move that folder into this tab.');
  if (folderIdOf(entry) === destinationId) return false;
  await entry.update({ folder: destinationId });
  return true;
}

export async function removeDirectoryTab(type, tab, { deleteContents = false } = {}) {
  if (!globalThis.game?.user?.isGM || !isDirectoryTab(tab, type)) throw Error('Only the GM can delete custom tabs.');
  const main = await ensureMainFolder(type);
  if (!main) throw Error('Main folder is unavailable.');
  // Build a snapshot and resolve child folders bottom-up. Never rely on
  // Foundry's implicit folder deletion behavior to preserve or remove docs.
  const folders = (globalThis.game?.folders?.contents ?? []).filter(f => f.type === type);
  const children = new Map();
  for (const folder of folders) {
    const id = folderIdOf(folder);
    if (!children.has(id)) children.set(id, []);
    children.get(id).push(folder);
  }
  if (!deleteContents) {
    for (const doc of worldDocs(type).filter(d => folderIdOf(d) === tab.id)) await doc.update({ folder: main.id });
    for (const folder of children.get(tab.id) ?? []) await folder.update({ folder: main.id });
    await tab.delete();
    return;
  }
  const visited = new Set(), order = [];
  const visit = folder => {
    if (visited.has(folder.id)) throw Error('Cannot delete circular folder structure.');
    visited.add(folder.id);
    for (const child of children.get(folder.id) ?? []) visit(child);
    order.push(folder);
  };
  visit(tab);
  const ids = new Set(order.map(f => f.id));
  for (const doc of worldDocs(type)) if (ids.has(folderIdOf(doc))) await doc.delete();
  for (const folder of order) await folder.delete();
}

/** Mount once per sidebar DOM. Stable active IDs are per client, not global. */
export function installDirectoryTabs(shell, type, { onChange, getDrag, showMenu } = {}) {
  let active = null;
  let renaming = null;
  let creating = false;
  const bar = shell.ownerDocument.createElement('nav');
  bar.className = 'buxa-directory-tabs';
  bar.setAttribute('aria-label', `${type} directory tabs`);
  shell.append(bar);
  const refresh = () => {
    // Avoid destroying an input while Foundry renders an open sheet/sidebar.
    if (renaming) return;
    const tabs = directoryTabs(type);
    if (active && !tabs.some(f => f.id === active)) active = null;
    const entries = [{ id: '', name: 'Main' }, ...tabs];
    const fingerprint = JSON.stringify([active, entries.map(entry => [entry.id, entry.name]), Boolean(globalThis.game?.user?.isGM)]);
    if (bar.dataset.fingerprint === fingerprint) return;
    bar.dataset.fingerprint = fingerprint;
    bar.replaceChildren();
    for (const entry of entries) {
      const button = shell.ownerDocument.createElement('button');
      button.type = 'button'; button.className = 'buxa-directory-tab';
      button.dataset.directoryTab = entry.id;
      button.textContent = entry.name;
      button.title = entry.name;
      button.setAttribute('aria-current', (active || '') === entry.id ? 'page' : 'false');
      bar.append(button);
    }
    if (globalThis.game?.user?.isGM) {
      const add = shell.ownerDocument.createElement('button');
      add.type = 'button'; add.dataset.directoryTabAdd = '';
      add.className = 'buxa-directory-tab-add'; add.textContent = '+'; add.title = 'New tab';
      bar.append(add);
    }
  };
  const setActive = id => {
    const next = id && directoryTabs(type).some(f => f.id === id) ? id : null;
    if (active === next) return;
    active = next; refresh(); onChange?.(active);
  };
  const create = async () => {
    if (!globalThis.game?.user?.isGM || creating) return;
    creating = true;
    try {
      const name = nextDirectoryTabName(type);
      const created = await globalThis.Folder.create({ name, type, color: '#59799b', folder: null, flags: { [MODULE_ID]: { directoryTab: type } } });
      if (!created?.id) throw Error('Could not create tab.');
      refresh(); setActive(created.id);
    } catch (error) {
      console.warn('Buxa | Could not create directory tab', error);
      globalThis.ui?.notifications?.error?.(error?.message || 'Could not create tab.');
    } finally { creating = false; }
  };
  const edit = (_anchor, tab) => {
    if (!globalThis.game?.user?.isGM || !tab?.id || renaming) return;
    const button = [...bar.querySelectorAll('[data-directory-tab]')].find(node => node.dataset.directoryTab === tab.id);
    if (!button) return;
    const input = shell.ownerDocument.createElement('input');
    input.type = 'text'; input.maxLength = 80; input.required = true;
    input.className = 'buxa-directory-tab-rename';
    input.setAttribute('aria-label', 'Rename tab');
    input.value = tab.name;
    renaming = tab.id;
    button.replaceWith(input);
    const finish = () => { renaming = null; bar.dataset.fingerprint = ''; refresh(); };
    let ended = false;
    const commit = async (save = true) => {
      if (ended) return;
      ended = true;
      const name = cleanName(input.value);
      if (save && name && name.toLowerCase() !== 'main' && name !== tab.name) {
        try { await tab.update({ name }); }
        catch (error) {
          console.warn('Buxa | Could not rename tab', error);
          globalThis.ui?.notifications?.error?.(error?.message || 'Could not rename tab.');
        }
      }
      finish();
    };
    // Keep the editor in the sidebar, not in a body-level popup that loses
    // keyboard focus when a Foundry Application window is open.
    input.addEventListener('click', event => event.stopPropagation());
    input.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.key === 'Enter') { event.preventDefault(); void commit(); }
      if (event.key === 'Escape') { event.preventDefault(); void commit(false); }
    });
    input.addEventListener('keyup', event => event.stopPropagation());
    input.addEventListener('keypress', event => event.stopPropagation());
    input.addEventListener('blur', () => void commit());
    input.focus({ preventScroll: true }); input.select();
  };
  bar.addEventListener('click', event => {
    const add = event.target.closest('[data-directory-tab-add]');
    if (add) { void create(); return; }
    const button = event.target.closest('[data-directory-tab]');
    if (button) setActive(button.dataset.directoryTab || null);
  });
  bar.addEventListener('contextmenu', event => {
    const button = event.target.closest('[data-directory-tab]');
    if (!button) return;
    event.preventDefault();
    if (!globalThis.game?.user?.isGM || !button.dataset.directoryTab) return;
    const tab = globalThis.game?.folders?.get(button.dataset.directoryTab);
    if (!isDirectoryTab(tab,type)) return;
    showMenu(event, [
      { name: 'Rename', icon: 'fa-pen', run: anchor => edit(anchor, tab) },
      { name: 'Delete tab', icon: 'fa-folder-minus', run: async () => { await removeDirectoryTab(type,tab); refresh(); setActive(null); onChange?.(active); } },
      { name: 'Delete all', icon: 'fa-trash', run: async () => {
        if (!globalThis.window?.confirm?.(`Delete "${tab.name}" and EVERY ${type} and folder inside it? This cannot be undone.`)) return;
        await removeDirectoryTab(type, tab, { deleteContents:true }); refresh(); setActive(null); onChange?.(active);
      } }
    ]);
  });
  const canDrop = event => {
    if (!globalThis.game?.user?.isGM) return null;
    const button = event.target.closest('[data-directory-tab]');
    if (!button) return null;
    const dest = button.dataset.directoryTab ? globalThis.game?.folders?.get(button.dataset.directoryTab) :
      (globalThis.game?.folders?.contents ?? []).find(isMainFolderForType);
    function isMainFolderForType(f) { return f.type === type && isMainFolder(f); }
    const source = draggedSource(type, event, getDrag?.());
    return dest && source && canPutInDirectoryTab(source.doc, type, dest.id) ? { button, dest, source } : null;
  };
  bar.addEventListener('dragover', event => {
    if (!globalThis.game?.user?.isGM) return;
    const button = event.target.closest('[data-directory-tab]');
    if (!button) return;
    // DataTransfer.getData is empty during dragover in Chromium for external
    // panel drags; validate the actual UUID on drop, not here.
    const hasPayload = Boolean(getDrag?.()) || [...(event.dataTransfer?.types || [])].includes('text/plain');
    if (!hasPayload) return;
    event.preventDefault(); event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    bar.querySelectorAll('.is-drop-target').forEach(el => el.classList.remove('is-drop-target'));
    button.classList.add('is-drop-target');
  });
  bar.addEventListener('dragleave', event => {
    if (!bar.contains(event.relatedTarget)) bar.querySelectorAll('.is-drop-target').forEach(el => el.classList.remove('is-drop-target'));
  });
  bar.addEventListener('drop', async event => {
    const valid = canDrop(event);
    if (!valid) return;
    event.preventDefault(); event.stopPropagation();
    bar.querySelectorAll('.is-drop-target').forEach(el => el.classList.remove('is-drop-target'));
    try { await moveToDirectoryTab(type, valid.source, valid.dest.id); refresh(); onChange?.(active); }
    catch (error) { console.warn('Buxa | Directory tab drop failed', error); globalThis.ui?.notifications?.error?.(error.message || 'Tab move failed.'); }
  });
  bar.addEventListener('dragend', () => bar.querySelectorAll('.is-drop-target').forEach(el => el.classList.remove('is-drop-target')));
  refresh();
  return { refresh, get active() { return active; }, setActive };
}
