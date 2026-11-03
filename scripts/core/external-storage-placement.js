/** Safe nearest occupied-cell-aware placement into an equipped pouch.
 * Unlike a normal inventory grid, pouches may have a masked cell shape and
 * must never silently fall back to the Actor's main inventory. */
import { fitsExternalStorage } from './item-storage.js';

export function nearestExternalStoragePlacement({compartment,placements={},shapes={},itemId,
  requestedIndex=null,rotation=0,maxDistance=Infinity}) {
  if(!compartment || !itemId) return null;
  const {columns,rows}=compartment;
  const candidate=Number(requestedIndex);
  const inRange=requestedIndex!==null && requestedIndex!==undefined && Number.isInteger(candidate) && candidate>=0 && candidate<columns*rows;
  if(inRange && fitsExternalStorage(compartment,placements,shapes,itemId,candidate,rotation))return candidate;
  if(!inRange || !Number.isFinite(maxDistance) && maxDistance!==Infinity)return null;
  const rx=candidate%columns,ry=Math.floor(candidate/columns);
  let closest=null,score=Infinity;
  for(let index=0;index<columns*rows;index++) {
    if(!fitsExternalStorage(compartment,placements,shapes,itemId,index,rotation))continue;
    const dx=index%columns-rx,dy=Math.floor(index/columns)-ry;
    const distance=Math.hypot(dx,dy);
    if(distance<score && distance<=maxDistance){score=distance;closest=index;}
  }
  return closest;
}

/** A drop on a compartment header has no specific cell. Resolve the first
 * actual free and enabled tile, including custom masks, before committing. */
export function resolveAutomaticStorageDrop(destination, { compartments = [], placements = {}, shapes = {}, itemId } = {}) {
  if (destination?.area !== 'storage' || destination.auto !== true) return destination;
  const compartment = compartments.find(bag => bag.storageId === destination.storageId);
  // A header/background drop has no user-selected cell or orientation.
  // First prefer the given orientation; if only a rotated footprint fits,
  // try the other orientations rather than rejecting an otherwise valid bag.
  const start = ((Math.trunc(Number(destination.rotation) || 0) % 4) + 4) % 4;
  for (let offset = 0; offset < (compartment?.itemMode === 'complex' ? 4 : 1); offset++) {
    const rotation = (start + offset) % 4;
    const index = nearestExternalStoragePlacement({
      compartment, placements, shapes, itemId, requestedIndex: 0, rotation
    });
    if (index !== null) return {
      area: 'storage', storageId: compartment.storageId, index, rotation
    };
  }
  return null;
}
