/** Inventory-grid hit testing, built once per sheet render.
 * Maps every occupied cell to its owning item, not just the anchor cell.
 * Pure and independent of DOM/Foundry to keep pointerdown inexpensive.
 */
export function buildComplexHitMap(items, columns) {
  const occupancy = new Map();
  if (!Number.isSafeInteger(columns) || columns <= 0) return occupancy;
  for (const item of items ?? []) {
    if (!item?.id || !Number.isSafeInteger(item.index) || item.index < 0) continue;
    const originX = item.index % columns;
    const originY = Math.floor(item.index / columns);
    for (const cell of item.pieces ?? []) {
      const x = originX + cell.x;
      const y = originY + cell.y;
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= columns || y < 0) continue;
      occupancy.set(y * columns + x, item.id);
    }
  }
  return occupancy;
}
