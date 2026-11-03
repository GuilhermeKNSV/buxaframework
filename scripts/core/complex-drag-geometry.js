/** Shared, DOM-independent pointer/footprint geometry for Complex inventory.
 * All preview, cursor and commit coordinates use the same shape origin.
 */
export function normalizedTurns(turns) {
  return ((Math.trunc(Number(turns) || 0) % 4) + 4) % 4;
}

/** Keep the exact local point grabbed, scaled to the inventory grid. */
export function initialGrabOffset({ x, y, sourceWidth, sourceHeight, cellSize, cellHeight = cellSize, width, height }) {
  const factorX = Number(sourceWidth) > 0 ? Math.max(0, Math.min(1, x / sourceWidth)) : 0.5;
  const factorY = Number(sourceHeight) > 0 ? Math.max(0, Math.min(1, y / sourceHeight)) : 0.5;
  return { x: factorX * width * cellSize, y: factorY * height * cellHeight };
}

/** A clockwise turn maps an (x,y) grip point to (oldHeight-y,x). */
export function rotateGrabOffset(grip, previousHeight) {
  return { x: previousHeight - grip.y, y: grip.x };
}

/** Measure the inventory board once per drag, not on every pointer movement. */
export function measureComplexBoard(board) {
  if (!board) return null;
  const rect = board.getBoundingClientRect();
  const columns = Number(board.style.getPropertyValue('--buxa-complex-columns'));
  const rows = Number(board.style.getPropertyValue('--buxa-complex-rows'));
  if (!Number.isInteger(columns) || columns < 1 || !Number.isInteger(rows) || rows < 1
      || !(rect.width > 0) || !(rect.height > 0)) return null;
  // Read an actual square when available: some Foundry skins add border or
  // padding to the board rectangle without changing the grid cells. Board
  // height alone must never create phantom rows along the bottom edge.
  const firstCell = board.querySelector?.('.buxa-complex-cell')?.getBoundingClientRect?.();
  const cellSize = firstCell?.width > 0 ? firstCell.width : rect.width / columns;
  const reportedHeight = rect.height / rows;
  const cellHeight = firstCell?.height > 0 ? firstCell.height
    : Math.abs(reportedHeight - cellSize) <= Math.max(2, cellSize * 0.05) ? reportedHeight : cellSize;
  const left = firstCell?.left ?? rect.left;
  const top = firstCell?.top ?? rect.top;
  return {left, top, right:left + cellSize * columns, bottom:top + cellHeight * rows,
    columns, rows, cellSize, cellHeight};
}

export function isOverComplexBoard(geometry, x, y) {
  return Boolean(geometry && Number.isFinite(x) && Number.isFinite(y)
    && x >= geometry.left && x < geometry.right && y >= geometry.top && y < geometry.bottom);
}

/** Pure pointer-to-placement mapping shared by ghost and final drop. */
export function complexDestinationFromGeometry(geometry, pointerX, pointerY, offsetX = 0, offsetY = 0) {
  if (!isOverComplexBoard(geometry, pointerX, pointerY)) return null;
  const {left, top, columns, rows, cellSize} = geometry;
  const cellHeight = geometry.cellHeight || cellSize;
  const originX = Math.floor((pointerX - offsetX - left) / cellSize + 1e-8);
  const originY = Math.floor((pointerY - offsetY - top) / cellHeight + 1e-8);
  if (originX < 0 || originX >= columns || originY < 0 || originY >= rows) return null;
  return {
    area: 'inventory', index: originY * columns + originX,
    left: left + originX * cellSize, top: top + originY * cellHeight,
    cellSize
  };
}

export function complexPointerDestination(board, pointerX, pointerY, offsetX = 0, offsetY = 0) {
  return complexDestinationFromGeometry(measureComplexBoard(board), pointerX, pointerY, offsetX, offsetY);
}

/** Draw only external borders: neighboring squares never paint a seam. */
export function exteriorShapeEdges(cells) {
  const set = new Set(cells.map(c => `${c.x}:${c.y}`));
  return cells.map(cell => ({ ...cell,
    top: !set.has(`${cell.x}:${cell.y-1}`),
    right: !set.has(`${cell.x+1}:${cell.y}`),
    bottom: !set.has(`${cell.x}:${cell.y+1}`),
    left: !set.has(`${cell.x-1}:${cell.y}`)
  }));
}

export function edgeBorderStyle(cell) {
  return `--buxa-edge-top:${cell.top?'1px':'0px'};--buxa-edge-right:${cell.right?'1px':'0px'};--buxa-edge-bottom:${cell.bottom?'1px':'0px'};--buxa-edge-left:${cell.left?'1px':'0px'}`;
}
