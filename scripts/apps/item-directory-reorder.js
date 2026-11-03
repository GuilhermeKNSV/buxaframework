/** Drag sorting for world Items. All sorting is committed through Foundry's
 * integer sort field; Buxa does not invent parallel order flags. */
import { folderIdOf } from "./item-directory-cards.js";

const orderOf = (doc) => Number.isFinite(Number(doc?.sort)) ? Number(doc.sort) : 0;
export const byDocumentOrder = (a, b) => orderOf(a) - orderOf(b) || String(a.name ?? "").localeCompare(String(b.name ?? ""), undefined, { numeric: true });

/** Compute document updates without writing, so this can be regression-tested. */
export function itemSortUpdates(item, { folderId = null, target = null, sortBefore = true, siblings = [], sortingHelper }) {
  if (!item || (target && target.id === item.id)) return [];
  if (target && folderIdOf(target) !== folderId) throw new Error("Sort target is not in the destination folder.");
  const ordered = siblings.filter((doc) => doc.id !== item.id && folderIdOf(doc) === folderId).sort(byDocumentOrder);
  const performSort = sortingHelper;
  if (typeof performSort !== "function") throw new Error("Foundry document sorting is unavailable.");
  const updates = performSort(item, { target, siblings: ordered, sortBefore });
  if (!Array.isArray(updates)) throw new Error("Foundry returned an invalid sorting result.");
  const changes = updates.map(({ target: doc, update }) => ({ _id: doc.id, ...update }));
  const own = changes.find((change) => change._id === item.id);
  if (own) own.folder = folderId;
  else changes.push({ _id: item.id, folder: folderId });
  return changes;
}

export async function moveSortedWorldItem(item, { folderId = null, target = null, sortBefore = true } = {}) {
  if (!item || !game.user?.isGM) return false;
  const currentFolder = folderIdOf(item);
  if (target?.id === item.id) return false;
  // Dropping on an empty root/folder may simply move folders; don't rewrite
  // every sibling sort number for that simple operation.
  if (!target) {
    if (currentFolder === folderId) return false;
    await item.update({ folder: folderId });
    return true;
  }
  const updates = itemSortUpdates(item, {
    folderId, target, sortBefore, siblings: game.items.contents,
    sortingHelper: foundry.utils.performIntegerSort
  });
  if (!updates.length) return false;
  await Item.updateDocuments(updates);
  return true;
}

/**
 * Stable drag insertion guide. An earlier version inserted a full-height gap
 * into the live list. That moved the hovered row under the mouse and caused
 * repeated enter/leave cycles, flashing rarity colors and misplaced drops when
 * users dragged quickly. This overlay never participates in layout or hit
 * testing, and only moves when the logical insertion target changes.
 */
export class DirectoryReorderPreview {
  constructor(container, { itemSelector, rowSelector } = {}) {
    this.container = container;
    this.itemSelector = itemSelector;
    this.rowSelector = rowSelector;
    this.marker = null;
    this.position = null;
  }

  update(event, itemId) {
    const itemElement = event.target?.closest?.(this.itemSelector);
    if (!itemElement || !this.container.contains(itemElement)) return false;
    const targetId = itemElement.dataset.buxaDirItem || itemElement.dataset.buxaItem;
    if (!targetId || targetId === itemId) { this.clear(); return false; }
    const row = itemElement.closest(this.rowSelector);
    if (!row || !this.container.contains(row)) return false;

    const rect = row.getBoundingClientRect();
    const half = rect.top + rect.height / 2;
    // A small dead zone prevents the indicator flipping sides as the mouse
    // hovers at the midpoint of a moving/animated card.
    const previous = this.position;
    const hysteresis = previous?.targetId === targetId ? 4 : 0;
    const before = previous?.targetId === targetId
      ? (previous.before ? event.clientY < half + hysteresis : event.clientY < half - hysteresis)
      : event.clientY < half;
    const key = `${targetId}:${before}`;
    if (previous?.key === key && this.marker?.isConnected) return true;

    if (!this.marker) {
      const marker = this.container.ownerDocument.createElement("div");
      marker.className = "buxa-world-reorder-guide";
      marker.setAttribute("aria-hidden", "true");
      this.container.append(marker);
      this.marker = marker;
    }
    const containerRect = this.container.getBoundingClientRect();
    const offset = rect.top - containerRect.top + this.container.scrollTop + (before ? 0 : rect.height);
    this.marker.style.transform = `translate3d(0, ${Math.round(offset)}px, 0)`;
    this.position = { key, targetId, before };
    return true;
  }

  getTarget() {
    return this.position ? { targetId: this.position.targetId, before: this.position.before } : null;
  }

  clear() {
    this.marker?.remove();
    this.marker = null;
    this.position = null;
  }
}
