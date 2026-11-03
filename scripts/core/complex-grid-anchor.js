/**
 * Deterministic grid-cell grabbing for complex inventory.
 *
 * A pointer grabs ONE occupied cell of a polyomino. That exact cell stays
 * beneath the cursor while translating and rotating. Fractional image pixels
 * are intentionally ignored: they caused off-by-one snaps and unexpectedly
 * shifted items beside adjacent occupied cells.
 */
import { isOverComplexBoard } from './complex-drag-geometry.js';

export function grabbedShapeCell(cells, width, height, localX, localY, renderedWidth, renderedHeight) {
  if (!Array.isArray(cells) || !cells.length) return { x: 0, y: 0 };
  const px = Number.isFinite(Number(localX)) ? Number(localX) : 0;
  const py = Number.isFinite(Number(localY)) ? Number(localY) : 0;
  const col = Math.max(0, Math.min(width - 1, Math.floor((px / (renderedWidth || 1)) * width)));
  const row = Math.max(0, Math.min(height - 1, Math.floor((py / (renderedHeight || 1)) * height)));
  const direct = cells.find(cell => cell.x === col && cell.y === row);
  if (direct) return { x: direct.x, y: direct.y };
  // Defensive: sparse shapes can contain holes. If a click originates in one
  // from an ancestor handler, snap the grab to the nearest *occupied* cell.
  const near = [...cells].sort((a, b) =>
    (Math.abs(a.x - col) + Math.abs(a.y - row)) - (Math.abs(b.x - col) + Math.abs(b.y - row)) ||
    a.y - b.y || a.x - b.x)[0];
  return { x: near.x, y: near.y };
}

/** Resolve a pickup only from a real occupied tile, never a bounding-box hole.
 * Tile data is the first choice; grid hit testing is the fallback for clicks
 * that pass through transparent artwork to the underlying occupied grid cell.
 */
export function pickedOccupiedShapeCell(cells, { pieceX, pieceY, hitIndex, originIndex, columns } = {}) {
  if (!Array.isArray(cells) || !cells.length) return null;
  const occupied = (x, y) => cells.find(cell => cell.x === x && cell.y === y);
  if (Number.isInteger(pieceX) && Number.isInteger(pieceY)) {
    const cell = occupied(pieceX, pieceY);
    if (cell) return { x: cell.x, y: cell.y };
  }
  if (Number.isInteger(hitIndex) && Number.isInteger(originIndex) && Number.isInteger(columns) && columns > 0) {
    const x = hitIndex % columns - originIndex % columns;
    const y = Math.floor(hitIndex / columns) - Math.floor(originIndex / columns);
    const cell = occupied(x, y);
    if (cell) return { x: cell.x, y: cell.y };
  }
  return null;
}

/** Record the *fractional* pointer position inside the occupied pickup cell.
 * Board geometry wins over artwork bounds (which may have transparent margins).
 * It only affects the display offset: validation and drops still snap by cell. */
export function grabbedCellFraction({ pointerX, pointerY, geometry, originIndex, columns,
  grabCell, sourceRect, shapeWidth=1, shapeHeight=1 } = {}) {
  const fraction = (value) => Number.isFinite(value) ? Math.max(.001,Math.min(.999,value)) : .5;
  const index=Number(originIndex), cols=Number(columns);
  const gx=Number(grabCell?.x), gy=Number(grabCell?.y);
  if (geometry && Number.isInteger(index) && index>=0 && Number.isInteger(cols) && cols>0
      && Number.isFinite(gx) && Number.isFinite(gy)
      && geometry.cellSize>0 && (geometry.cellHeight||geometry.cellSize)>0) {
    const cellLeft=geometry.left+(index%cols+gx)*geometry.cellSize;
    const cellTop=geometry.top+(Math.floor(index/cols)+gy)*(geometry.cellHeight||geometry.cellSize);
    return {x:fraction((pointerX-cellLeft)/geometry.cellSize),
      y:fraction((pointerY-cellTop)/(geometry.cellHeight||geometry.cellSize))};
  }
  if (sourceRect?.width>0 && sourceRect?.height>0 && Number.isFinite(gx) && Number.isFinite(gy)) {
    return {x:fraction((pointerX-sourceRect.left)/sourceRect.width*Math.max(1,shapeWidth)-gx),
      y:fraction((pointerY-sourceRect.top)/sourceRect.height*Math.max(1,shapeHeight)-gy)};
  }
  return {x:.5,y:.5};
}

/** The same material point must remain under the pointer after a quarter turn.
 * A cell center is not invariant when the user grabs its corner. */
export function rotateGrabFraction(frac) {
  return {x:1-(frac?.y ?? .5),y:frac?.x ?? .5};
}

/** 90-degree clockwise rotation of a grabbed cell in normalized coordinates. */
export function rotateGrabbedShapeCell(grab, previousHeight) {
  return { x: previousHeight - 1 - grab.y, y: grab.x };
}

/**
 * Every stage of a drag (outline, ghost, pointerup) uses this one mapping.
 * Never clamp an invalid origin into a different cell or silently search
 * neighboring cells: that makes items land somewhere the player did not aim.
 */
export function resolveAnchoredComplexPlacement(geometry, pointerX, pointerY, grabCell, scanner, itemId, rotation = 0) {
  if (!isOverComplexBoard(geometry, pointerX, pointerY) || !scanner || !grabCell) return null;
  const { columns, rows, left, top, cellSize } = geometry;
  const cellHeight = geometry.cellHeight || cellSize;
  if (!(cellSize > 0) || !(cellHeight > 0)) return null;
  const hoveredX = Math.floor((pointerX - left) / cellSize);
  const hoveredY = Math.floor((pointerY - top) / cellHeight);
  const originX = hoveredX - grabCell.x;
  const originY = hoveredY - grabCell.y;
  const cells = scanner.cellsFor(itemId, rotation);
  const fitsBounds = cells?.length > 0 && cells.every(cell =>
    originX + cell.x >= 0 && originX + cell.x < columns &&
    originY + cell.y >= 0 && originY + cell.y < rows);
  const index = fitsBounds ? originY * columns + originX : null;
  return {
    area: 'inventory', index, rotation,
    left: left + originX * cellSize, top: top + originY * cellHeight,
    cellSize, cellHeight, valid: index != null && scanner.fits(itemId, index, rotation),
    // Exposed for tests and debugging. The hovered tile is always the tile
    // of the moving object that was clicked at drag start.
    hoveredIndex: hoveredY * columns + hoveredX,
    anchor: { x: grabCell.x, y: grabCell.y }
  };
}
