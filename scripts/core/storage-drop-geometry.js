import { numericField } from './numeric-field.js';
/** Pure cursor hit testing for multiple in-sheet storage compartments. */
export function storageBoardAt(boards, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return (boards || []).find(({rect, visibleRect, clipRect}) => {
    if (!rect || !Number.isFinite(rect.left) || !Number.isFinite(rect.top) ||
        !Number.isFinite(rect.right) || !Number.isFinite(rect.bottom)) return false;
    // The board retains its full logical coordinate system for saved slot
    // indices. Visually clipped outer cells must not accept pointer drops.
    const viewport = visibleRect ?? rect;
    const left = Math.max(viewport.left, clipRect?.left ?? -Infinity);
    const top = Math.max(viewport.top, clipRect?.top ?? -Infinity);
    const right = Math.min(viewport.right, clipRect?.right ?? Infinity);
    const bottom = Math.min(viewport.bottom, clipRect?.bottom ?? Infinity);
    return x >= left && y >= top && x < right && y < bottom;
  }) || null;
}
export function storagePlacementAt(board, x, y, grabCell=null, rotation=0) {
  if (!board || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  const {rect, columns, rows, storageId, complex=false} = board;
  if (!rect || ![rect.left,rect.top,rect.width,rect.height].every(Number.isFinite) ||
      !Number.isSafeInteger(columns) || columns<1 || !Number.isSafeInteger(rows) || rows<1 ||
      x<rect.left || y<rect.top || x>=rect.left+rect.width || y>=rect.top+rect.height) return null;
  for (const clip of [board.visibleRect, board.clipRect]) {
    if (clip && (![clip.left,clip.top,clip.right,clip.bottom].every(Number.isFinite) ||
        x<clip.left || y<clip.top || x>=clip.right || y>=clip.bottom)) return null;
  }
  const cell = rect.width / columns;
  const cellHeight = rect.height / rows;
  if (!(cell > 0) || !(cellHeight > 0)) return null;
  const hoveredX=Math.floor((x-rect.left)/cell),hoveredY=Math.floor((y-rect.top)/cellHeight);
  const grabX=complex ? numericField(grabCell?.x,0,0,columns-1,true) : 0;
  const grabY=complex ? numericField(grabCell?.y,0,0,rows-1,true) : 0;
  const originX=hoveredX-grabX;
  const originY=hoveredY-grabY;
  if(originX<0||originY<0||originX>=columns||originY>=rows)return null;
  const turns=typeof rotation==='number' && Number.isSafeInteger(rotation) ? rotation :
    typeof rotation==='string' && rotation.trim() && Number.isSafeInteger(Number(rotation)) ? Number(rotation) : 0;
  return {area:'storage',storageId,index:originY*columns+originX,rotation:complex?((turns%4)+4)%4:0};
}
