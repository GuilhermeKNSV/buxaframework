/** Deterministic world-item list rendering. Pure functions, no Foundry globals. */
import { MODULE_ID } from "../core/constants.js";
import { itemDisplayLabel } from "../core/item-type-label.js";
import { folderIdOf, renderFolderCard, renderItemCard } from "./item-directory-cards.js";
import { sortMainFirst, isMainFolder } from "./directory-main-folder.js";
import { byDocumentOrder } from "./item-directory-reorder.js";
const sortByName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
function folderPath(folder, all) {
  const byId = new Map(all.map((f) => [f.id, f]));
  const names = []; const visited = new Set();
  let current = folder;
  while (current && !visited.has(current.id)) {
    visited.add(current.id); names.unshift(current.name);
    current = byId.get(folderIdOf(current));
  }
  return names.join(" / ");
}
export function directoryListHTML({ folders: folderList, items: itemList, rarities, query = "", expanded: open = new Set(), left = false, sort = "name" , rootFolderId = null, tabContentsFolderId = null }) {
  const term = String(query).trim().toLocaleLowerCase();
  const foldersByParent = new Map();
  const itemsByParent = new Map();
  const folderMap = new Map(folderList.map((folder) => [folder.id, folder]));
  for (const folder of folderList) {
    const parentId = folderIdOf(folder);
    const key = parentId === tabContentsFolderId ? null : folderMap.has(parentId) ? parentId : null;
    if (!foldersByParent.has(key)) foldersByParent.set(key, []);
    foldersByParent.get(key).push(folder);
  }
  for (const item of itemList) {
    const parentId = folderIdOf(item);
    const key = parentId === tabContentsFolderId ? null : folderMap.has(parentId) ? parentId : null;
    if (!itemsByParent.has(key)) itemsByParent.set(key, []);
    itemsByParent.get(key).push(item);
  }
  for (const entries of foldersByParent.values()) entries.sort(sortMainFirst);
  const rank = new Map(rarities.map((rarity, index) => [rarity.id, index]));
  for (const entries of itemsByParent.values()) entries.sort((a,b) => {
    if (sort === "manual") return byDocumentOrder(a,b);
    if (sort === "rarity") {
      const r = (obj) => rank.get(obj.flags?.[MODULE_ID]?.item?.rarityId) ?? -1;
      const ra = r(a), rb = r(b);
      if (ra !== rb) return (rb < 0 ? -1 : rb) - (ra < 0 ? -1 : ra);
    }
    return sortByName(a,b);
  });
  if (term) {
    const matches = itemList.filter((item) => {
      const rarity = rarities.find((r) => r.id === item.flags?.[MODULE_ID]?.item?.rarityId)?.label ?? "";
      const label = itemDisplayLabel(item.flags?.[MODULE_ID]?.item);
      return `${item.name} ${label} ${rarity}`.toLocaleLowerCase().includes(term);
    });
    const found = matches.sort(sortByName).map((item) => renderItemCard(item, rarities, { folderLabel: folderPath(folderMap.get(folderIdOf(item)), folderList) })).join("");
    return found || '<p class="buxa-world-empty">No matching items</p>';
  }
  const visited = new Set();
  function renderTree(id = null, depth = 0) {
    if (depth > 30) return "";
    let html = "";
    for (const folder of foldersByParent.get(id) ?? []) {
      if (visited.has(folder.id)) continue;
      visited.add(folder.id);
      const isOpen = !left && open.has(folder.id);
      const count = (foldersByParent.get(folder.id)?.length ?? 0) + (itemsByParent.get(folder.id)?.length ?? 0);
      html += `<div class="buxa-world-tree-node" style="--buxa-tree-depth:${Math.min(depth,8)}">${renderFolderCard(folder, { count, expanded: isOpen, left, main: isMainFolder(folder) })}</div>`;
      if (isOpen) html += renderTree(folder.id, depth + 1);
    }
    for (const item of itemsByParent.get(id) ?? []) html += `<div class="buxa-world-tree-node" style="--buxa-tree-depth:${Math.min(depth,8)}">${renderItemCard(item, rarities)}</div>`;
    return html;
  }
  const result = renderTree(rootFolderId);
  return result || '<p class="buxa-world-empty">No items yet</p>';
}

