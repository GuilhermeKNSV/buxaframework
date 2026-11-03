import { numericField } from './numeric-field.js';
/** Complex inventory geometry. Pure operations: safe to use in rendering and tests. */
export const SHAPE_MAX = 8;
export const DEFAULT_SHAPE = Object.freeze({ cells: [{ x: 0, y: 0 }], imageScale: 100, imageX: 50, imageY: 50, imageRotation: 0 });
const clamp = (value, min, max, fallback = min) => {
  if (value == null || typeof value === 'boolean' || !['number','string'].includes(typeof value) ||
      (typeof value === 'string' && !value.trim())) return fallback;
  const n = Number(value); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
};
export function normalizeItemShape(value) {
  const input = value && typeof value === 'object' ? value : {};
  const cells = [], unique = new Set();
  const inputCells = input.cells;
  for (const cell of Array.isArray(inputCells) ? inputCells.slice(0, 64) : DEFAULT_SHAPE.cells) {
    const x = Math.floor(clamp(cell?.x, 0, SHAPE_MAX-1));
    const y = Math.floor(clamp(cell?.y, 0, SHAPE_MAX-1));
    const key = `${x}:${y}`;
    if (!unique.has(key)) { cells.push({x,y}); unique.add(key); }
  }
  if (!cells.length) cells.push({x:0,y:0});
  // Normalize to an origin at 0,0 to make rotation and first-fit deterministic.
  const mx=Math.min(...cells.map(c=>c.x)), my=Math.min(...cells.map(c=>c.y));
  return {
    cells: cells.map(c=>({x:c.x-mx,y:c.y-my})).sort((a,b)=>a.y-b.y||a.x-b.x),
    imageScale: clamp(input.imageScale, 20, 300, 100),
    imageX: clamp(input.imageX, 0, 100, 50),
    imageY: clamp(input.imageY, 0, 100, 50),
    imageRotation: ((Math.round(clamp(input.imageRotation, -Infinity, Infinity, 0)) % 360) + 360) % 360
  };
}
export function rotatedCells(shape, turns=0) {
  let cells=normalizeItemShape(shape).cells.map(c=>({...c}));
  // Rotation is measured in quarter turns. Legacy arrays/objects/booleans
  // must not turn a dragged shape when loading corrupted placement data.
  const quarters = Math.trunc(numericField(turns, 0));
  for (let i=0;i<((quarters%4)+4)%4;i++) {
    cells=cells.map(c=>({x:-c.y,y:c.x}));
    const minX=Math.min(...cells.map(c=>c.x)),minY=Math.min(...cells.map(c=>c.y));
    cells=cells.map(c=>({x:c.x-minX,y:c.y-minY}));
  }
  return cells.sort((a,b)=>a.y-b.y||a.x-b.x);
}
export function shapeBounds(cells) {
  if (!cells?.length) return { width: 0, height: 0 };
  return { width: Math.max(...cells.map(c => c.x)) + 1, height: Math.max(...cells.map(c => c.y)) + 1 };
}
export function gridDimensions(config) {
  const c = numericField(config?.columns, 10);
  const r = numericField(config?.rows, 5);
  // Preserve the original zero-as-default behavior for old inventory saves.
  const columns=Math.max(2,Math.min(20,Math.floor(c || 10)));
  const rows=Math.max(1,Math.min(80,Math.floor(r || 5)));
  const rawCells=config?.activeCells;
  const valid=rawCells != null && typeof rawCells !== 'boolean' &&
    ['number','string'].includes(typeof rawCells) &&
    (typeof rawCells !== 'string' || rawCells.trim());
  const requested=valid ? Number(rawCells) : NaN;
  const activeCells=Number.isInteger(requested)?Math.max(1,Math.min(columns*rows,requested)):columns*rows;
  return {columns,rows,activeCells};
}
/**
 * A short-lived footprint index for one inventory operation. Construct it once
 * per render/move/pack; no item shapes or placements are cached across edits.
 * This prevents nested rotations, repeated normalization and O(n^3) packing.
 */
export function createPlacementScanner(shapes, config) {
  const { columns, rows, activeCells } = gridDimensions(config);
  const footprints = new Map();
  const occupied = new Map();
  const cellsFor = (id, rotation = 0) => {
    const turns = ((Math.trunc(numericField(rotation, 0)) % 4) + 4) % 4;
    let rotations = footprints.get(id);
    if (!rotations) {
      rotations = [normalizeItemShape(shapes?.[id]).cells];
      for (let turn = 1; turn < 4; turn++) {
        const rotated = rotations[turn - 1].map(cell => ({ x: -cell.y, y: cell.x }));
        const minX = Math.min(...rotated.map(cell => cell.x));
        const minY = Math.min(...rotated.map(cell => cell.y));
        rotations.push(rotated.map(cell => ({ x: cell.x - minX, y: cell.y - minY }))
          .sort((a, b) => a.y - b.y || a.x - b.x));
      }
      footprints.set(id, rotations);
    }
    return rotations[turns];
  };
  const fits = (id, index, rotation = 0) => {
    if (!Number.isSafeInteger(index) || index < 0 || index >= columns * rows) return false;
    const x = index % columns, y = Math.floor(index / columns);
    return cellsFor(id, rotation).every(cell =>
      x + cell.x >= 0 && x + cell.x < columns && y + cell.y >= 0 && y + cell.y < rows &&
      (y + cell.y) * columns + x + cell.x < activeCells &&
      !occupied.has((y + cell.y) * columns + x + cell.x));
  };
  const occupy = (id, index, rotation = 0) => {
    if (!Number.isSafeInteger(index) || index < 0 || index >= columns * rows) return;
    const x = index % columns, y = Math.floor(index / columns);
    const points = cellsFor(id, rotation).map(cell => ({ x: x + cell.x, y: y + cell.y }));
    // A corrupted saved placement must not occupy only the in-bounds half of
    // an item and create phantom collisions for other items.
    if (points.some(point => point.x < 0 || point.x >= columns || point.y < 0 || point.y >= rows ||
      point.y * columns + point.x >= activeCells || occupied.has(point.y * columns + point.x))) return;
    for (const point of points) occupied.set(point.y * columns + point.x, id);
  };
  const firstFit = (id, rotation = 0) => {
    for (let index = 0; index < columns * rows; index++) if (fits(id, index, rotation)) return index;
    return null;
  };
  return { columns, rows, occupied, cellsFor, fits, occupy, firstFit };
}

/** Find space for ANOTHER copy of a shape, without ignoring its source.
 * This differs from firstFitShape, which intentionally ignores the moving
 * item's old position. Stack splitting must consider the original occupied. */
const validSavedIndex = value => (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) &&
  Number.isSafeInteger(Number(value)) && Number(value) >= 0;

export function firstFitAdditionalShape(placements, shapes, templateId, config, rotation = 0) {
  const scan = createPlacementScanner(shapes, config);
  for (const [id, position] of Object.entries(placements || {})) {
    if (position?.area !== 'inventory' || !validSavedIndex(position.index)) continue;
    scan.occupy(id, Number(position.index), position.rotation || 0);
  }
  return scan.firstFit(templateId, rotation);
}

export function occupiedCells(placements, shapes, config, ignoreId = null) {
  const scan = createPlacementScanner(shapes, config);
  for (const [id, position] of Object.entries(placements || {})) {
    if (id === ignoreId || position?.area !== 'inventory' || !validSavedIndex(position.index)) continue;
    scan.occupy(id, Number(position.index), position.rotation || 0);
  }
  return scan.occupied;
}

export function canPlaceShape(placements, shapes, id, index, rotation, config) {
  const scan = createPlacementScanner(shapes, config);
  for (const [otherId, position] of Object.entries(placements || {})) {
    if (otherId === id || position?.area !== 'inventory' || !validSavedIndex(position.index)) continue;
    scan.occupy(otherId, Number(position.index), position.rotation || 0);
  }
  return scan.fits(id, index, rotation);
}

export function firstFitShape(placements, shapes, id, rotation, config) {
  const scan = createPlacementScanner(shapes, config);
  for (const [otherId, position] of Object.entries(placements || {})) {
    if (otherId === id || position?.area !== 'inventory' || !validSavedIndex(position.index)) continue;
    scan.occupy(otherId, Number(position.index), position.rotation || 0);
  }
  return scan.firstFit(id, rotation);
}

export function packShapes(ids, shapes, config, rotations = {}) {
  const scan = createPlacementScanner(shapes, config);
  // Largest first; stable ties in original order. Keep original rotation as
  // the preferred orientation when two orientations share the same slot.
  const ordered = [...ids].sort((a, b) => scan.cellsFor(b, rotations[b] || 0).length - scan.cellsFor(a, rotations[a] || 0).length);
  const placements = {};
  for (const id of ordered) {
    const original = ((Math.trunc(Number(rotations[id]) || 0) % 4) + 4) % 4;
    let fit = null;
    for (let turn = 0; turn < 4; turn++) {
      const rotation = (original + turn) % 4;
      const index = scan.firstFit(id, rotation);
      if (index === null) continue;
      if (!fit || index < fit.index) fit = { area: 'inventory', index, rotation };
      if (index === 0) break;
    }
    if (!fit) continue;
    placements[id] = fit;
    scan.occupy(id, fit.index, fit.rotation);
  }
  return placements;
}
