/** Stacked left-hand folder panels for the Foundry World Item directory.
 * DOM is rebuilt only when opening folders or world documents change. */
import { MODULE_ID, SETTINGS } from "../core/constants.js";
import { openBuxaItemSheet } from "./item-sheet.js";
import { renderItemCard, renderFolderCard, MAIN_FOLDER_COLOR } from "./item-directory-cards.js";
import { getSheetConfig } from "../core/config.js";
import { isMainFolder, sortMainFirst } from "./directory-main-folder.js";
import { byDocumentOrder, DirectoryReorderPreview, moveSortedWorldItem } from "./item-directory-reorder.js";
import { reconcileFolderPanelDOM } from "./folder-panel-dom.js";
import { canMoveWorldItemFolder, moveWorldItemFolder, itemFolderFromDrop } from "./item-directory-folder-move.js";
import { paintSelectedMainItems } from "./gm-trashcan.js";

const esc = (value) => foundry.utils.escapeHTML(String(value ?? ""));
const folderIdOf = (doc) => typeof doc?.folder === "string" ? doc.folder : doc?.folder?.id || null;
const colorOf = (folder) => isMainFolder(folder) ? MAIN_FOLDER_COLOR : (/^#[0-9a-fA-F]{6}$/.test(folder?.color ?? "") ? folder.color : "#668eb7");
const directory = () => document.querySelector('#sidebar #items, #items.sidebar-tab, [data-tab="items"].sidebar-tab');
let panels = null;
let path = [];
let dragItem = null;
let dragFolder = null;
let dragTarget = null;
let panelPreview = null;
let scheduled = false;
let refreshAfterDrag = false;
let arrivingItem = null;
let api = {};

function getFolder(id) { const folder = game.folders?.get(id); return folder?.type === "Item" ? folder : null; }
function isDescendant(child, parentId) {
  const visited = new Set();
  for (let current = child; current && !visited.has(current.id); current = getFolder(folderIdOf(current))) {
    if (current.id === parentId) return true;
    visited.add(current.id);
  }
  return false;
}
function buildChain(folderId) {
  const chain = [];
  const visited = new Set();
  let next = getFolder(folderId);
  while (next && !visited.has(next.id)) { chain.unshift(next.id); visited.add(next.id); next = getFolder(folderIdOf(next)); }
  return chain;
}
export function closeFolderPanels() {
  panelPreview?.clear(); panelPreview = null;
  panels?.remove();
  panels = null;
  path = [];
}
function panelMarkup(folder, level) {
  const childFolders = (game.folders?.contents ?? []).filter((entry) => entry.type === "Item" && folderIdOf(entry) === folder.id).sort((a,b)=>a.sort-b.sort || a.name.localeCompare(b.name));
  const items = (game.items?.contents ?? []).filter((item) => folderIdOf(item) === folder.id).sort(byDocumentOrder);
  const rarities = getSheetConfig().items?.rarities ?? [];
  return `<section class="buxa-folder-panel" data-buxa-folder-panel="${esc(folder.id)}" data-depth="${level}" aria-label="${esc(folder.name)}">
    <header class="buxa-folder-header" style="--buxa-folder-accent:${colorOf(folder)}">
      <span class="buxa-folder-heading"><i class="fa-solid fa-folder-open"></i><strong title="${esc(folder.name)}">${esc(folder.name)}</strong></span>
      <span class="buxa-folder-heading-actions"><button type="button" data-buxa-folder-create="item" title="Create item"><i class="fa-solid fa-plus"></i></button><button type="button" data-buxa-folder-close title="Close"><i class="fa-solid fa-xmark"></i></button></span>
    </header><div class="buxa-folder-entries" data-buxa-folder-drop="${esc(folder.id)}">
    ${childFolders.map((child) => renderFolderCard(child, { panel: true, left: true, main: isMainFolder(child), count: (game.items?.contents ?? []).filter((entry) => folderIdOf(entry) === child.id).length + (game.folders?.contents ?? []).filter((entry) => entry.type === "Item" && folderIdOf(entry) === child.id).length })).join("")}
    ${items.map((item) => renderItemCard(item, rarities, { panel: true })).join("")}
    ${!childFolders.length && !items.length ? '<div class="buxa-folder-empty">Empty folder</div>' : ""}
    </div><footer class="buxa-folder-footer"><button type="button" data-buxa-folder-create="folder"><i class="fa-solid fa-folder-plus"></i> New folder</button><span>${items.length} items</span></footer>
  </section>`;
}

function layoutPanels() {
  if (!panels) return;
  const anchor = directory();
  if (!anchor || !anchor.getClientRects().length) { closeFolderPanels(); return; }
  const box = anchor.getBoundingClientRect();
  const padding = 8, gap = 7;
  const width = Math.max(180, Math.min(266, window.innerWidth - padding*2));
  panels.style.setProperty("--buxa-folder-width", `${width}px`);
  for (const [index, element] of [...panels.children].entries()) {
    const distance = path.length - index;
    const wantedX = box.left - distance*(width + gap);
    // When there isn't enough room for all panels, overlap earlier ones: the
    // most recently opened folder remains fully accessible in the viewport.
    const x = wantedX < padding ? padding + Math.max(0,index-(path.length-1))*18 : wantedX;
    const top = Math.max(padding, Math.min(window.innerHeight - 140, box.top + 5));
    element.style.left = `${x}px`;
    element.style.top = `${top}px`;
    element.style.maxHeight = `${Math.max(160, window.innerHeight - top - padding)}px`;
    element.style.zIndex = `${340 + index}`;
  }
}
function renderPanels() {
  if (!path.length) return closeFolderPanels();
  path = path.filter((id) => Boolean(getFolder(id)));
  if (!path.length) return closeFolderPanels();
  // A folder moved out of Main no longer belongs to its previous panel chain.
  path = buildChain(path.at(-1));
  if (!panels) { panels = document.createElement("div"); panels.className = "buxa-folder-panels"; document.body.append(panels); }
  const entries = path.map((id, index) => ({ id, markup: panelMarkup(getFolder(id), index) }));
  // Do not destroy unaffected folder DOM on every Foundry document hook.
  const changed = reconcileFolderPanelDOM(panels, entries);
  if (changed) { panelPreview?.clear(); panelPreview = null; }
  if (arrivingItem) panels.querySelectorAll('[data-buxa-item]').forEach(row => {
    if (row.dataset.buxaItem === arrivingItem) row.classList.add('is-arriving');
  });
  arrivingItem = null;
  paintSelectedMainItems(panels);
  layoutPanels();
}
export function refreshFolderPanels() {
  if (!panels || scheduled) return;
  if (dragItem || dragFolder) { refreshAfterDrag = true; return; }
  scheduled = true;
  // Coalesce multiple Foundry hooks triggered by one document update.
  queueMicrotask(() => { scheduled = false; if (panels) renderPanels(); });
}
export function openFolderPanel(folderId) {
  if (game.settings?.get?.(MODULE_ID, SETTINGS.SHEET_CONFIG)?.ui?.itemUi?.openFoldersLeft !== true) return;
  const folder = getFolder(folderId);
  if (!folder) return;
  // Reusing an existing ancestor closes panels farther to the left.
  const index = path.indexOf(folderId);
  path = index >= 0 ? path.slice(0,index+1) : buildChain(folderId);
  renderPanels();
}
function getDroppedFolder(event) {
  if (dragFolder) return getFolder(dragFolder);
  try {return itemFolderFromDrop(JSON.parse(event.dataTransfer?.getData('text/plain') || 'null'));}
  catch {return null;}
}
function getDroppedItem(event) {
  if (dragItem) return game.items.get(dragItem);
  for (const kind of ["text/plain", "text"]) {
    try {
      const raw = event.dataTransfer?.getData(kind);
      if (!raw) continue;
      const data = JSON.parse(raw);
      if (data.type !== "Item") continue;
      const id = data.uuid?.split(".").at(-1) || data.id;
      if (data.uuid && !/^Item\.[^.]+$/.test(data.uuid)) continue; // Never move embedded actor items.
      return game.items?.get(id) || null;
    } catch (_error) { /* Unknown native drag data. */ }
  }
  return null;
}
async function moveItem(event, folderId) {
  const item = getDroppedItem(event);
  if (!item || !game.user?.isGM) return false;
  if (folderId && !getFolder(folderId)) return false;
  if (folderIdOf(item) !== folderId) { arrivingItem = item.id; await item.update({ folder: folderId }); }
  refreshFolderPanels();
  return true;
}
function onDrop(event) {
  const target = event.target.closest?.("[data-buxa-folder], [data-buxa-folder-drop], [data-buxa-folder-panel]");
  if (!target) return;
  event.preventDefault(); event.stopPropagation();
  const folder = getDroppedFolder(event);
  const item = folder ? null : getDroppedItem(event);
  const position = panelPreview?.getTarget();
  panelPreview?.clear(); panelPreview = null;
  panels?.classList.remove("is-reordering");
  target.classList.remove("is-drag-target");
  if (dragTarget === target) dragTarget = null;
  const folderId = target.dataset.buxaFolder || target.dataset.buxaFolderDrop || target.dataset.buxaFolderPanel;
  if (folder) {
    dragFolder = null; dragItem = null;
    if (!canMoveWorldItemFolder(folder, folderId)) { ui.notifications?.warn?.('Cannot move a folder inside itself or its children.'); return; }
    void moveWorldItemFolder(folder, folderId).then(refreshFolderPanels)
      .catch(error => ui.notifications?.error?.(error?.message || 'Could not move folder.'));
    return;
  }
  if (position && item) {
    const targetItem = game.items?.get(position.targetId);
    if (targetItem && targetItem.id !== item.id) {
      void moveSortedWorldItem(item, { folderId: folderIdOf(targetItem), target: targetItem, sortBefore: position.before })
        .then(refreshFolderPanels).catch((error) => { console.warn("Buxa | Reorder failed", error); ui.notifications?.error?.("Could not reorder item."); });
      dragItem = null; return;
    }
  }
  if (dragItem === null && event.dataTransfer?.types && ![...event.dataTransfer.types].some((t) => t === "text/plain" || t === "text")) return;
  void moveItem(event, folderId).catch((error) => { console.warn("Buxa | Item move failed", error); ui.notifications?.error?.("Could not move item."); });
  dragItem = null;
}
export function bindFolderPanels(_directoryResolver, options) {
  api = options;
  document.addEventListener("click", (event) => {
    const target = event.target.closest?.(".buxa-folder-panel button");
    // This document listener must never handle Actor/Scene floating panels.
    if (!target || !panels?.contains(target)) return;
    const container = target.closest("[data-buxa-folder-panel]");
    const currentId = container?.dataset.buxaFolderPanel;
    if (target.matches("[data-buxa-folder-close]")) {
      const index = path.indexOf(currentId); path = path.slice(0, Math.max(0,index));
      renderPanels(); return;
    }
    if (target.matches("[data-buxa-folder-create]")) {
      if (target.dataset.buxaFolderCreate === "folder") api.showCreateFolder(target, currentId);
      else api.showCreateItem(target, currentId);
      return;
    }
    if (target.dataset.buxaFolder) { openFolderPanel(target.dataset.buxaFolder); return; }
    if (target.dataset.buxaItem) { const item=game.items.get(target.dataset.buxaItem); if (item) openBuxaItemSheet(item); }
  });
  document.addEventListener("contextmenu", (event) => {
    const target = event.target.closest?.('.buxa-folder-entry');
    if (!target || !panels?.contains(target)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const item = target.dataset.buxaItem ? game.items.get(target.dataset.buxaItem) : null;
    const folder = target.dataset.buxaFolder ? getFolder(target.dataset.buxaFolder) : null;
    if (item) api.showItemMenu(event, item);
    else if (folder) api.showFolderMenu(event, folder);
  }, true);
  document.addEventListener("dragstart", (event) => {
    const row = event.target.closest?.('.buxa-folder-entry');
    if (!row || !panels?.contains(row)) return;
    const folder = row.classList.contains('is-folder') ? getFolder(row.dataset.buxaFolder) : null;
    if (folder) {
      if (isMainFolder(folder) || !game.user?.isGM) {event.preventDefault();return;}
      dragFolder = folder.id; dragItem = null;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', JSON.stringify({ type: 'Folder', uuid: folder.uuid || `Folder.${folder.id}` }));
    } else {
      const item = game.items?.get(row.dataset.buxaItem);
      if (!item) return;
      dragItem = item.id; dragFolder = null;
      event.dataTransfer.effectAllowed = 'copyMove';
      event.dataTransfer.setData('text/plain', JSON.stringify({ type: 'Item', uuid: item.uuid }));
    }
    panels?.classList.add('is-reordering');
    row.classList.add('is-dragging');
  });
  document.addEventListener("dragend", () => {
    panels?.classList.remove("is-reordering");
    panelPreview?.clear(); panelPreview = null;
    dragItem = null; dragFolder = null;
    if (refreshAfterDrag) { refreshAfterDrag = false; refreshFolderPanels(); }
    dragTarget?.classList.remove("is-drag-target");
    dragTarget = null;
    panels?.querySelectorAll(".is-dragging").forEach((el)=>el.classList.remove("is-dragging"));
  });
  document.addEventListener("dragover", (event) => {
    if (!panels?.contains(event.target)) {
      panelPreview?.clear(); panelPreview = null;
      dragTarget?.classList.remove('is-drag-target'); dragTarget = null;
      panels?.classList.remove('is-reordering');
      return;
    }
    const entry = event.target.closest?.('.buxa-folder-entry.is-item');
    const drop = event.target.closest?.('[data-buxa-folder-drop], .buxa-folder-entry.is-folder, [data-buxa-folder-panel]');
    if (!drop || !game.user?.isGM) {
      // Do not leave a stale insertion line when moving between an open folder
      // panel and the main directory, or across another Foundry window.
      panelPreview?.clear(); panelPreview = null;
      dragTarget?.classList.remove("is-drag-target"); dragTarget = null;
      if (!event.target.closest?.(".buxa-folder-panel")) panels?.classList.remove("is-reordering");
      return;
    }
    const movingFolder = dragFolder ? getFolder(dragFolder) : null;
    if (movingFolder && !canMoveWorldItemFolder(movingFolder, drop.dataset.buxaFolder || drop.dataset.buxaFolderDrop || drop.dataset.buxaFolderPanel)) return;
    event.preventDefault(); event.dataTransfer.dropEffect = 'move';
    panels?.classList.add('is-reordering');
    if (entry && !dragFolder) {
      const container = entry.closest(".buxa-folder-entries");
      if (panelPreview?.container !== container) {
        panelPreview?.clear();
        panelPreview = new DirectoryReorderPreview(container, {
          itemSelector: ".buxa-folder-entry.is-item", rowSelector: ".buxa-folder-entry.is-item"
        });
      }
      panelPreview.update(event, dragItem);
      dragTarget?.classList.remove("is-drag-target"); dragTarget = null;
      return;
    }
    panelPreview?.clear(); panelPreview = null;
    const folder = event.target.closest?.(".buxa-folder-entry.is-folder");
    // Don't flash the entire panel blue when crossing between rows.
    if (dragTarget !== folder) {
      dragTarget?.classList.remove("is-drag-target");
      folder?.classList.add("is-drag-target");
      dragTarget = folder;
    }
  });
  document.addEventListener("dragleave", (event)=>{
    if (!event.relatedTarget?.closest?.("[data-buxa-folder-drop], .buxa-folder-entry.is-folder, [data-buxa-folder-panel]")) {
      dragTarget?.classList.remove("is-drag-target");
      dragTarget = null;
    }
  });
  document.addEventListener("drop", (event) => {
    if (panels?.contains(event.target)) return onDrop(event);
    // A drag from a left panel to empty space in the native Item directory moves
    // it back to the root. Native folder drop targets keep Foundry's own behavior.
    if (dragItem && directory()?.contains(event.target) && !event.target.closest?.('.buxa-world-item-directory, [data-folder-id], li.folder')) {
      event.preventDefault(); event.stopImmediatePropagation();
      void moveItem(event, null).catch((error)=>console.warn("Buxa | Root move failed",error));
      dragItem = null;
    }
  }, true);
  window.addEventListener("resize", () => { if (panels) requestAnimationFrame(layoutPanels); }, { passive: true });
  for (const hook of ["createItem", "updateItem", "deleteItem", "createFolder", "updateFolder", "deleteFolder"]) Hooks.on(hook, refreshFolderPanels);
}
