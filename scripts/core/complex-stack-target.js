/**
 * Complex inventory stack resolution.
 *
 * The pointer is authoritative for merging: a stack is a deliberate drop
 * directly on another item's occupied cell, regardless of the source's
 * shape, grip offset or current rotation. The normal footprint scanner
 * remains authoritative for MOVE placement and collision rejection.
 * This module is deliberately DOM- and Foundry-independent.
 */
export function pointerCellIndex(geometry, x, y) {
  if (!geometry || !Number.isFinite(x) || !Number.isFinite(y)
      || !(geometry.cellSize > 0) || !Number.isInteger(geometry.columns)
      || !Number.isInteger(geometry.rows) || geometry.columns < 1 || geometry.rows < 1) return null;
  const col = Math.floor((x - geometry.left) / geometry.cellSize);
  const row = Math.floor((y - geometry.top) / (geometry.cellHeight || geometry.cellSize));
  if (col < 0 || row < 0 || col >= geometry.columns || row >= geometry.rows) return null;
  return row * geometry.columns + col;
}

/** Return an actual compatible target ID, not a boolean or a hovered DOM node. */
export function stackTargetAtPointer(occupied, sourceId, cellIndex, compatible) {
  if (!Number.isInteger(cellIndex) || !occupied || typeof occupied.get !== 'function') return null;
  const targetId = occupied.get(cellIndex);
  if (!targetId || targetId === sourceId) return null;
  return compatible(targetId) ? targetId : null;
}
