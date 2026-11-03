/** Pure cards and sorting primitives for Actor and Scene directories. */
import { folderIdOf, renderFolderCard } from "./item-directory-cards.js";
import { byDocumentOrder, itemSortUpdates } from "./item-directory-reorder.js";
import { isMainFolder, sortMainFirst } from "./directory-main-folder.js";
const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
export function genericCardData(doc, type) {
  if (type === "Actor") {
    const isCharacter = doc.type === "character";
    const level = Number(isCharacter ? doc.system?.details?.level : doc.system?.details?.cr);
    const isLevel = Number.isFinite(level) && level > 0;
    const tag = String(doc.type || "ACTOR").replaceAll("_", " ").toUpperCase();
    const hp = Number(doc.system?.attributes?.hp?.value);
    return { meta: `${tag}${isLevel ? ` · ${isCharacter ? "LV" : "CR"} ${level}` : ""}${Number.isFinite(hp) ? ` · HP ${hp}` : ""}`,
      image: doc.img || "icons/svg/mystery-man.svg", accent: "#79aace", badge: "ACTOR", detail: tag };
  }
  const width = Math.round(Number(doc.width));
  const height = Math.round(Number(doc.height));
  const dimensions = width > 0 && height > 0 ? ` · ${width}×${height}` : "";
  // Scene#background is deprecated in Foundry V14; the generated thumbnail is the
  // appropriate directory preview and works independently of Scene levels.
  const image = doc.thumb || "icons/svg/direction.svg";
  return { meta: `SCENE${dimensions}`, image, accent: "#a596d4", badge: "SCENE", detail: "SCENE" };
}

export function renderGenericCard(doc, type, { panel = false, path = "" } = {}) {
  const info = genericCardData(doc, type);
  return `<button type="button" class="buxa-world-item-card ${panel ? "buxa-folder-entry is-item" : "buxa-world-row"}" draggable="true"
    data-buxa-doc="${escape(doc.id)}" ${panel ? "" : `data-buxa-dir-item="${escape(doc.id)}"`}
    style="--buxa-card-accent:${info.accent}" title="${escape(doc.name)}">
    <span class="buxa-world-art"><img src="${escape(info.image)}" loading="lazy" draggable="false" alt=""/></span>
    <span class="buxa-world-details"><span class="buxa-world-item-name">${escape(doc.name || `New ${type}`)}</span>
    <span class="buxa-world-meta"><span class="buxa-world-rarity">${escape(info.badge)}</span>
    <span class="buxa-world-type">${escape(info.meta)}</span>${path ? `<span class="buxa-world-path">${escape(path)}</span>` : ""}</span></span>
  </button>`;
}

export function genericTreeHTML({ type, docs, folders, query = "", sort = "manual", expanded = new Set(), left = false , rootFolderId = null, tabContentsFolderId = null }) {
  const folderMap = new Map(folders.map(f => [f.id, f]));
  const childFolders = new Map();
  const childDocs = new Map();
  const add = (map, id, entry) => {
    const key = id === tabContentsFolderId ? null : folderMap.has(id) ? id : null;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(entry);
  };
  for (const folder of folders) add(childFolders, folderIdOf(folder), folder);
  for (const doc of docs) add(childDocs, folderIdOf(doc), doc);
  for (const siblings of childFolders.values()) siblings.sort(sortMainFirst);
  const sorter = sort === "name" ? (a,b) => String(a.name).localeCompare(String(b.name),undefined,{numeric:true}) : byDocumentOrder;
  for (const siblings of childDocs.values()) siblings.sort(sorter);
  const term = query.trim().toLocaleLowerCase();
  if (term) {
    const matches = docs.filter(d => `${d.name} ${d.type ?? ""}`.toLocaleLowerCase().includes(term));
    return matches.sort(sorter).map(d => renderGenericCard(d, type)).join("") || '<p class="buxa-world-empty">No matches</p>';
  }
  const seen = new Set();
  function walk(folderId = null, depth = 0) {
    if (depth > 25) return "";
    let html = "";
    for (const folder of childFolders.get(folderId) || []) {
      if (seen.has(folder.id)) continue;
      seen.add(folder.id);
      const open = !left && expanded.has(folder.id);
      const count = (childFolders.get(folder.id)?.length ?? 0) + (childDocs.get(folder.id)?.length ?? 0);
      html += `<div class="buxa-world-tree-node" style="--buxa-tree-depth:${Math.min(depth,8)}">${renderFolderCard(folder,{count,expanded:open,left,main:isMainFolder(folder)})}</div>`;
      if (open) html += walk(folder.id, depth + 1);
    }
    for (const entry of childDocs.get(folderId) || []) html += `<div class="buxa-world-tree-node" style="--buxa-tree-depth:${Math.min(depth,8)}">${renderGenericCard(entry,type)}</div>`;
    return html;
  }
  return walk(rootFolderId) || '<p class="buxa-world-empty">No entries yet</p>';
}

export async function moveWorldDocument(doc, type, { folderId = null, target = null, before = true } = {}) {
  if (!doc || !game.user?.isGM) return false;
  if (target?.id === doc.id) return false;
  const dest = folderId;
  if (!target) {
    if (folderIdOf(doc) === dest) return false;
    await doc.update({ folder: dest });
    return true;
  }
  const siblings = [...(type === "Actor" ? game.actors.contents : game.scenes.contents)];
  const updates = itemSortUpdates(doc, { folderId: dest, target, sortBefore: before, siblings, sortingHelper: foundry.utils.performIntegerSort });
  await (type === "Actor" ? Actor : Scene).updateDocuments(updates);
  return true;
}

