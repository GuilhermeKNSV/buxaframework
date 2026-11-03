/** Shared shape-aware placement for items arriving from the Scene/Directory.
 * Only seeks real, non-overlapping grid origins; never treats a transparent
 * rectangle around an L/T-shaped item as occupied. Pure: no document writes. */
import { createPlacementScanner } from './inventory-shapes.js';

export function nearestExternalComplexPlacement({ placements = {}, shapes = {}, itemId, requestedIndex = null,
  rotation = 0, grid }) {
  if (!itemId || !grid) return null;
  const scanner=createPlacementScanner(shapes,grid);
  for(const [id,location] of Object.entries(placements)) {
    if(id===itemId || location?.area!=='inventory' || !Number.isInteger(Number(location.index)))continue;
    scanner.occupy(id,Number(location.index),Number(location.rotation||0));
  }
  const {columns,rows}=scanner;
  const requested=Number(requestedIndex);
  if (requestedIndex!==null && requestedIndex!==undefined && Number.isInteger(requested) &&
      requested>=0 && requested<columns*rows && scanner.fits(itemId,requested,rotation)) return requested;
  const at=Number.isInteger(requested) && requestedIndex!=null && requested>=0 && requested<columns*rows
    ? {x:requested%columns,y:Math.floor(requested/columns)} : null;
  let closest=null,score=Infinity;
  for(let index=0;index<columns*rows;index++) {
    if(!scanner.fits(itemId,index,rotation))continue;
    const x=index%columns,y=Math.floor(index/columns);
    const distance=at ? (x-at.x)**2+(y-at.y)**2 : index;
    if(distance<score){closest=index;score=distance;}
  }
  return closest;
}
