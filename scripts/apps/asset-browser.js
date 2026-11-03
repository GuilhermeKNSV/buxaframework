/** Buxa image library. Rebuilt independently; the legacy manager is not imported. */
import { enableWindowResize } from "./window-resize.js";
import { notifyError } from "../core/notifications.js";
import { TEMPLATE_PATHS, MODULE_ID, SETTINGS } from "../core/constants.js";
import { getSheetConfig } from "../core/config.js";
import { collectGalleryTree } from "../core/asset-browser-scan.js";
import {
  LIBRARY_SOURCES, acceptedAsset, assetCrumbs, assetEntries, assetExtension, isBrowsableAssetFolder,
  assetName, assetParent, cleanAssetPath, collectUsedAssetPaths,
  filterAssetItems, normalizeAssetFavorites, toggleAssetFavorite, visibleAssetFolders
} from "../core/asset-browser-model.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const FilePicker = foundry.applications.apps.FilePicker;
let favoritesWriteQueue = Promise.resolve();
const IMAGE_EXTENSIONS = Object.keys(CONST?.IMAGE_FILE_EXTENSIONS ?? {
  png: true, jpg: true, jpeg: true, gif: true, svg: true, webp: true, avif: true, apng: true, bmp: true, tiff: true
});

function route(path) {
  const raw = String(path || "");
  if (/^(?:https?:|data:|blob:)/i.test(raw) || raw.startsWith("/")) return raw;
  try { return foundry.utils.getRoute(raw); }
  catch { return `/${raw}`; }
}

function configuredLocation() {
  const value = getSheetConfig()?.addons?.iconSource ?? {};
  return { source: LIBRARY_SOURCES.includes(value.source) ? value.source : "data",
    path: isBrowsableAssetFolder(value.path) ? cleanAssetPath(value.path) : "" };
}

function defaultLocation({ source, target, current, allowDirectorySelect }) {
  // Artwork picking always starts at Addons → Icon source, irrespective of the
  // current artwork or any stale source/path supplied by its caller.
  // Choosing that source folder itself is different: preserve the unsaved
  // directory selection so the GM can browse or change it before saving.
  const configured = configuredLocation();
  const directoryPicker = Boolean(allowDirectorySelect);
  return {
    source: directoryPicker && LIBRARY_SOURCES.includes(source) ? source : configured.source,
    target: directoryPicker && target != null && isBrowsableAssetFolder(target) ? cleanAssetPath(target) : configured.path,
    current: cleanAssetPath(current)
  };
}

/** Read-only image browser. Favorites only update the current client's settings. */
export class BuxaAssetBrowser extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "buxa-asset-browser",
    classes: ["buxa", "buxa-asset-browser-app"],
    tag: "div",
    position: { width: 1050, height: 720 },
    window: { title: "Buxa · Image Library", icon: "fa-solid fa-images", resizable: true },
    actions: {
      changeSource: BuxaAssetBrowser.#changeSource,
      browseDirectory: BuxaAssetBrowser.#browseDirectory,
      toggleFolder: BuxaAssetBrowser.#toggleFolder,
      goUp: BuxaAssetBrowser.#goUp,
      goHome: BuxaAssetBrowser.#goHome,
      showMore: BuxaAssetBrowser.#showMore,
      selectAsset: BuxaAssetBrowser.#selectAsset,
      chooseAsset: BuxaAssetBrowser.#chooseAsset,
      chooseDirectory: BuxaAssetBrowser.#chooseDirectory,
      clearAsset: BuxaAssetBrowser.#clearAsset,
      favoriteFolder: BuxaAssetBrowser.#favoriteFolder,
      favoriteImage: BuxaAssetBrowser.#favoriteImage,
      setCollection: BuxaAssetBrowser.#setCollection,
      refreshAssets: BuxaAssetBrowser.#refreshAssets
    }
  };
  static PARTS = { body: { template: TEMPLATE_PATHS.ASSET_BROWSER } };

  constructor({ current = "", target = null, source = null, type = "image", extensions = null,
    title = "", allowClear = true, allowDirectorySelect = false, onSelect, ...options } = {}) {
    super({ id: `buxa-asset-browser-${foundry.utils.randomID(7).toLowerCase()}`, ...options });
    const location = defaultLocation({ source, target, current, allowDirectorySelect });
    this._source = location.source;
    this._target = location.target;
    this._home = configuredLocation();
    this._selected = location.current;
    this._preview = location.current;
    this._initial = location.current;
    this._query = "";
    this._collection = "all";
    this._extensions = (extensions?.length ? extensions : IMAGE_EXTENSIONS).map((ext) => String(ext).replace(/^\./, "").toLowerCase());
    this._allowClear = Boolean(allowClear);
    this._allowDirectorySelect = Boolean(allowDirectorySelect);
    this._onSelect = typeof onSelect === "function" ? onSelect : null;
    this._customTitle = String(title || "").trim();
    this._caches = { data: new Map(), public: new Map() };
    this._expanded = new Set([this._target]);
    this._galleryFiles = [];
    this._galleryBusy = true;
    this._galleryPending = true;
    this._gallerySeq = 0;
    this._galleryJob = null;
    this._galleryStatus = "Loading folders...";
    this._visibleCount = 180;
    this._used = new Map();
    this._favoriteWrite = Promise.resolve();
    this._searchTimer = null;
    this._previewTimer = null;
    this._disposed = false;
  }

  async _onClose(options) {
    // A pending FilePicker response must never reopen the closed image window.
    this._disposed = true;
    ++this._gallerySeq;
    if (this._searchTimer) clearTimeout(this._searchTimer);
    if (this._previewTimer) clearTimeout(this._previewTimer);
    this._previewTimer = null;
    this._searchTimer = null;
    if (typeof super._onClose === 'function') await super._onClose(options);
  }

  get title() { return this._customTitle || "Buxa · Image Library"; }

  async _preFirstRender(context, options) {
    await super._preFirstRender(context, options);
    this._used = collectUsedAssetPaths(game);
    await this.#browse(this._target, { render: false });
  }

  #cache() { return this._caches[this._source]; }

  async #getListing(path, { fresh = false } = {}) {
    if (!isBrowsableAssetFolder(path)) throw Error('This is not a valid FilePicker folder.');
    const target = cleanAssetPath(path);
    const source = this._source;
    const cache = this._caches[source];
    if (!fresh && cache.has(target)) return cache.get(target);
    // The native FilePicker API is the only authority for file and folder listings.
    const result = await FilePicker.browse(source, target);
    const node = {
      path: cleanAssetPath(result?.target ?? target),
      dirs: assetEntries(result?.dirs),
      files: assetEntries(result?.files).filter((file) => acceptedAsset(file.path, this._extensions))
    };
    cache.set(target, node);
    cache.set(node.path, node);
    // LRU-like insertion-order bound: prevent a marathon asset-browse session
    // from retaining every large directory response indefinitely.
    while (cache.size > 256) cache.delete(cache.keys().next().value);
    return node;
  }

  async #browse(path, { render = true } = {}) {
    const target = cleanAssetPath(path);
    if (this._disposed) return false;
    // Every folder change invalidates the previous recursive directory walk.
    const sequence = ++this._gallerySeq;
    const previous = { busy:this._galleryBusy, pending:this._galleryPending,
      files:this._galleryFiles, status:this._galleryStatus, target:this._target };
    this._galleryPending = true;
    this._galleryBusy = true;
    this._galleryFiles = [];
    this._galleryStatus = "Loading folders...";
    this._visibleCount = 180;
    try {
      const node = await this.#getListing(target);
      if (sequence !== this._gallerySeq || this._disposed) return;
      this._target = node.path;
      this._expanded.add(this._target);
      this._query = "";
      if (render) await this.render({ force: true });
      return true;
    } catch (error) {
      if (sequence !== this._gallerySeq || this._disposed) return;
      this._galleryBusy = previous.busy;
      // An old scan was cancelled by the new sequence; restart it rather than
      // leaving the gallery in a permanently busy state on navigation failure.
      this._galleryPending = previous.pending || previous.busy;
      this._galleryFiles = previous.files;
      this._galleryStatus = `Could not open ${target || 'Root'}; showing previous folder.`;
      console.error("buxaframework | Image library browse failed", error);
      notifyError(`Cannot open image folder: ${target || "Root"}`);
      if (render) await this.render({force:true});
      return false;
    }
  }

  #rootFolder() {
    const config = configuredLocation();
    if (config.source === this._source && (!config.path || this._target === config.path || this._target.startsWith(`${config.path}/`))) {
      return config.path;
    }
    return this._target && this.#cache().has(assetParent(this._target)) ? assetParent(this._target) : this._target;
  }

  #favorites() {
    try { return normalizeAssetFavorites(game.settings.get(MODULE_ID, SETTINGS.ASSET_FAVORITES)); }
    catch { return normalizeAssetFavorites({}); }
  }

  #entries() {
    const favorite = this.#favorites()[this._source];
    // All collection filters operate on the current folder AND its descendants.
    // Filtering is local to the async tree index; no extra API scan per keystroke.
    return filterAssetItems(this._galleryFiles, {
      query: this._query, mode: this._collection,
      favoritePaths: favorite.images, used: this._used
    });
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const favorites = this.#favorites()[this._source];
    const root = this.#rootFolder();
    const folderRows = visibleAssetFolders(root, this.#cache(), this._expanded, this._target).map((row) => ({
      ...row, favorite: favorites.folders.includes(row.path),
      indent: Math.min(row.depth, 22) * 15,
      hasChildren: (this.#cache().get(row.path)?.dirs.length ?? 0) > 0,
      notLoaded: !row.loaded
    }));
    const previewPath = this._preview || this._selected;
    const entries = this.#entries();
    const visible = entries.slice(0, this._visibleCount).map((file) => ({
      ...file, src: route(file.src), selected: file.path === this._selected,
      favorite: favorites.images.includes(file.path), used: this._used.has(file.path),
      usedBy: [...(this._used.get(file.path) || [])].slice(0, 3).join(", "),
      svg: assetExtension(file.path) === "svg"
    }));
    return {
      ...context,
      isData: this._source === "data", isPublic: this._source === "public",
      isDirectoryPicker: this._allowDirectorySelect, allowDirectorySelect: this._allowDirectorySelect,
      allowClear: this._allowClear,
      target: this._target, breadcrumbs: assetCrumbs(this._target),
      homePath: this._home.path || "Root", homeSource: this._home.source,
      isAtHome: this._source === this._home.source && this._target === this._home.path,
      folders: folderRows,
      favoriteFolders: favorites.folders.map((path) => ({ path, name: assetName(path), active: path === this._target })),
      favoriteImages: favorites.images.map((path) => ({ path, name: assetName(path) })),
      files: visible, previewPath, previewName: assetName(previewPath) || "Select an image",
      previewSrc: route(previewPath), previewSvg: assetExtension(previewPath) === "svg",
      previewUsedBy: [...(this._used.get(previewPath) || [])].slice(0, 5).join(", "),
      previewFavorite: favorites.images.includes(previewPath),
      selected: this._selected, query: this._query, searchBusy: this._galleryBusy,
      galleryStatus: this._galleryStatus, hasMore: visible.length < entries.length,
      displayedCount: visible.length, count: entries.length,
      isAll: this._collection === "all", isFavorites: this._collection === "favorites",
      isUsed: this._collection === "used", isUnused: this._collection === "unused"
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    enableWindowResize(this);
    const root = this.element;
    root.querySelector("[data-asset-search]")?.addEventListener("input", (event) => {
      this._query = event.target.value.trim();
      this._visibleCount = 180;
      if(this._searchTimer) clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(() => {
        this._searchTimer = null;
        void this.#renderKeepSearch().catch(error => console.warn('Buxa asset search failed',error));
      }, 120);
    });
    for (const tile of root.querySelectorAll("[data-asset-preview-path]")) {
      const show = () => {
        if (this._previewTimer) clearTimeout(this._previewTimer);
        this._previewTimer = setTimeout(() => {
          this._previewTimer = null;
          if (!this._disposed && tile.isConnected) this.#showPreview(tile.dataset.assetPreviewPath);
        }, 65);
      };
      tile.addEventListener("pointerenter", show);
      tile.addEventListener("focus", () => {
        if (this._previewTimer) clearTimeout(this._previewTimer);
        this._previewTimer = null;
        this.#showPreview(tile.dataset.assetPreviewPath);
      });
      // Foundry's delegated action click does not consistently preserve
      // MouseEvent.detail across ApplicationV2 render cycles. A native dblclick
      // commits the actual tile without requiring the Use Image button.
      tile.querySelector("[data-action='selectAsset']")?.addEventListener("dblclick", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!this._allowDirectorySelect) void this.#commit(tile.dataset.assetPreviewPath);
      });
    }
    for (const image of root.querySelectorAll("[data-asset-thumb-img]")) {
      image.addEventListener("error", () => image.closest(".buxa-asset-tile")?.classList.add("is-broken"));
    }
    const previewImg = root.querySelector("[data-asset-preview]");
    if (previewImg) {
      previewImg.addEventListener("error", () => { previewImg.hidden = true; root.querySelector("[data-asset-preview-placeholder]")?.removeAttribute("hidden"); });
    }
    if (this._galleryPending) this.#startGalleryScan();
  }

  #showPreview(path) {
    const clean = cleanAssetPath(path);
    if (!clean) return;
    this._preview = clean;
    const root = this.element;
    const image = root?.querySelector("[data-asset-preview]");
    if (image) { image.src = route(clean); image.alt = assetName(clean); image.hidden = false; }
    const placeholder = root?.querySelector("[data-asset-preview-placeholder]");
    if (placeholder) placeholder.hidden = true;
    const title = root?.querySelector("[data-asset-preview-name]");
    if (title) title.textContent = assetName(clean);
    const location = root?.querySelector("[data-asset-preview-location]");
    if (location) location.textContent = clean;
    const usedBy = root?.querySelector("[data-asset-preview-used]");
    if (usedBy) { usedBy.textContent = [...(this._used.get(clean) || [])].slice(0, 5).join(", "); usedBy.hidden = !this._used.has(clean); }
    const fav = root?.querySelector("[data-action='favoriteImage'][data-preview-favorite]");
    if (fav) { fav.dataset.path = clean; fav.classList.toggle("is-favorite", this.#favorites()[this._source].images.includes(clean)); }
    root?.querySelector(".buxa-asset-preview-stage")?.classList.toggle("is-svg", assetExtension(clean) === "svg");
  }

  /** Index files from every nested folder without blocking the first render. */
  #startGalleryScan() {
    this._galleryPending = false;
    const sequence = this._gallerySeq;
    const source = this._source;
    const root = this._target;
    this._galleryJob = (async () => {
      const result = await collectGalleryTree(root, (path) => this.#getListing(path), {
        cancelled: () => this._disposed || sequence !== this._gallerySeq || source !== this._source,
        onProgress: ({ folders, images }) => {
          if (sequence !== this._gallerySeq || this._disposed) return;
          this._galleryStatus = `Scanning ${folders} folders · ${images} images`;
          const status = this.element?.querySelector("[data-asset-status]");
          if (status) status.textContent = this._galleryStatus;
        }
      });
      if (result.cancelled || this._disposed || sequence !== this._gallerySeq) return;
      this._galleryFiles = result.files;
      this._galleryBusy = false;
      this._galleryStatus = `${result.folders} folders scanned`;
      if (result.failures) this._galleryStatus += ` · ${result.failures} inaccessible`;
      if (result.truncated) this._galleryStatus += ' · partial results (gallery safety limit reached)';
      await this.#renderKeepScroll();
    })();
  }

  async #renderKeepScroll({ search = false } = {}) {
    const root = this.element;
    const selectors = [".buxa-library-gallery", ".buxa-library-tree", ".buxa-library-side-list"];
    const positions = selectors.map((selector) => root?.querySelector(selector)?.scrollTop ?? 0);
    const input = root?.querySelector("[data-asset-search]");
    const focused = Boolean(search && input && input === input.ownerDocument.activeElement);
    await this.render({ force: true });
    for (let index = 0; index < selectors.length; index++) {
      const el = this.element?.querySelector(selectors[index]);
      if (el) el.scrollTop = positions[index];
    }
    if (focused) {
      const replacement = this.element?.querySelector("[data-asset-search]");
      replacement?.focus();
      replacement?.setSelectionRange?.(replacement.value.length, replacement.value.length);
    }
  }

  async #renderKeepSearch() { await this.#renderKeepScroll({ search: true }); }

  async #commit(path, directory = false) {
    // A double click produces two click events and a dblclick event. Commit
    // only once, even if the Foundry action handler also sees detail === 2.
    if (this._committing) return;
    this._committing = true;
    const chosen = cleanAssetPath(path);
    try {
      await this._onSelect?.(chosen, { source: this._source, directory });
      await this.close();
    } catch (error) {
      this._committing = false;
      throw error;
    }
  }

  async #toggleFavorite(type, path) {
    const source = this._source;
    // Multiple picker windows share the client settings key. Read the latest
    // committed state inside a global queue to avoid last-writer-wins loss.
    const run = favoritesWriteQueue.catch(()=>{}).then(async()=>{
      const favorites = toggleAssetFavorite(game.settings.get(MODULE_ID, SETTINGS.ASSET_FAVORITES), source, type, path);
      await game.settings.set(MODULE_ID, SETTINGS.ASSET_FAVORITES, favorites);
    });
    favoritesWriteQueue=run.catch(()=>{});
    this._favoriteWrite=run;
    try { await run; }
    catch (error) { console.error('buxaframework | Favorite save failed',error); notifyError(error.message || 'Could not save image favorites.'); return; }
    if(this.element?.isConnected) await this.render({ force: true });
  }

  static async #changeSource(_event, target) {
    if (!LIBRARY_SOURCES.includes(target.dataset.source) || target.dataset.source === this._source) return;
    const previousSource = this._source;
    const previousSelected = this._selected, previousPreview = this._preview;
    this._source = target.dataset.source;
    this._selected = ""; this._preview = "";
    const config = configuredLocation();
    const browsePromise = this.#browse(config.source === this._source ? config.path : "");
    const expectedSequence = this._gallerySeq;
    const success = await browsePromise;
    // An older rejected navigation must not revert a newer source selection.
    if (this._disposed || this._gallerySeq !== expectedSequence) return;
    if (!success) {
      this._source = previousSource;
      this._selected = previousSelected; this._preview = previousPreview;
      await this.render({force:true});
    }
  }
  static async #browseDirectory(_event, target) { await this.#browse(target.dataset.path || ""); }
  static async #goUp() { await this.#browse(assetParent(this._target)); }
  static async #goHome() {
    const config = configuredLocation();
    const previousSource = this._source;
    const previousSelected = this._selected, previousPreview = this._preview;
    this._source = config.source;
    if (previousSource !== this._source) { this._selected = ""; this._preview = ""; }
    const browsePromise = this.#browse(config.path);
    const expectedSequence = this._gallerySeq;
    const success = await browsePromise;
    if (this._disposed || this._gallerySeq !== expectedSequence) return;
    if (!success) {
      this._source = previousSource;
      this._selected = previousSelected; this._preview = previousPreview;
      await this.render({force:true});
    }
  }
  static async #toggleFolder(_event, target) {
    const path = cleanAssetPath(target.dataset.path);
    if (this._expanded.has(path)) this._expanded.delete(path);
    else {
      try { await this.#getListing(path); }
      catch { notifyError(`Cannot open folder: ${path}`); return; }
      this._expanded.add(path);
    }
    await this.render({ force: true });
  }
  static async #selectAsset(event, target) {
    const path = cleanAssetPath(target.dataset.path);
    if (!path) return;
    this._selected = path;
    this.#showPreview(path);
    this.element?.querySelectorAll("[data-action='selectAsset']").forEach((el) => el.classList.toggle("is-selected", el.dataset.path === path));
    const selectedPath = this.element?.querySelector("[data-selected-path]");
    if (selectedPath) selectedPath.textContent = path;
    const choose = this.element?.querySelector("[data-action='chooseAsset']");
    if (choose) choose.disabled = false;
    if (event?.detail === 2) await this.#commit(path);
  }
  static async #chooseAsset() { if (this._selected) await this.#commit(this._selected); }
  static async #chooseDirectory() { await this.#commit(this._target, true); }
  static async #clearAsset() { await this.#commit(""); }
  static async #favoriteFolder(event, target) { event?.stopPropagation?.(); await this.#toggleFavorite("folders", target.dataset.path); }
  static async #favoriteImage(event, target) { event?.stopPropagation?.(); await this.#toggleFavorite("images", target.dataset.path); }
  static async #setCollection(_event, target) {
    const collection = target.dataset.collection;
    if (!["all", "favorites", "used", "unused"].includes(collection)) return;
    this._collection = collection;
    this._visibleCount = 180;
    if (collection === 'used' || collection === 'unused') this._used = collectUsedAssetPaths(game);
    await this.#renderKeepScroll();
  }
  static async #showMore() {
    this._visibleCount += 180;
    await this.#renderKeepScroll();
  }
  static async #refreshAssets() {
    this.#cache().clear();
    this._used = collectUsedAssetPaths(game);
    await this.#browse(this._target);
  }
}

export function openBuxaAssetBrowser(options = {}) {
  return new BuxaAssetBrowser(options).render({ force: true });
}
