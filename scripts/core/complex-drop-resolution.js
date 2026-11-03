import { isOverComplexBoard } from './complex-drag-geometry.js';

/**
 * Resolve a complex inventory pointer to exactly one destination. Both the
 * visible drag ghost and pointerup use this function, with the same occupancy
 * snapshot. It never selects an occupied cell as a valid regular move.
 *
 * A large item may have been grabbed near an edge. When the raw footprint is
 * blocked, consider only immediately adjacent origins; this makes tight gaps
 * possible without teleporting an item across the backpack.
 * A one-cell item remains strictly under the cursor (no surprising magnetism).
 */
export function resolveComplexPlacement(geometry, pointerX, pointerY, gripX, gripY, scanner, itemId, rotation = 0, { singleCell = false } = {}) {
  if (!isOverComplexBoard(geometry, pointerX, pointerY) || !scanner) return null;
  const { columns, rows, left, top, cellSize } = geometry;
  if (!(cellSize > 0)) return null;
  const footprint = scanner.cellsFor(itemId, rotation);
  if (!footprint?.length) return null;
  const w = Math.max(...footprint.map(p => p.x)) + 1;
  const h = Math.max(...footprint.map(p => p.y)) + 1;
  if (w > columns || h > rows) return null;
  const rawX = Math.floor((pointerX - left - (singleCell ? 0 : gripX)) / cellSize + 1e-8);
  const rawY = Math.floor((pointerY - top - (singleCell ? 0 : gripY)) / cellSize + 1e-8);
  const boundX = Math.max(0, Math.min(columns - w, rawX));
  const boundY = Math.max(0, Math.min(rows - h, rawY));
  const preferred = { x: boundX, y: boundY };
  // Prefer the exact expected origin. Only search for a neighbor when that
  // location collides, and never expand the search for 1x1 items.
  let chosen = preferred;
  let index = preferred.y * columns + preferred.x;
  let valid = scanner.fits(itemId, index, rotation);
  if (!valid && !singleCell) {
    let bestScore = Infinity;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = rawX + dx, y = rawY + dy;
        if (x < 0 || y < 0 || x + w > columns || y + h > rows) continue;
        const candidate = y * columns + x;
        if (!scanner.fits(itemId, candidate, rotation)) continue;
        // Nearest to the original grip first; stable tie-breaking favors
        // candidates closest to the current pointer within the footprint.
        const score = dx * dx + dy * dy;
        if (score < bestScore) { bestScore = score; chosen = { x, y }; index = candidate; valid = true; }
      }
    }
  }
  return {
    area: 'inventory', index, rotation,
    left: left + chosen.x * cellSize, top: top + chosen.y * cellSize,
    cellSize, valid,
    assisted: valid && (chosen.x !== rawX || chosen.y !== rawY)
  };
}
