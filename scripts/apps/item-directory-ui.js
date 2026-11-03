/** Buxa World Item directory enhancements.  Never replaces Foundry documents,
 * directory search, permissions, or the core drag data format. */
import { MODULE_ID } from "../core/constants.js";
import { getItemKind } from "../core/effect-config.js";
import { getSheetConfig } from "../core/config.js";
import { openBuxaItemSheet } from "./item-sheet.js";
import { bindFolderPanels, closeFolderPanels, openFolderPanel, refreshFolderPanels } from "./item-folder-panels.js";
import { ensureMainFolder, getMainFolder, isMainFolder, sortMainFirst } from "./directory-main-folder.js";
import { installBuxaItemDirectory } from "./item-directory-view.js";
import { canMoveWorldItemFolder, moveWorldItemFolder } from "./item-directory-folder-move.js";
import { trashcanState, trashcanSelectMainItem } from "./gm-trashcan.js";

const esc = (value) => foundry.utils.escapeHTML(String(value ?? ""));
let popup = null;
let previousFocus = null;
const doc = () => globalThis.document;
const directory = () => doc()?.querySelector('#sidebar #items, #items.sidebar-tab, [data-tab="items"].sidebar-tab');
const foldersLeft = () => game.settings?.get?.(MODULE_ID, "sheetConfig")?.ui?.itemUi?.openFoldersLeft === true;
const canCreate = () => game.user?.isGM || game.user?.can?.("ITEM_CREATE");

export function closeDirectoryPopup() {
  popup?.remove();
  popup = null;
  const prior = previousFocus;
  previousFocus = null;
  if (prior?.isConnected) prior.focus?.({ preventScroll: true });
}

function placePopup(popup, anchor) {
  const box = anchor?.getBoundingClientRect?.() ?? { left: 24, right: 200, top: 60, bottom: 90 };
  const width = popup.offsetWidth || 290;
  const height = popup.offsetHeight || 225;
  const vw = window.innerWidth, vh = window.innerHeight;
  popup.style.left = `${Math.max(8, Math.min(vw - width - 8, box.right - width))}px`;
  popup.style.top = `${Math.max(8, Math.min(vh - height - 8, box.bottom + 6))}px`;
}

/** A lightweight anchored form, not a blocking DialogV2. */
export function showDirectoryForm(anchor, title, body, save) {
  closeDirectoryPopup();
  previousFocus = anchor instanceof HTMLElement ? anchor : null;
  const element = doc().createElement("form");
  element.className = "buxa-directory-popover";
  element.innerHTML = `<div class="buxa-directory-popover-title">${esc(title)}<button type="button" data-buxa-cancel title="Close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div>${body}<footer><button type="button" data-buxa-cancel>Cancel</button><button class="buxa-directory-submit" type="submit">Create</button></footer>`;
  doc().body.append(element);
  popup = element;
  placePopup(element, anchor);
  element.querySelector('[name="name"]')?.focus();
  element.addEventListener("click", (event) => { if (event.target.closest("[data-buxa-cancel]")) closeDirectoryPopup(); });
  element.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (element.dataset.saving) return;
    element.dataset.saving = "1";
    element.querySelector('button[type="submit"]').disabled = true;
    try { await save(new FormData(element)); closeDirectoryPopup(); }
    catch (error) {
      console.error("Buxa | Directory creation failed", error);
      ui.notifications?.error?.(error?.message || "Could not create entry.");
      delete element.dataset.saving;
      element.querySelector('button[type="submit"]').disabled = false;
    }
  });
  return element;
}

export function showCreateItem(anchor, folderId = null) {
  if (!canCreate()) return;
  const config = getSheetConfig();
  const types = Object.keys(CONFIG.Item?.dataModels ?? {});
  const allowed = types.length ? types : ["tool"];
  const defaultType = allowed.includes("tool") ? "tool" : allowed[0];
  const rarities = config.items.rarities;
  // Foundry requires a system document type internally. Buxa's visible item
  // category is a free-form label managed only in Item Configuration.
  const body = `<label>Kind<select name="itemKind"><option value="item">Item</option><option value="magic">Magic</option><option value="effect">Effect</option></select></label><label>Name<input name="name" maxlength="120" required autocomplete="off" placeholder="New item"></label>
    <label>Rarity<select name="rarityId">${rarities.map((rarity) => `<option value="${esc(rarity.id)}" ${rarity.id === "common" ? "selected" : ""}>${esc(rarity.label)}</option>`).join("")}</select></label>`;
  return showDirectoryForm(anchor, "Create item", body, async (data) => {
    const name = String(data.get("name") || "").trim();
    const rarityId = String(data.get("rarityId") || "common");
    const itemKind = ["item","magic","effect"].includes(data.get("itemKind")) ? data.get("itemKind") : "item";
    if (!name) throw new Error("Provide a valid item name.");
    if (!rarities.some((rarity) => rarity.id === rarityId)) throw new Error("Choose a valid rarity.");
    const destination = folderId || (await ensureMainFolder("Item"))?.id;
    const item = await Item.create({ name, type: defaultType, ...(destination ? { folder: destination } : {}), flags: { [MODULE_ID]: { itemKind, item: { rarityId }, ...(itemKind === "effect" ? { effect: {rarityId} } : {}) } } });
    if (item) refreshFolderPanels();
  });
}

export function showCreateFolder(anchor, folderId = null) {
  if (!canCreate()) return;
  return showDirectoryForm(anchor, "Create folder", `<label>Name<input name="name" maxlength="80" required autocomplete="off" placeholder="New folder"></label><label>Color<input name="color" type="color" value="#668eb7"></label>`, async (data) => {
    const name = String(data.get("name") || "").trim();
    const color = String(data.get("color") || "#668eb7");
    if (!name) throw new Error("Enter a folder name.");
    const destination = folderId || (await ensureMainFolder("Item"))?.id;
    await Folder.create({ name, type: "Item", color, ...(destination ? { folder: destination } : {}) });
    refreshFolderPanels();
  });
}

export function showEditFolder(anchor, folder) {
  if (!game.user?.isGM || !folder || isMainFolder(folder)) return;
  const element = showDirectoryForm(anchor, "Folder", `<label>Name<input name="name" maxlength="80" required value="${esc(folder.name)}"></label><label>Color<input name="color" type="color" value="${esc(folder.color || "#668eb7")}"></label>`, async (data) => {
    await folder.update({ name: String(data.get("name") || "").trim(), color: String(data.get("color")) });
    refreshFolderPanels();
  });
  element.querySelector('.buxa-directory-submit').textContent = "Save";
  return element;
}

function folderFrom(target) {
  const entry = target?.closest?.('[data-buxa-dir-folder], [data-folder-id], li.folder');
  return entry ? game.folders?.get(entry.dataset.buxaDirFolder ?? entry.dataset.folderId ?? entry.dataset.entryId) : null;
}
function itemFrom(target) {
  const entry = target?.closest?.('[data-buxa-dir-item], [data-entry-id], [data-document-id], li.document.item');
  return entry ? game.items?.get(entry.dataset.buxaDirItem ?? entry.dataset.entryId ?? entry.dataset.documentId) : null;
}
function isItemsDirectory(target) { return Boolean(directory()?.contains(target)); }
function isFolderClick(target) {
  return Boolean(target.closest?.('.folder-header, [data-action="toggleFolder"], [data-action="toggle-folder"], .folder > .folder-header'));
}

export function showDirectoryActionMenu(anchorEvent, options) {
  closeDirectoryPopup();
  const element = doc().createElement("div");
  element.className = "buxa-directory-popover buxa-directory-actions";
  element.setAttribute("role", "menu");
  for (const option of options) {
    const button = doc().createElement("button");
    button.type = "button";
    button.innerHTML = `<i class="fa-solid ${esc(option.icon)}"></i><span>${esc(option.name)}</span>`;
    button.addEventListener("click", async () => {
      const bounds = button.getBoundingClientRect();
      const anchor = { getBoundingClientRect: () => bounds };
      closeDirectoryPopup();
      try { await option.run(anchor); } catch (error) {
        console.error("Buxa | Directory action failed", error);
        ui.notifications?.error?.(error?.message || "Action failed.");
      }
    });
    element.append(button);
  }
  doc().body.append(element);
  popup = element;
  const width = element.offsetWidth || 205;
  const height = element.offsetHeight || 180;
  element.style.left = `${Math.max(8, Math.min(window.innerWidth - width - 8, anchorEvent.clientX))}px`;
  element.style.top = `${Math.max(8, Math.min(window.innerHeight - height - 8, anchorEvent.clientY))}px`;
}


/** Lightweight Buxa confirmation; deliberately not a Foundry DialogV2 modal. */
export function showDirectoryDeleteConfirmation(anchor, entity, onDelete) {
  closeDirectoryPopup();
  previousFocus = anchor instanceof HTMLElement ? anchor : null;
  const element = doc().createElement("div");
  element.className = "buxa-directory-popover buxa-directory-confirm";
  element.setAttribute("role", "alertdialog");
  element.setAttribute("aria-label", `Delete ${entity?.name ?? "entry"}`);
  element.innerHTML = `<p>Delete <strong>${esc(entity?.name ?? "entry")}</strong>?</p>
    <footer><button type="button" data-buxa-cancel>Cancel</button><button type="button" class="is-danger" data-buxa-confirm-delete>Delete</button></footer>`;
  doc().body.append(element);
  popup = element;
  placePopup(element, anchor);
  element.querySelector('[data-buxa-cancel]').focus({ preventScroll: true });
  element.addEventListener("click", async (event) => {
    if (event.target.closest('[data-buxa-cancel]')) { closeDirectoryPopup(); return; }
    if (!event.target.closest('[data-buxa-confirm-delete]') || element.dataset.saving) return;
    element.dataset.saving = "1";
    element.querySelector('[data-buxa-confirm-delete]').disabled = true;
    try { await onDelete(); closeDirectoryPopup(); refreshFolderPanels(); }
    catch (error) {
      console.warn("Buxa | Could not delete world entry", error);
      ui.notifications?.error?.("Could not delete entry.");
      delete element.dataset.saving;
      element.querySelector('[data-buxa-confirm-delete]').disabled = false;
    }
  });
  return element;
}
function showItemMenu(event, item) {
  const actions = [
    { name: "Edit", icon: "fa-pen-to-square", run: () => openBuxaItemSheet(item) }
  ];
  if (canCreate()) actions.push({ name: "Duplicate", icon: "fa-copy", run: async () => {
    const data = item.toObject(); delete data._id; delete data.id; delete data._stats;
    const folder = item.folder?.id || item.folder || (await ensureMainFolder("Item"))?.id || null;
    await Item.create({ ...data, name: `${item.name} (Copy)`, folder }); refreshFolderPanels();
  } });
  if (game.user?.isGM) {
    actions.push({ name: "Ownership", icon: "fa-users", run: () => {
      const config = foundry.applications.apps.DocumentOwnershipConfig;
      if (!config) throw new Error("Ownership editor is unavailable.");
      return new config({ document: item }).render({ force: true });
    } });
    actions.push({ name: "Delete", icon: "fa-trash", run: (anchor) => showDirectoryDeleteConfirmation(anchor, item, () => item.delete()) });
  }
  showDirectoryActionMenu(event, actions);
}
function showMoveFolder(anchor, folder) {
  const entries = (game.folders?.contents ?? []).filter(entry => entry.type === 'Item' && canMoveWorldItemFolder(folder, entry.id));
  entries.sort(sortMainFirst);
  const currentParent = typeof folder.folder === 'string' ? folder.folder : folder.folder?.id || getMainFolder('Item')?.id || null;
  const select = `<label>Move to<select name="destination">${entries.map(entry => `<option value="${esc(entry.id)}" ${entry.id === currentParent ? 'selected' : ''}>${esc(entry.name)}</option>`).join('')}</select></label>`;
  const element = showDirectoryForm(anchor, `Move ${folder.name}`, select, async data => {
    const destination = String(data.get('destination') || '') || (await ensureMainFolder('Item'))?.id || null;
    await moveWorldItemFolder(folder, destination);
    refreshFolderPanels();
  });
  element.querySelector('.buxa-directory-submit').textContent = 'Move';
  return element;
}

function showFolderMenu(event, folder) {
  const actions = foldersLeft() ? [{ name: "Open", icon: "fa-folder-open", run: () => openFolderPanel(folder.id) }] : [];
  if (canCreate()) {
    actions.push({ name: "Create item", icon: "fa-plus", run: (anchor) => showCreateItem(anchor, folder.id) });
    actions.push({ name: "Create folder", icon: "fa-folder-plus", run: (anchor) => showCreateFolder(anchor, folder.id) });
  }
  if (game.user?.isGM && !isMainFolder(folder) && folder.flags?.[MODULE_ID]?.directoryTab !== 'Item') {
    actions.push({ name: "Edit color / name", icon: "fa-palette", run: (anchor) => showEditFolder(anchor, folder) });
    actions.push({ name: "Move folder", icon: "fa-folder-tree", run: (anchor) => showMoveFolder(anchor, folder) });
    actions.push({ name: "Delete", icon: "fa-trash", run: (anchor) => showDirectoryDeleteConfirmation(anchor, folder, () => folder.delete()) });
  }
  showDirectoryActionMenu(event, actions);
}

/** One capture listener per document, so rerendering the sidebar doesn't leak handlers. */
export function installItemDirectoryUI() {
  if (doc()?.documentElement?.dataset.buxaDirectoryInstalled) return;
  doc().documentElement.dataset.buxaDirectoryInstalled = "1";
  bindFolderPanels(directory, { showCreateItem, showCreateFolder, showEditFolder, showItemMenu, showFolderMenu });
  installBuxaItemDirectory({ showCreateItem, showCreateFolder, openFolderPanel, showDirectoryForm, showDirectoryActionMenu });

  // Capture before Buxa/Foundry item-open handlers. In Main selection mode,
  // clicking a world Item only toggles its deletion selection.
  doc().addEventListener('click', event => {
    if (!game.user?.isGM || !trashcanState().mainSelecting) return;
    const card = event.target.closest?.('[data-buxa-dir-item], .buxa-folder-entry.is-item[data-buxa-item]');
    if (!card || !card.closest('.buxa-world-item-directory, .buxa-folder-panels')) return;
    event.preventDefault(); event.stopImmediatePropagation();
    trashcanSelectMainItem(card.dataset.buxaDirItem || card.dataset.buxaItem);
  }, true);
  doc().addEventListener("click", (event) => {
    if (popup && !popup.contains(event.target)) closeDirectoryPopup();
    if (!isItemsDirectory(event.target) || !canCreate()) {
      // Folder opening is available independently of item creation permissions.
      if (foldersLeft() && isItemsDirectory(event.target) && isFolderClick(event.target)) {
        const folder = folderFrom(event.target);
        if (folder) { event.preventDefault(); event.stopImmediatePropagation(); openFolderPanel(folder.id); }
      }
      return;
    }
    const action = event.target.closest?.('[data-action="createEntry"], [data-action="createFolder"], [data-action="create-entry"], [data-action="create-folder"]');
    if (action) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (/folder/i.test(action.dataset.action)) showCreateFolder(action);
      else showCreateItem(action);
      return;
    }
    if (foldersLeft() && isFolderClick(event.target)) {
      const folder = folderFrom(event.target);
      if (folder) { event.preventDefault(); event.stopImmediatePropagation(); openFolderPanel(folder.id); }
    }
  }, true);
  doc().addEventListener("contextmenu", (event) => {
    if (!isItemsDirectory(event.target)) return;
    const item = itemFrom(event.target);
    const folder = item ? null : folderFrom(event.target);
    if (!folder && !item) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (folder) showFolderMenu(event, folder); else showItemMenu(event, item);
  }, true);
  doc().addEventListener("keydown", (event) => { if (event.key === "Escape") { closeDirectoryPopup(); closeFolderPanels(); } });
  doc().addEventListener("click", (event) => {
    const otherTab = event.target.closest?.('#sidebar [data-tab]');
    if (otherTab && !isItemsDirectory(otherTab) && otherTab.dataset.tab !== "items" && !otherTab.closest?.("#items")) closeFolderPanels();
  });
  Hooks.on("updateSetting", (setting) => {
    if (setting?.key === `${MODULE_ID}.sheetConfig` && !foldersLeft()) closeFolderPanels();
  });
  Hooks.on("renderItemDirectory", () => refreshFolderPanels());

  // Also override the v14 entry creation methods: these are dispatched by the
  // ApplicationV2 action handlers and may not always originate from a DOM click.
  const proto = foundry.applications.sidebar.tabs.ItemDirectory?.prototype;
  if (proto && !proto._buxaDirectoryPatched) {
    Object.defineProperty(proto, "_buxaDirectoryPatched", { value: true });
    const entry = proto._onCreateEntry;
    const folder = proto._onCreateFolder;
    if (typeof entry === "function") proto._onCreateEntry = function(event, target) {
      if (!canCreate()) return entry.call(this, event, target);
      event?.preventDefault?.(); showCreateItem(target || event?.currentTarget || this.element);
    };
    if (typeof folder === "function") proto._onCreateFolder = function(event, target) {
      if (!canCreate()) return folder.call(this, event, target);
      event?.preventDefault?.(); showCreateFolder(target || event?.currentTarget || this.element);
    };
    // Prevent core's default context menu from offering duplicate menu items.
    const itemOptions = proto._getEntryContextOptions;
    const folderOptions = proto._getFolderContextOptions;
    if (typeof itemOptions === "function") proto._getEntryContextOptions = function(...args) {
      const options = itemOptions.apply(this, args);
      return Array.isArray(options) ? options.filter((option) => !/import|export/i.test(String(option.name ?? ""))) : options;
    };
    if (typeof folderOptions === "function") proto._getFolderContextOptions = function(...args) {
      const options = folderOptions.apply(this, args);
      return Array.isArray(options) ? options.filter((option) => !/import|export/i.test(String(option.name ?? ""))) : options;
    };
  }
}
