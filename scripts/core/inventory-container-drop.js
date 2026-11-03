/** Decide whether dropping an Actor inventory item on another item's occupied
 * tile means "put it inside this container". Pure data logic: the caller's
 * pointer hit test determines the tile; placement uses actual storage cells.
 */
import { nearestExternalStoragePlacement } from './external-storage-placement.js';

export function resolveInventoryContainerDrop({movingId,hoveredId,compartments=[],placements={},shapes={},rotation=0}) {
  if(!movingId || !hoveredId || movingId===hoveredId)return null;
  const bags=compartments.filter(bag=>bag.providerId===hoveredId);
  if(!bags.length)return null;
  // Never fall through to an ordinary inventory move if this is a container
  // with no free cells: the item must remain where it was picked up.
  for(const bag of bags) {
    for(let turn=0;turn<4;turn++) {
      const start=Number.isInteger(rotation)?rotation:0;
      const candidateRotation=((start+turn)%4+4)%4;
      const index=nearestExternalStoragePlacement({
        compartment:bag,placements,shapes,itemId:movingId,requestedIndex:0,rotation:candidateRotation
      });
      if(index!==null)return {providerId:hoveredId,valid:true,destination:{
        area:'storage',storageId:bag.storageId,index,rotation:candidateRotation,containerDrop:true
      }};
    }
  }
  return {providerId:hoveredId,valid:false,destination:{
    area:'storage',storageId:bags[0].storageId,index:-1,rotation,containerDrop:true
  }};
}
