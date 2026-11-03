/** Pure grid hit testing for the uncropped logical geometry of open storage.
 * UI windows use it without depending on DOM elements or Foundry globals. */
export function groundCellAtPoint(x,y,rect,bag) {
  if(!Number.isFinite(x) || !Number.isFinite(y) || !rect ||
    !Number.isFinite(rect.left) || !Number.isFinite(rect.top) ||
    !(rect.width>0) || !(rect.height>0) || !(bag?.columns>0) || !(bag?.rows>0))return null;
  const column=Math.floor((x-rect.left)/(rect.width/bag.columns));
  const row=Math.floor((y-rect.top)/(rect.height/bag.rows));
  if(column<0||column>=bag.columns||row<0||row>=bag.rows)return null;
  const index=row*bag.columns+column;
  if(bag.mode==='complex' && !bag.cells?.includes?.(index))return null;
  return {column,row,index};
}
/** The cropped viewport displays a subset of the original full grid.
 * Convert hit points using the board's real screen rectangle, never a
 * visually reindexed 3x3 mask. */
export function groundVisibleCellAtPoint(x,y,{viewportRect,boardRect,bag}={}) {
  if(!Number.isFinite(x) || !Number.isFinite(y) || !viewportRect || !boardRect ||
    !Number.isFinite(boardRect.left) || !Number.isFinite(boardRect.top) ||
    !Number.isFinite(viewportRect.left) || !Number.isFinite(viewportRect.top) ||
    !Number.isFinite(viewportRect.right) || !Number.isFinite(viewportRect.bottom) ||
    !(bag?.columns>0) || !(bag?.rows>0))return null;
  if(x<viewportRect.left || y<viewportRect.top || x>=viewportRect.right || y>=viewportRect.bottom ||
    !(boardRect.width>0) || !(boardRect.height>0))return null;
  const column=Math.floor((x-boardRect.left)/(boardRect.width/bag.columns));
  const row=Math.floor((y-boardRect.top)/(boardRect.height/bag.rows));
  if(column<0||column>=bag.columns||row<0||row>=bag.rows)return null;
  const index=row*bag.columns+column;
  if(bag.mode==='complex' && !bag.cells?.includes?.(index))return null;
  return {column,row,index};
}
