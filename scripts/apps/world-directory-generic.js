/** Buxa Actor + Scene directories.
 * Reuses the Item directory design, stable drag indicator and native Foundry
 * folder/document collections. DOM is only rebuilt on actual collection changes.
 */
import { MODULE_ID, SETTINGS } from "../core/constants.js";
import { folderIdOf, renderFolderCard, MAIN_FOLDER_COLOR } from "./item-directory-cards.js";
import { DirectoryReorderPreview, byDocumentOrder } from "./item-directory-reorder.js";
import { genericTreeHTML, renderGenericCard, moveWorldDocument } from "./world-directory-shared.js";
import { ensureMainFolder, getMainFolder, isMainFolder, sortMainFirst } from "./directory-main-folder.js";
import { showDirectoryForm, showDirectoryActionMenu, showDirectoryDeleteConfirmation } from "./item-directory-ui.js";
import { beginActorTokenDrag, endActorTokenDrag } from "./actor-token-ghost.js";
import { openActorEditor } from "./document-editor.js";
import { actorCreationChoices, newActorPreset } from "./actor-creation-presets.js";
import { directoryMultiEdit } from "./directory-multi-edit.js";
import { reconcileFolderPanelDOM } from "./folder-panel-dom.js";
import { directoryTabContents, installDirectoryTabs } from "./directory-tabs.js";
import { directoryDropDestination, directoryDropSurface } from "./directory-drop-destination.js";

const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const config = {
  Actor: { tab: "actors", plural: "actors", label: "actor", icon: "fa-users", hooks: ["createActor", "updateActor", "deleteActor"] },
  Scene: { tab: "scenes", plural: "scenes", label: "scene", icon: "fa-map", hooks: ["createScene", "updateScene", "deleteScene"] }
};
const allowed = type => type === "Actor" ? game.user?.isGM || game.user?.can?.("ACTOR_CREATE") : game.user?.isGM || game.user?.can?.("SCENE_CREATE");
const leftMode = () => game.settings?.get?.(MODULE_ID, SETTINGS.SHEET_CONFIG)?.ui?.itemUi?.openFoldersLeft === true;
const visible = doc => doc?.visible !== false;
const hex = (value, fallback) => /^#[0-9a-f]{6}$/i.test(value ?? "") ? value : fallback;
const itemFolder = (doc) => folderIdOf(doc);


class BuxaWorldDirectory {
  constructor(type) {
    this.type = type;
    this.options = config[type];
    this.root = null;
    this.shell = null;
    this.list = null;
    this.expanded = new Set();
    this.mainInitialized = false;
    this.search = "";
    this.searchTimer = null;
    this.sort = "manual";
    this.lastHTML = "";
    this.pending = false;
    this.dragged = null;
    this.preview = null;
    this.panelPreview = null;
    this.panelRoot = null;
    this.path = [];
    this.panelLast = "";
    this.multi = type === "Actor" ? directoryMultiEdit("Actor") : null;
    this.tabs = null;
  }
  getRoot() { return document.querySelector(`#sidebar #${this.options.tab}, #${this.options.tab}.sidebar-tab, [data-tab="${this.options.tab}"].sidebar-tab`); }
  getDocs() { return (this.type === "Actor" ? game.actors?.contents : game.scenes?.contents ?? [])?.filter(visible) ?? []; }
  getFolders() { return (game.folders?.contents ?? []).filter(f => f.type === this.type && visible(f)); }
  getDoc(id) { return this.type === "Actor" ? game.actors?.get(id) : game.scenes?.get(id); }
  getFolder(id) { const f = game.folders?.get(id); return f?.type === this.type ? f : null; }
  isOpen() { return leftMode(); }
  request() {
    if (this.pending) return;
    this.pending = true;
    requestAnimationFrame(() => { this.pending = false; this.render(); this.renderPanels(); });
  }
  render() {
    if (!this.list?.isConnected) return;
    if (this.dragged) { this.dirty = true; return; }
    const main = getMainFolder(this.type);
    if (main && !this.mainInitialized) { this.expanded.add(main.id); this.mainInitialized = true; }
    this.tabs?.refresh();
    const view = directoryTabContents(this.type, this.tabs?.active, this.getFolders(), this.getDocs());
    const html = genericTreeHTML({ type:this.type, docs:view.docs, folders:view.folders, rootFolderId:view.rootFolderId, tabContentsFolderId:view.tabContentsFolderId, query:this.search, sort:this.sort, expanded:this.expanded, left:this.isOpen() });
    if (this.lastHTML !== html) {
      const scroll = this.list.scrollTop;
      this.list.innerHTML = html;
      this.list.scrollTop = scroll;
      this.lastHTML = html;
    }
    this.dirty = false;
    this.multi?.paint();
  }
  mount() {
    const tab = this.getRoot();
    if (!tab) return;
    if (tab !== this.root) {
      this.root?.classList.remove("buxa-dir-active");
      if(this.searchTimer!==null)clearTimeout(this.searchTimer);
      this.searchTimer=null;
      this.closePanels();
      this.root = tab; this.shell = null; this.list = null; this.tabs = null; this.lastHTML = "";
    }
    if (this.shell?.isConnected) return;
    const shell = document.createElement("section");
    shell.className = "buxa-world-item-directory buxa-generic-directory";
    shell.dataset.buxaWorldType = this.type;
    shell.innerHTML = `<div class="buxa-world-toolbar">
      <button type="button" data-buxa-new="doc"><i class="fa-solid ${this.options.icon}"></i>New ${this.options.label}</button>
      <button type="button" data-buxa-new="folder"><i class="fa-solid fa-folder-plus"></i>New folder</button></div>
      <div class="buxa-world-searchbar"><i class="fa-solid fa-magnifying-glass"></i>
      <input type="search" data-buxa-search placeholder="Search ${this.options.plural}..." aria-label="Search ${this.options.plural}" autocomplete="off"/>
      <button type="button" data-buxa-sort title="Sort"><i class="fa-solid fa-grip-lines"></i></button></div>
      <div class="buxa-world-list" data-buxa-dir-root="" role="list"></div>`;
    tab.append(shell); tab.classList.add("buxa-dir-active");
    this.shell = shell;
    this.list = shell.querySelector(".buxa-world-list");
    this.multi?.mount(shell);
    this.preview = new DirectoryReorderPreview(this.list, { itemSelector: "[data-buxa-dir-item]", rowSelector: ".buxa-world-tree-node" });
    shell.querySelector('[data-buxa-search]').value = this.search;
    shell.querySelectorAll('[data-buxa-new]').forEach(button => button.hidden = !allowed(this.type));
    shell.addEventListener("input", event => {
      if (!event.target.matches('[data-buxa-search]')) return;
      this.search = event.target.value;
      if (this.searchTimer !== null) clearTimeout(this.searchTimer);
      // Searching a thousand World documents should not rebuild every folder
      // and multi-select card for each individual key repeat.
      this.searchTimer = setTimeout(() => {
        this.searchTimer = null;
        if (this.shell !== shell || !shell.isConnected) return;
        this.render(); this.list.scrollTop = 0;
      }, 110);
    });
    shell.addEventListener("click", event => this.handleClick(event));
    shell.addEventListener("contextmenu", event => this.handleContext(event), true);
    this.tabs = installDirectoryTabs(shell, this.type, {
      showForm: showDirectoryForm, showMenu: showDirectoryActionMenu,
      getDrag: () => this.dragged,
      onChange: () => { this.lastHTML = ''; this.render(); this.renderPanels(); }
    });
    this.bindDrag(shell);
    this.render();
  }
  handleClick(event) {
    const element = event.target.closest("button");
    if (!element) return;
    if (element.dataset.buxaNew === "doc") return void this.createDocument(element, this.tabs?.active);
    if (element.dataset.buxaNew === "folder") return void this.createFolder(element, this.tabs?.active);
    if (element.matches('[data-buxa-sort]')) {
      this.sort = this.sort === "manual" ? "name" : "manual";
      element.title = `Sort: ${this.sort}`;
      element.querySelector("i").className = this.sort === "manual" ? "fa-solid fa-grip-lines" : "fa-solid fa-arrow-down-a-z";
      this.render(); return;
    }
    if (element.dataset.buxaDirFolder || element.dataset.buxaFolder) {
      const id = element.dataset.buxaDirFolder || element.dataset.buxaFolder;
      if (this.isOpen()) this.openFolder(id);
      else { this.expanded.has(id) ? this.expanded.delete(id) : this.expanded.add(id); this.render(); }
      return;
    }
    const id = element.dataset.buxaDirItem || element.dataset.buxaDoc;
    if (id) this.getDoc(id)?.sheet?.render(true);
  }
  handleContext(event) {
    const row = event.target.closest("[data-buxa-dir-item], [data-buxa-doc], [data-buxa-dir-folder], [data-buxa-folder]");
    if (!row) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const doc = this.getDoc(row.dataset.buxaDirItem || row.dataset.buxaDoc);
    if (doc) return this.documentMenu(event, doc);
    const folder = this.getFolder(row.dataset.buxaDirFolder || row.dataset.buxaFolder);
    if (folder) this.folderMenu(event, folder);
  }
  async createDocument(anchor, folderId = null) {
    if (!allowed(this.type)) return;
    const types = this.type === "Actor" ? Object.keys(CONFIG.Actor?.dataModels ?? {}) : [];
    const choices = actorCreationChoices(types.length ? types : ["character", "npc"]);
    const primary = choices.filter(choice => !choice.other);
    const secondary = choices.filter(choice => choice.other);
    const option = choice => `<option value="${escape(choice.id)}">${escape(choice.label)}</option>`;
    const select = this.type === "Actor" ? `<label>Type<select name="type">${primary.map(option).join("")}${secondary.length ? `<optgroup label="Other D&amp;D actor types">${secondary.map(option).join("")}</optgroup>` : ""}</select></label>` : "";
    showDirectoryForm(anchor, `New ${this.options.label}`, `<label>Name<input name="name" placeholder="New ${this.options.label}" maxlength="120" required/></label>${select}`, async data => {
      const name = String(data.get("name") || "").trim();
      if (!name) throw new Error("Enter a name.");
      const destination = folderId || (await ensureMainFolder(this.type))?.id;
      const payload = { name, ...(destination ? {folder:destination} : {}) };
      if (this.type === "Actor") {
        const selection = String(data.get("type") || choices[0]?.id || "");
        Object.assign(payload, newActorPreset(selection, types.length ? types : ["character", "npc"]));
        await Actor.create(payload);
      } else await Scene.create(payload);
      this.request();
    });
  }
  async createFolder(anchor, folderId = null) {
    if (!allowed(this.type)) return;
    showDirectoryForm(anchor, "New folder", '<label>Name<input name="name" placeholder="New folder" maxlength="80" required/></label><label>Color<input name="color" type="color" value="#789cbd"/></label>', async data => {
      const name = String(data.get("name") || "").trim();
      if (!name) throw new Error("Enter a folder name.");
      const destination = folderId || (await ensureMainFolder(this.type))?.id;
      await Folder.create({ name, type:this.type, color:String(data.get("color") || "#789cbd"), ...(destination ? {folder:destination} : {}) });
      this.request();
    });
  }
  editFolder(anchor, folder) {
    if (!game.user?.isGM || isMainFolder(folder)) return;
    const element = showDirectoryForm(anchor, "Folder", `<label>Name<input name="name" required maxlength="80" value="${escape(folder.name)}"/></label><label>Color<input name="color" type="color" value="${hex(folder.color,"#789cbd")}"/></label>`, async data => {
      await folder.update({ name:String(data.get("name") || "").trim(), color:String(data.get("color")) });
    });
    element.querySelector(".buxa-directory-submit").textContent = "Save";
  }
  documentMenu(event, doc) {
    const actions = [{name:"Open sheet",icon:"fa-eye",run:()=>doc.sheet?.render(true)}];
    if (this.type === "Actor" && game.user?.isGM) actions.push({name:"Edit actor & token",icon:"fa-sliders",run:()=>openActorEditor(doc)});
    if (allowed(this.type)) actions.push({name:"Duplicate",icon:"fa-copy",run: async () => {
      const data = doc.toObject(); delete data._id; delete data.id; delete data._stats;
      const folder = doc.folder?.id || doc.folder || (await ensureMainFolder(this.type))?.id || null;
      await (this.type === "Actor" ? Actor : Scene).create({ ...data, name:`${doc.name} (Copy)`, folder });
    }});
    if (game.user?.isGM) {
      actions.push({name:"Ownership",icon:"fa-users",run:()=>new foundry.applications.apps.DocumentOwnershipConfig({document:doc}).render({force:true})});
      actions.push({name:"Delete",icon:"fa-trash",run:anchor=>showDirectoryDeleteConfirmation(anchor,doc,()=>doc.delete())});
    }
    showDirectoryActionMenu(event,actions);
  }
  folderMenu(event, folder) {
    const actions = [];
    if (this.isOpen()) actions.push({name:"Open",icon:"fa-folder-open",run:()=>this.openFolder(folder.id)});
    if (allowed(this.type)) {
      actions.push({name:`New ${this.options.label}`,icon:"fa-plus",run:a=>this.createDocument(a,folder.id)});
      actions.push({name:"New folder",icon:"fa-folder-plus",run:a=>this.createFolder(a,folder.id)});
    }
    if (game.user?.isGM && !isMainFolder(folder) && folder.flags?.[MODULE_ID]?.directoryTab !== this.type) {
      actions.push({name:"Edit",icon:"fa-palette",run:a=>this.editFolder(a,folder)});
      actions.push({name:"Delete",icon:"fa-trash",run:a=>showDirectoryDeleteConfirmation(a,folder,()=>folder.delete())});
    }
    if (actions.length) showDirectoryActionMenu(event,actions);
  }
  validDrag(data) {
    if (!data) return null;
    if (data.type === this.type && typeof data.uuid === "string" && new RegExp(`^${this.type}\\.[^.]+$`).test(data.uuid)) return this.getDoc(data.uuid.split(".").at(-1));
    return null;
  }
  draggedDocument(event) {
    if (this.dragged?.kind === "doc") return this.getDoc(this.dragged.id);
    try { return this.validDrag(JSON.parse(event.dataTransfer?.getData("text/plain") || "null")); }
    catch { return null; }
  }
  beginDrag(event, source) {
    const row = event.target.closest?.("[data-buxa-dir-item], [data-buxa-doc], [data-buxa-dir-folder], [data-buxa-folder]");
    if (!row) return;
    const id = row.dataset.buxaDirItem || row.dataset.buxaDoc;
    const doc = this.getDoc(id);
    const folder = doc ? null : this.getFolder(row.dataset.buxaDirFolder || row.dataset.buxaFolder);
    // Actors owned by a player can be placed on a Scene even if that player
    // cannot reorder world folders. Folder/Scene dragging remains GM-only.
    if ((!game.user?.isGM && !(this.type === "Actor" && doc?.isOwner)) ||
        (!doc && (!folder || isMainFolder(folder) || folder.flags?.[MODULE_ID]?.directoryTab === this.type))) { event.preventDefault(); return; }
    this.dragged = {kind:doc ? "doc" : "folder", id:(doc || folder).id};
    this.preview?.clear(); this.panelPreview?.clear();
    event.dataTransfer.effectAllowed = doc && this.type === "Actor" ? "copyMove" : "move";
    event.dataTransfer.setData("text/plain", JSON.stringify({type:doc ? this.type : "Folder", uuid:(doc || folder).uuid, id:(doc || folder).id}));
    if (doc && this.type === "Actor") beginActorTokenDrag(doc, event);
    row.classList.add("is-dragging");
    source.classList.add("is-reordering");
  }
  endDrag() {
    if (this.type === "Actor") endActorTokenDrag();
    this.dragged = null;
    this.preview?.clear(); this.panelPreview?.clear();
    this.shell?.classList.remove("is-reordering");
    this.panelRoot?.classList.remove("is-reordering");
    this.list?.classList.remove('is-root-drop-target');
    this.shell?.querySelectorAll(".is-dragging").forEach(e => e.classList.remove("is-dragging"));
    this.panelRoot?.querySelectorAll(".is-dragging").forEach(e => e.classList.remove("is-dragging"));
    if (this.dirty) this.request();
  }
  bindDrag(target, panel = false) {
    target.addEventListener("dragstart", event => this.beginDrag(event,target));
    target.addEventListener("dragend", () => this.endDrag());
    target.addEventListener("dragover", event => {
      if (!game.user?.isGM) return;
      const row = event.target.closest("[data-buxa-dir-item], [data-buxa-doc]");
      const folder = event.target.closest("[data-buxa-dir-folder], [data-buxa-folder], [data-buxa-folder-drop]");
      const root = event.target.closest("[data-buxa-dir-root]");
      if (!row && !folder && !root && !directoryDropSurface(event.target, target, { panel })) return;
      if (!this.dragged && ![...(event.dataTransfer?.types || [])].includes("text/plain")) return;
      event.preventDefault(); event.dataTransfer.dropEffect = "move";
      target.classList.add("is-reordering");
      if (!panel) this.list?.classList.toggle('is-root-drop-target', !row && !folder);
      if (row && this.sort === "manual" && this.dragged?.kind !== "folder") {
        const container = panel ? row.closest(".buxa-folder-entries") : this.list;
        if (panel && this.panelPreview?.container !== container) { this.panelPreview?.clear(); this.panelPreview = new DirectoryReorderPreview(container,{itemSelector:"[data-buxa-doc]",rowSelector:"[data-buxa-doc]"}); }
        (panel ? this.panelPreview : this.preview)?.update(event,this.dragged?.id);
      } else { (panel ? this.panelPreview : this.preview)?.clear(); }
    });
    target.addEventListener('dragleave', event => {
      if (!target.contains(event.relatedTarget)) this.list?.classList.remove('is-root-drop-target');
    });
    target.addEventListener("drop", event => {
      if (!game.user?.isGM) return;
      const over = event.target.closest("[data-buxa-dir-item], [data-buxa-doc], [data-buxa-dir-folder], [data-buxa-folder], [data-buxa-folder-drop], [data-buxa-dir-root]");
      if (!over && !directoryDropSurface(event.target, target, { panel })) return;
      const doc = this.draggedDocument(event);
      let folder = this.dragged?.kind === "folder" ? this.getFolder(this.dragged.id) : null;
      if (!doc && !folder) {
        // External/native folder drags do not set this.dragged.
        try {
          const payload = JSON.parse(event.dataTransfer?.getData('text/plain') || 'null');
          if (payload?.type === 'Folder' && /^Folder\.[^.]+$/.test(payload.uuid || '')) {
            folder = this.getFolder(payload.uuid.slice(7));
          }
        } catch { /* Other Foundry drag payloads are not world folders. */ }
      }
      if (!doc && !folder) return;
      event.preventDefault(); event.stopPropagation();
      const targetPreview = panel ? this.panelPreview?.getTarget() : this.preview?.getTarget();
      const row = event.target.closest("[data-buxa-dir-item], [data-buxa-doc]");
      const targetDoc = targetPreview && row ? this.getDoc(targetPreview.targetId) : null;
      const targetFolder = event.target.closest("[data-buxa-dir-folder], [data-buxa-folder]");
      const panelFolder = event.target.closest("[data-buxa-folder-drop], [data-buxa-folder-panel]");
      const destId = directoryDropDestination({
        activeTab: panel ? null : this.tabs?.active,
        folderId: targetFolder?.dataset.buxaDirFolder || targetFolder?.dataset.buxaFolder,
        panelFolderId: panelFolder?.dataset.buxaFolderDrop || panelFolder?.dataset.buxaFolderPanel,
        targetDocument: targetDoc
      });
      this.endDrag();
      if (doc) {
        void moveWorldDocument(doc,this.type,{folderId:destId,target:targetDoc,before:targetPreview?.before ?? true})
          .then(()=>this.request()).catch(e=>{console.warn("Buxa | Could not move document",e);ui.notifications?.error?.("Move failed.");});
      } else if (folder) {
        if (isMainFolder(folder)) return;
        // Block drops inside itself and descendants, preventing folder cycles.
        let cursor = this.getFolder(destId), loop = false;
        const seen = new Set();
        while (cursor && !seen.has(cursor.id)) { if (cursor.id === folder.id) {loop=true;break;} seen.add(cursor.id); cursor = this.getFolder(folderIdOf(cursor)); }
        if (!loop && folderIdOf(folder) !== destId) void folder.update({folder:destId}).catch(e=>{
          console.error("Buxa | Could not move folder",e);
          globalThis.ui?.notifications?.error?.('Could not move the folder. Check the console.');
        });
      }
    });
  }
  folderChain(id) {
    const path = [], seen = new Set();
    for (let current = this.getFolder(id); current && !seen.has(current.id); current = this.getFolder(folderIdOf(current))) {
      path.unshift(current.id); seen.add(current.id);
    }
    return path;
  }
  openFolder(id) {
    if (!this.isOpen()) return;
    const folder = this.getFolder(id);
    if (!folder) return;
    const index = this.path.indexOf(id);
    this.path = index >= 0 ? this.path.slice(0,index+1) : this.folderChain(id);
    this.panelLast = "";
    this.renderPanels();
  }
  closePanels() {
    this.panelRoot?.remove(); this.panelRoot = null;
    this.panelPreview?.clear(); this.panelPreview = null;
    this.path = []; this.panelLast = "";
  }
  renderPanels() {
    if (!this.path.length || !this.isOpen()) { if (this.panelRoot) this.closePanels(); return; }
    if (!this.root?.classList.contains("active") || !this.root?.isConnected) { this.closePanels(); return; }
    this.path = this.path.filter(id => Boolean(this.getFolder(id)));
    if (!this.path.length) { this.closePanels(); return; }
    const docs = this.getDocs(), folders = this.getFolders();
    const docsByFolder = new Map(), foldersByFolder = new Map();
    for (const entry of docs) {
      const key = folderIdOf(entry);
      if (!docsByFolder.has(key)) docsByFolder.set(key, []);
      docsByFolder.get(key).push(entry);
    }
    for (const entry of folders) {
      const key = folderIdOf(entry);
      if (!foldersByFolder.has(key)) foldersByFolder.set(key, []);
      foldersByFolder.get(key).push(entry);
    }
    const sections = this.path.map((id,index) => {
      const folder = this.getFolder(id);
      const children = [...(foldersByFolder.get(id) || [])].sort(sortMainFirst);
      const entries = [...(docsByFolder.get(id) || [])].sort(byDocumentOrder);
      return `<section class="buxa-folder-panel" data-buxa-folder-panel="${escape(id)}">
        <header class="buxa-folder-header" style="--buxa-folder-accent:${isMainFolder(folder) ? MAIN_FOLDER_COLOR : hex(folder.color,"#789cbd")}">
          <span class="buxa-folder-heading"><i class="fa-solid fa-folder-open"></i><strong>${escape(folder.name)}</strong></span>
          <span class="buxa-folder-heading-actions"><button type="button" data-buxa-panel-action="create" title="New ${this.options.label}"><i class="fa-solid fa-plus"></i></button><button type="button" data-buxa-panel-action="close" title="Close"><i class="fa-solid fa-xmark"></i></button></span></header>
        <div class="buxa-folder-entries" data-buxa-folder-drop="${escape(id)}">
        ${children.map(f => renderFolderCard(f,{panel:true,left:true,count:(docsByFolder.get(f.id)?.length || 0)+(foldersByFolder.get(f.id)?.length || 0)})).join("")}
        ${entries.map(d => renderGenericCard(d,this.type,{panel:true})).join("")}
        ${!children.length&&!entries.length?'<div class="buxa-folder-empty">Empty folder</div>':""}</div>
        <footer class="buxa-folder-footer"><button type="button" data-buxa-panel-action="folder"><i class="fa-solid fa-folder-plus"></i> New folder</button><span>${entries.length} ${this.options.plural}</span></footer></section>`;
    });
    const markup = sections.join("");
    if (markup === this.panelLast && this.panelRoot?.isConnected) return;
    if (!this.panelRoot) {
      this.panelRoot = document.createElement("div"); this.panelRoot.className = "buxa-folder-panels buxa-generic-panels";
      document.body.append(this.panelRoot);
      this.panelRoot.addEventListener("click", event => {
        const button = event.target.closest("button");
        if (!button) return;
        const id = button.closest('[data-buxa-folder-panel]')?.dataset.buxaFolderPanel;
        if (button.dataset.buxaPanelAction === "close") { this.path = this.path.slice(0,this.path.indexOf(id)); this.panelLast=""; this.renderPanels(); return; }
        if (button.dataset.buxaPanelAction === "create") return void this.createDocument(button,id);
        if (button.dataset.buxaPanelAction === "folder") return void this.createFolder(button,id);
        this.handleClick(event);
      });
      this.panelRoot.addEventListener("contextmenu", event=>this.handleContext(event),true);
      this.bindDrag(this.panelRoot,true);
    }
    const changed = reconcileFolderPanelDOM(this.panelRoot,
      this.path.map((id, index) => ({ id, markup: sections[index] })));
    this.panelLast = markup;
    if (changed) { this.panelPreview?.clear(); this.panelPreview = null; }
    this.layoutPanels();
    this.multi?.paint();
  }
  layoutPanels() {
    if (!this.panelRoot || !this.root) return;
    const box = this.root.getBoundingClientRect();
    const width = Math.max(180, Math.min(266, window.innerWidth - 16));
    this.panelRoot.style.setProperty('--buxa-folder-width',`${width}px`);
    const gap = 7;
    [...this.panelRoot.children].forEach((el,index) => {
      const distance = this.path.length - index;
      const wanted = box.left - distance*(width+gap);
      // Constrain to viewport; newer/deeper folders are foremost.
      el.style.left = `${Math.max(8,wanted)}px`;
      el.style.top = `${Math.max(8,Math.min(window.innerHeight-140,box.top+5))}px`;
      el.style.maxHeight = `${Math.max(160,window.innerHeight-20-(box.top+5))}px`;
      el.style.zIndex = String(340+index);
    });
  }
  install() {
    this.mount();
    for (const name of [`render${this.type}Directory`,"renderSidebarTab"]) Hooks.on(name,()=>requestAnimationFrame(()=>this.mount()));
    for (const name of [...this.options.hooks,"createFolder","updateFolder","deleteFolder"]) Hooks.on(name,()=>this.request());
    Hooks.on("updateSetting",()=>this.request());
    document.addEventListener("click",event=>{
      const tab = event.target.closest?.('#sidebar [data-tab]');
      if (tab && tab.dataset.tab !== this.options.tab && !tab.closest?.(`#${this.options.tab}`)) this.closePanels();
    });
    document.addEventListener("keydown",event=>{ if (event.key === "Escape") this.closePanels(); });
    document.addEventListener("dragend",()=>{ if (this.dragged) this.endDrag(); });
    window.addEventListener("resize",()=>this.layoutPanels(),{passive:true});
  }
}

export function installWorldDirectories() {
  for (const type of ["Actor","Scene"]) new BuxaWorldDirectory(type).install();
}
