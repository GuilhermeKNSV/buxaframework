/**
 * Adapter between external-compartment index masks and the shared item-shape
 * editor model. All geometry stays in grid coordinates, never DOM coordinates.
 */
import {connectedCells, neighboringCell, toggleFootprintCell} from './shape-editor-model.js';

export function centeredStorageCell(columns, rows) {
  const width = Math.max(1, Math.floor(Number(columns) || 1));
  const height = Math.max(1, Math.floor(Number(rows) || 1));
  return Math.floor((height - 1) / 2) * width + Math.floor((width - 1) / 2);
}

export function indicesToStorageCells(indices, columns, rows) {
  const width = Math.max(1, Math.floor(Number(columns) || 1));
  const height = Math.max(1, Math.floor(Number(rows) || 1));
  const result = [];
  const seen = new Set();
  for (const raw of indices || []) {
    const index = Number(raw);
    if (!Number.isInteger(index) || index < 0 || index >= width * height || seen.has(index)) continue;
    seen.add(index);
    result.push({x: index % width, y: Math.floor(index / width)});
  }
  return result;
}

export function storageCellsToIndices(cells, columns) {
  const width = Math.max(1, Math.floor(Number(columns) || 1));
  return cells.map(({x, y}) => y * width + x).sort((a,b)=>a-b);
}

export function toggleStorageCell(indices, columns, rows, index) {
  const width = Math.max(1, Math.floor(Number(columns) || 1));
  const height = Math.max(1, Math.floor(Number(rows) || 1));
  if (!Number.isInteger(index) || index < 0 || index >= width * height) return null;
  const original = indicesToStorageCells(indices,width,height);
  const source = original.length ? original : indicesToStorageCells([centeredStorageCell(width,height)],width,height);
  const next = toggleFootprintCell(source,{x:index%width,y:Math.floor(index/width)},Math.max(width,height));
  return next ? storageCellsToIndices(next,width) : null;
}

export function storageAdjacent(indices, columns, rows, index) {
  const width = Math.max(1, Math.floor(Number(columns) || 1));
  const height = Math.max(1, Math.floor(Number(rows) || 1));
  if (index < 0 || index >= width*height || indices.includes(index)) return false;
  return neighboringCell({x:index%width,y:Math.floor(index/width)}, indicesToStorageCells(indices,width,height));
}

export function resizeStorageMask(indices, oldColumns, oldRows, columns, rows) {
  const width = Math.max(1, Math.floor(Number(columns) || 1));
  const height = Math.max(1, Math.floor(Number(rows) || 1));
  const remaining = indicesToStorageCells(indices,oldColumns,oldRows)
    .filter(({x,y})=>x<width && y<height);
  // Retain existing coordinates, not the same flat indices (which would move
  // cells horizontally whenever the user adjusts the number of columns).
  return remaining.length ? storageCellsToIndices(remaining,width) : [centeredStorageCell(width,height)];
}

/** Explain why a painted slot can/cannot be removed. Keep masks connected
 * and nonempty so an edit cannot strand saved contents in two islands. */
export function storageRemovalResult(indices,columns,rows,index) {
  const valid=indicesToStorageCells(indices,columns,rows);
  const flat=storageCellsToIndices(valid,columns);
  if(!flat.includes(index))return {allowed:false,reason:'That storage slot is not active.'};
  if(flat.length<=1)return {allowed:false,reason:'Storage must keep at least one slot.'};
  const next=toggleStorageCell(flat,columns,rows,index);
  if(!next)return {allowed:false,reason:'Removing that slot would split the storage into disconnected sections.'};
  return {allowed:true,cells:next};
}

export {connectedCells};
