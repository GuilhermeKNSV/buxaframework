/** Image-library helpers. Does not depend on Foundry's UI or DOM. */
import { ensureScenePartition } from './physical-scene-partitions.js';
export const LIBRARY_SOURCES = ["data", "public"];
export const LIBRARY_VIEWS = ["grid", "list"];
export const LIBRARY_SIZES = ["small", "medium", "large"];

export function cleanAssetPath(value) {
  const path = String(value ?? "").trim().replace(/\\/g, "/");
  return /^(?:https?:|data:|blob:)/i.test(path) ? path : path.replace(/^\/+/, "").replace(/\/+$/, "");
}

/** A FilePicker folder is source-relative; URLs and dot-segment traversal
 * cannot be browsed as folders under Data/Public. Keep URL image previews
 * supported separately. */
export function isBrowsableAssetFolder(value) {
  const path = cleanAssetPath(value);
  if (!path) return true; // FilePicker Data/Public root is a valid folder.
  return !/^(?:https?:|data:|blob:)/i.test(path) &&
    !path.split('/').some(segment=>{
      // A folder name can be encoded by more than one FilePicker layer.
      // Reject traversal at every decoding level before using it as a path.
      if (!segment) return true;
      let decoded=segment;
      for (let pass=0; pass<4; pass++) {
        if (decoded==='.' || decoded==='..' || decoded.includes('/') ||
            decoded.includes('\\') || /[\x00-\x1F]/.test(decoded)) return true;
        if (!decoded.includes('%')) break;
        try { decoded=decodeURIComponent(decoded); }
        catch { return true; }
      }
      return decoded==='.' || decoded==='..' || decoded.includes('/') || decoded.includes('\\');
    });
}

export function assetParent(value) {
  const path = cleanAssetPath(value);
  if (!isBrowsableAssetFolder(path)) return "";
  const index = path.lastIndexOf("/");
  return index < 0 ? "" : path.slice(0, index);
}

export function assetName(value) {
  const name = cleanAssetPath(value).split("/").pop() || "";
  try { return decodeURIComponent(name); } catch { return name; }
}

export function assetExtension(value) {
  const name = assetName(String(value ?? "").split(/[?#]/)[0]);
  return name.includes(".") ? name.slice(name.lastIndexOf(".") + 1).toLowerCase() : "";
}

export function acceptedAsset(value, extensions) {
  return Boolean(cleanAssetPath(value)) && (!extensions?.length || extensions.includes(assetExtension(value)));
}

export function assetEntries(items) {
  const entries = Array.isArray(items) ? items : (items instanceof Set ? [...items] : []);
  return entries.map((item) => {
    const path = cleanAssetPath(typeof item === "string" ? item : item?.path ?? item?.key ?? item?.url ?? "");
    return { path, name: assetName(path), src: typeof item === "string" ? item : item?.url ?? item?.src ?? path };
  }).filter((item) => item.path);
}

export function assetCrumbs(path) {
  if (!isBrowsableAssetFolder(path)) return [{label:"Root",path:""}];
  const parts = cleanAssetPath(path).split("/").filter(Boolean);
  const output = [{ label: "Root", path: "" }];
  let cursor = "";
  for (const part of parts) {
    cursor = cursor ? `${cursor}/${part}` : part;
    output.push({ label: part, path: cursor });
  }
  return output;
}

export function normalizeAssetFavorites(value) {
  const input = value && typeof value === "object" ? value : {};
  const output = {};
  for (const source of LIBRARY_SOURCES) {
    const group = input[source] && typeof input[source] === "object" ? input[source] : {};
    output[source] = {};
    for (const type of ["folders", "images"]) {
      const paths = Array.isArray(group[type]) ? group[type] : [];
      output[source][type] = [...new Set(paths.filter((path) => typeof path === "string" && path.length < 1024)
        .map(cleanAssetPath).filter(path=>Boolean(path) && (type !== 'folders' || isBrowsableAssetFolder(path))))].slice(0, 400);
    }
  }
  return output;
}

export function toggleAssetFavorite(value, source, type, path) {
  const next = normalizeAssetFavorites(value);
  if (!LIBRARY_SOURCES.includes(source) || !["folders", "images"].includes(type)) return next;
  const clean = cleanAssetPath(path);
  if (!clean || (type === 'folders' && !isBrowsableAssetFolder(clean))) return next;
  const set = new Set(next[source][type]);
  if (set.has(clean)) set.delete(clean);
  else {
    if (set.size >= 400) throw Error('Image favorites are full (400). Remove one before adding another.');
    set.add(clean);
  }
  next[source][type] = [...set];
  return next;
}

/** Records which World/Actor/Scene documents are using an artwork path. */
export function collectUsedAssetPaths(world) {
  const used = new Map();
  const add = (path, label) => {
    const key = cleanAssetPath(path);
    if (!key || key.startsWith("data:") || key === "icons/svg/item-bag.svg") return;
    const labels = used.get(key) ?? new Set();
    labels.add(String(label || "Document"));
    used.set(key, labels);
  };
  const list = (collection) => Array.isArray(collection) ? collection : (collection?.contents ?? []);
  // Malformed or cyclic portable contents should not freeze the entire picker.
  let remainingItemVisits = 10000;
  const item = (entry, prefix = "", depth = 0) => {
    if (!entry || depth > 12 || --remainingItemVisits < 0) return;
    const label = `${prefix}${entry?.name || "Item"}`;
    add(entry?.img, label);
    const buxa = entry?.flags?.buxaframework ?? {};
    try { add(entry?.getFlag?.("buxaframework", "itemImg") ?? buxa.itemImg, label); }
    catch { /* An inaccessible flag should not break the picker. */ }
    let rules = buxa.item;
    try { rules = entry?.getFlag?.('buxaframework','item') ?? rules; }
    catch { /* Broken flag access cannot prevent loading all image assets. */ }
    const stackImages = Array.isArray(rules?.multiple?.stackImages) ? rules.multiple.stackImages : [];
    for (const rule of stackImages) {
      add(rule?.img, `${label} · Stack artwork`);
      const layers=Array.isArray(rule?.layers) ? rule.layers : [];
      for (const layer of layers) add(layer?.img, `${label} · Stack layer`);
    }
    // Portable chest snapshots can themselves contain nested item snapshots.
    // Cap depth and records so malformed data cannot lock up the picker.
    const children=Array.isArray(buxa.backpackContents) ? buxa.backpackContents.slice(0,250) : [];
    for (const child of children) item(child?.data, `${label} / `, depth+1);
  };
  for (const entry of list(world?.items)) item(entry);
  for (const actor of list(world?.actors)) {
    add(actor?.img, `Actor: ${actor?.name || "Actor"}`);
    add(actor?.prototypeToken?.texture?.src, `Token: ${actor?.name || "Actor"}`);
    for (const entry of list(actor?.items)) item(entry, `${actor.name || "Actor"} / `);
  }
  for (const scene of list(world?.scenes)) {
    add(scene?.background?.src, `Scene: ${scene?.name || "Scene"}`);
    for (const token of list(scene?.tokens)) add(token?.texture?.src, `Token: ${token?.name || "Token"}`);
    for (const tile of list(scene?.tiles)) add(tile?.texture?.src, `Tile: ${scene?.name || "Scene"}`);
  }
  // The ground-item store is GM-owned gameplay data, not a public image index.
  // Do not expose concealed board items through an in-use label to players.
  if (world?.user?.isGM) {
    try {
      const legacy = world.settings?.get?.('buxaframework','physicalSceneItems') ?? {};
      const scenes=list(world?.scenes);
      const scan=records=>{
        for(const record of Array.isArray(records)?records:[])item(record?.data,'Board: ');
      };
      // v0.13.5x persists authoritative physical Items per scene. The old
      // aggregate may contain stale copies that must NOT appear as in use.
      const visited=new Set();
      for(const scene of scenes) {
        const id=scene?.id;
        if(!id)continue;
        visited.add(id);
        let partition=null;
        try {
          // A world may open the picker before it has visited this Scene.
          // Register the hidden setting before reading its authoritative data.
          if(world===globalThis.game)ensureScenePartition(id);
          partition=world.settings?.get?.('buxaframework',`physicalSceneV2_${id}`);
        }
        catch { /* A not-yet-registered partition uses legacy storage. */ }
        if(partition?.initialized === true && Array.isArray(partition.records))scan(partition.records);
        else scan(legacy?.[id] ?? scene?.flags?.buxaframework?.physicalItems ?? []);
      }
      // Preserve legacy coverage if an isolated world fixture doesn't expose
      // the Scene collection; do not mark migrated Scene records twice.
      for(const [id,records] of Object.entries(legacy))if(!visited.has(id))scan(records);
    } catch { /* Ground items may not be registered or readable yet. */ }
  }
  return used;
}

/** Visited nodes only: avoids recursively loading Foundry's entire Core directory. */
export function visibleAssetFolders(root, entries, expanded, selected, { maxDepth = 64 } = {}) {
  const output = [];
  const walk = (path, depth) => {
    const node = entries.get(path);
    output.push({ path, name: assetName(path) || "Root", depth, selected: path === selected, expanded: expanded.has(path), loaded: Boolean(node) });
    if (depth >= maxDepth || !expanded.has(path) || !node) return;
    for (const child of node.dirs ?? []) {
      const target=cleanAssetPath(child?.path);
      if(target && isBrowsableAssetFolder(target) && (path==='' || target.startsWith(`${path}/`)))walk(target, depth + 1);
    }
  };
  walk(root, 0);
  return output;
}

export function filterAssetItems(items, { query = "", mode = "all", favoritePaths = [], used = new Map() } = {}) {
  const needle = String(query).trim().toLocaleLowerCase();
  const favorites = new Set(favoritePaths);
  return items.filter((item) => {
    if (mode === "favorites" && !favorites.has(item.path)) return false;
    if (mode === "used" && !used.has(item.path)) return false;
    if (mode === "unused" && used.has(item.path)) return false;
    return !needle || `${item.name} ${item.path}`.toLocaleLowerCase().includes(needle);
  });
}
