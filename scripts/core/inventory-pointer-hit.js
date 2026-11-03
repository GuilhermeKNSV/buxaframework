/** Exact cell-based hit testing, independent of oversized item artwork,
 * transparent bounding boxes and DOM z-order. */
export function cellIndexAt(geometry, x, y) {
  if (!geometry || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const {left,top,columns,rows,cellSize}=geometry;
  const height=geometry.cellHeight || cellSize;
  if (!(cellSize>0) || !(height>0) || !(columns>0) || !(rows>0)) return null;
  const col=Math.floor((x-left)/cellSize), row=Math.floor((y-top)/height);
  if (col<0 || row<0 || col>=columns || row>=rows) return null;
  return row*columns+col;
}
export function resolveComplexPointerHit(geometry,x,y,cellOwners) {
  const index=cellIndexAt(geometry,x,y);
  if (index === null) return {index:null,itemId:null};
  const owner = cellOwners?.get?.(index);
  return {index,itemId:owner || null};
}
