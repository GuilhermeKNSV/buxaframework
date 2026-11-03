/** Replaces the visual world Item directory with Buxa-specific cards and a
 * native-Document-backed tree. Batches updates; no drag-time document rerenders. */
import { MODULE_ID, SETTINGS } from "../core/constants.js";
import { getSheetConfig } from "../core/config.js";
import { openBuxaItemSheet } from "./item-sheet.js";
import { getMainFolder } from "./directory-main-folder.js";
import { folderIdOf } from "./item-directory-cards.js";
import { directoryListHTML } from "./item-directory-tree.js";
import { DirectoryReorderPreview, moveSortedWorldItem } from "./item-directory-reorder.js";
import { directoryMultiEdit } from "./directory-multi-edit.js";
import { canMoveWorldItemFolder, moveWorldItemFolder, itemFolderFromDrop } from "./item-directory-folder-move.js";
import { paintSelectedMainItems } from "./gm-trashcan.js";
import { directoryTabContents, installDirectoryTabs } from "./directory-tabs.js";
import { refreshFolderPanels } from "./item-folder-panels.js";
import { directoryDropDestination, directoryDropSurface } from "./directory-drop-destination.js";

const getRoot = () => document.querySelector('#sidebar #items, #items.sidebar-tab, [data-tab="items"].sidebar-tab');
const canCreate = () => game.user?.isGM || game.user?.can?.("ITEM_CREATE");
const leftMode = () => game.settings?.get?.(MODULE_ID, SETTINGS.SHEET_CONFIG)?.ui?.itemUi?.openFoldersLeft === true;
const safeId = (id) => String(id ?? "");
const entryFolder = (id) => game.folders?.get(id);
const itemFor = (id) => game.items?.get(id);
const itemVisible = (document) => document?.visible !== false;
let root = null;
let shell = null;
let list = null;
let search = "";
let sortMode = "manual";
let expanded = new Set();
let pending = false;
let state = {};
let draggedId = null;
let draggedFolderId = null;
let dropTarget = null;
let preview = null;
let multi = null;
let tabControl = null;
const sortModes = ["manual", "name", "rarity"];

function folders() { return (game.folders?.contents ?? []).filter((f) => f.type === "Item" && itemVisible(f)); }
function items() { return (game.items?.contents ?? []).filter(itemVisible); }
function descendants(folderId, folderList) { return folderList.filter((f) => folderIdOf(f) === folderId); }


function renderList() {
  if (!list?.isConnected) return;
  // Never replace item DOM while a drag is active. Losing the source element
  // mid-drag can cancel the browser dragend/drop events entirely.
  if (draggedId !== null || draggedFolderId !== null) { state.needsRender = true; return; }
  const scroll = list.scrollTop;
  const main = getMainFolder("Item");
  if (main && !leftMode() && !state.mainInitialized) { expanded.add(main.id); state.mainInitialized = true; }
  const rarities = state.rarities ?? (state.rarities = getSheetConfig().items?.rarities ?? []);
  tabControl?.refresh();
  const view = directoryTabContents("Item", tabControl?.active, folders(), items());
  const snapshot = directoryListHTML({ folders: view.folders, items: view.docs, rootFolderId: view.rootFolderId, tabContentsFolderId: view.tabContentsFolderId, rarities, query: search, expanded, left: leftMode(), sort: sortMode });
  const previous = state.reorderPositions;
  state.reorderPositions = null;
  if (snapshot !== state.lastHTML) {
    list.innerHTML = snapshot;
    list.scrollTop = scroll;
    state.lastHTML = snapshot;
    if (previous && !window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
      for (const card of list.querySelectorAll("[data-buxa-dir-item]")) {
        const oldTop = previous.get(card.dataset.buxaDirItem);
        if (oldTop === undefined) continue;
        const delta = oldTop - card.getBoundingClientRect().top;
        if (Math.abs(delta) >= 2 && Math.abs(delta) < 300) {
          card.animate?.([{ transform: `translateY(${delta}px)` }, { transform: "translateY(0)" }],
            { duration: 170, easing: "cubic-bezier(.2,.75,.2,1)" });
        }
      }
    }
  }
  list.scrollTop = scroll;
  multi?.paint();
  paintSelectedMainItems(list);
  state.needsRender = false;
  const sortButton = shell?.querySelector('[data-buxa-dir-sort]');
  sortButton?.setAttribute("title", `Sorting: ${sortMode}. Click to change.`);
  const icon = sortButton?.querySelector("i");
  if (icon) icon.className = sortMode === "manual" ? "fa-solid fa-grip-lines" : `fa-solid fa-arrow-down-${sortMode === "name" ? "a-z" : "wide-short"}`;
}
export function requestDirectoryRender({ settingsChanged = false } = {}) {
  if (settingsChanged) state.rarities = null;
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => { pending = false; if (shell?.isConnected) renderList(); });
}

function installShell(dir, { showCreateItem, showCreateFolder, openFolderPanel, showDirectoryForm, showDirectoryActionMenu }) {
  if (root !== dir) {
    root?.classList?.remove("buxa-dir-active");
    preview?.clear(); preview = null;
    root = dir; shell = null; list = null; tabControl = null; state = {};
  }
  if (shell?.isConnected) return;
  state.showDirectoryForm = showDirectoryForm;
  state.showDirectoryActionMenu = showDirectoryActionMenu;
  shell = document.createElement("section");
  shell.className = "buxa-world-item-directory";
  shell.setAttribute("aria-label", "Buxa Item Directory");
  shell.innerHTML = `<div class="buxa-world-toolbar"><button type="button" data-buxa-dir-create="item"><i class="fa-solid fa-gem"></i><span>New item</span></button><button type="button" data-buxa-dir-create="folder"><i class="fa-solid fa-folder-plus"></i><span>New folder</span></button></div>
    <div class="buxa-world-searchbar"><i class="fa-solid fa-magnifying-glass"></i><input data-buxa-dir-search type="search" autocomplete="off" spellcheck="false" placeholder="Search items..." aria-label="Search items"/><button type="button" data-buxa-dir-sort title="Sort by rarity" aria-label="Sort items"><i class="fa-solid fa-arrow-down-a-z"></i></button></div>
    <div class="buxa-world-list" data-buxa-dir-root="" role="list"></div>`;
  dir.append(shell);
  dir.classList.add("buxa-dir-active");
  list = shell.querySelector('.buxa-world-list');
  multi = directoryMultiEdit("Item");
  multi.mount(shell);
  preview = new DirectoryReorderPreview(list, { itemSelector: "[data-buxa-dir-item]", rowSelector: ".buxa-world-tree-node" });
  shell.querySelector('[data-buxa-dir-search]').value = search;
  shell.querySelectorAll('[data-buxa-dir-create]').forEach((button) => { button.hidden = !canCreate(); });
  shell.addEventListener("input", (event) => {
    if (event.target.matches('[data-buxa-dir-search]')) { search = event.target.value; renderList(); list.scrollTop = 0; }
  });
  shell.addEventListener("click", (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.buxaDirCreate) {
      if (!canCreate()) return;
      if (button.dataset.buxaDirCreate === "item") showCreateItem(button, tabControl?.active);
      else showCreateFolder(button, tabControl?.active);
    } else if (button.matches('[data-buxa-dir-sort]')) {
      sortMode = sortModes[(sortModes.indexOf(sortMode) + 1) % sortModes.length];
      renderList();
    } else if (button.dataset.buxaDirFolder) {
      const id = button.dataset.buxaDirFolder;
      if (leftMode()) openFolderPanel(id);
      else {
        expanded.has(id) ? expanded.delete(id) : expanded.add(id);
        renderList();
      }
    } else if (button.dataset.buxaDirItem) {
      const item = itemFor(button.dataset.buxaDirItem);
      if (item) openBuxaItemSheet(item);
    }
  });
  tabControl = installDirectoryTabs(shell, 'Item', {
    showForm: state.showDirectoryForm,
    showMenu: state.showDirectoryActionMenu,
    getDrag: () => draggedFolderId ? { kind: 'folder', id: draggedFolderId } : draggedId ? { kind: 'doc', id: draggedId } : null,
    onChange: () => { state.lastHTML = ''; renderList(); refreshFolderPanels(); }
  });
  shell.addEventListener("dragstart", (event) => {
    if (!game.user?.isGM) { event.preventDefault(); return; }
    const folderNode = event.target.closest('[data-buxa-dir-folder]');
    const folder = folderNode && entryFolder(folderNode.dataset.buxaDirFolder);
    if (folder) {
      if (isMainFolder(folder) || folder.flags?.[MODULE_ID]?.directoryTab === 'Item') {event.preventDefault(); return;}
      draggedFolderId = folder.id;
      folderNode.classList.add('is-dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', JSON.stringify({ type:'Folder', uuid: folder.uuid || `Folder.${folder.id}` }));
    } else {
      const entry = event.target.closest('[data-buxa-dir-item]');
      const item = itemFor(entry?.dataset.buxaDirItem);
      if (!item) { event.preventDefault(); return; }
      draggedId = item.id;
      entry.classList.add('is-dragging');
      event.dataTransfer.effectAllowed = 'copyMove';
      event.dataTransfer.setData('text/plain', JSON.stringify({ type: 'Item', uuid: item.uuid }));
    }
    shell.classList.add('is-reordering');
    preview?.clear();
  });
  shell.addEventListener("dragend", () => {
    draggedId = null; draggedFolderId = null;
    shell.classList.remove("is-reordering");
    preview?.clear();
    dropTarget?.classList.remove("is-drop-target");
    dropTarget = null;
    shell.querySelectorAll(".is-dragging").forEach((el) => el.classList.remove("is-dragging"));
    list?.classList.remove('is-root-drop-target');
    if (state.needsRender) requestDirectoryRender();
  });
  const dropNode = (target) => directoryDropSurface(target, shell)
    ? target.closest?.('[data-buxa-dir-folder], [data-buxa-dir-root]') || list : null;
  const draggedFolder = event => {
    if (draggedFolderId) return entryFolder(draggedFolderId);
    try { return itemFolderFromDrop(JSON.parse(event.dataTransfer?.getData('text/plain') || 'null')); }
    catch { return null; }
  };
  shell.addEventListener("dragover", (event) => {
    if (!game.user?.isGM) return;
    const target = dropNode(event.target);
    if (!target) return;
    if (draggedId === null && draggedFolderId === null && ![...event.dataTransfer.types].includes("text/plain")) return;
    const folder = draggedFolderId ? entryFolder(draggedFolderId) : null;
    const targetFolder = event.target.closest('[data-buxa-dir-folder]');
    if (folder && !canMoveWorldItemFolder(folder, directoryDropDestination({ activeTab: tabControl?.active, folderId: targetFolder?.dataset.buxaDirFolder }))) return;
    event.preventDefault(); event.dataTransfer.dropEffect = "move";
    shell.classList.add("is-reordering");
    // Show a quiet hint only for actual empty-space drops. Do not cover rows.
    const overItem = event.target.closest("[data-buxa-dir-item]");
    list?.classList.toggle('is-root-drop-target', !overItem && !targetFolder);
    if (overItem && sortMode === "manual" && !draggedFolderId) {
      preview?.update(event, draggedId);
      dropTarget?.classList.remove("is-drop-target");
      dropTarget = null;
      return;
    }
    preview?.clear();
    const folderTarget = event.target.closest('[data-buxa-dir-folder]');
    // Highlight only explicit folder or root targets, not the whole list:
    // root highlighting flashed every time the pointer crossed a card edge.
    if (folderTarget !== dropTarget) {
      dropTarget?.classList.remove('is-drop-target');
      folderTarget?.classList.add('is-drop-target');
      dropTarget = folderTarget;
    }
  });
  shell.addEventListener("dragleave", (event) => {
    if (!shell.contains(event.relatedTarget)) {
      dropTarget?.classList.remove("is-drop-target"); dropTarget = null;
      list?.classList.remove('is-root-drop-target');
    }
  });
  shell.addEventListener("drop", async (event) => {
    if (!game.user?.isGM || !dropNode(event.target)) return;
    event.preventDefault(); event.stopPropagation();
    list?.classList.remove('is-root-drop-target');
    dropTarget?.classList.remove('is-drop-target'); dropTarget = null;
    const folderToMove = draggedFolder(event);
    if (folderToMove) {
      const targetFolder = event.target.closest('[data-buxa-dir-folder]');
      if (!targetFolder && event.target.closest('[data-buxa-dir-item]')) return;
      const parentId = directoryDropDestination({ activeTab: tabControl?.active, folderId: targetFolder?.dataset.buxaDirFolder });
      draggedFolderId = null;
      shell.classList.remove('is-reordering');
      shell.querySelectorAll('.is-dragging').forEach(el => el.classList.remove('is-dragging'));
      if (!canMoveWorldItemFolder(folderToMove, parentId)) {
        ui.notifications?.warn?.('Cannot move a folder into itself or one of its children.');
        return;
      }
      try { await moveWorldItemFolder(folderToMove, parentId); requestDirectoryRender(); }
      catch (error) { ui.notifications?.error?.(error?.message || 'Could not move folder.'); }
      return;
    }
    let item = itemFor(draggedId);
    if (!item) {
      try {
        const data = JSON.parse(event.dataTransfer.getData("text/plain"));
        if (data.type === "Item" && /^Item\.[^.]+$/.test(data.uuid ?? "")) item = itemFor(data.uuid.split(".").at(-1));
      } catch (_error) { /* Not a world Item drag. */ }
    }
    const visualTarget = sortMode === "manual" ? preview?.getTarget() : null;
    if (visualTarget) {
      state.reorderPositions = new Map([...list.querySelectorAll("[data-buxa-dir-item]")]
        .map((card) => [card.dataset.buxaDirItem, card.getBoundingClientRect().top]));
    }
    shell.classList.remove("is-reordering");
    shell.querySelectorAll(".is-dragging").forEach((el) => el.classList.remove("is-dragging"));
    preview?.clear(); draggedId = null; draggedFolderId = null;
    if (!item) { state.reorderPositions = null; return; }
    try {
      if (visualTarget) {
        const targetItem = itemFor(visualTarget.targetId);
        if (targetItem && targetItem.id !== item.id) {
          const changed = await moveSortedWorldItem(item, { folderId: folderIdOf(targetItem), target: targetItem, sortBefore: visualTarget.before });
          if (!changed) state.reorderPositions = null;
          requestDirectoryRender();
          return;
        }
      }
      const folderNode = event.target.closest('[data-buxa-dir-folder]');
      const folderId = directoryDropDestination({ activeTab: tabControl?.active, folderId: folderNode?.dataset.buxaDirFolder });
      if (folderId && !entryFolder(folderId)) return;
      if (folderIdOf(item) === folderId) return;
      await moveSortedWorldItem(item, { folderId });
      requestDirectoryRender();
    } catch (error) {
      state.reorderPositions = null;
      console.warn("Buxa | Could not move world item", error);
      ui.notifications?.error?.("Could not move item.");
    }
  });
  state.lastHTML = "";
  renderList();
}

export function mountBuxaItemDirectory(api) {
  const dir = getRoot();
  if (!dir) return;
  installShell(dir, api);
  requestDirectoryRender();
}
export function installBuxaItemDirectory(api) {
  mountBuxaItemDirectory(api);
  for (const hook of ["renderItemDirectory", "renderSidebarTab"]) Hooks.on(hook, () => { requestAnimationFrame(() => mountBuxaItemDirectory(api)); });
  // Drags may begin inside a left folder panel (not inside our shell), so
  // clean up after their dragend as well as our own source-row dragend.
  document.addEventListener("dragend", () => {
    draggedId = null; draggedFolderId = null;
    shell?.classList.remove("is-reordering");
    preview?.clear();
    dropTarget?.classList.remove("is-drop-target");
    dropTarget = null;
    list?.classList.remove('is-root-drop-target');
    if (state.needsRender && draggedId === null) requestDirectoryRender();
  });
  for (const hook of ["createItem", "updateItem", "deleteItem", "createFolder", "updateFolder", "deleteFolder"]) Hooks.on(hook, () => requestDirectoryRender());
  Hooks.on("updateSetting", () => requestDirectoryRender({ settingsChanged: true }));
}
