/** Resolve direct-on-backpack drops using the same occupied-cell map as the
 * Complex inventory pointer handler. DOM hit testing is used only for Simple.
 * Read the Actor snapshot once per drag, not on every pointer move.
 */
import { cellIndexAt } from '../core/inventory-pointer-hit.js';
import { isOverComplexBoard } from '../core/complex-drag-geometry.js';
import { resolveInventoryContainerDrop } from '../core/inventory-container-drop.js';

export function createInventoryContainerHit({itemId,isComplex,
  geometry,scanner,grants,state,shapes}) {
  const cache=new Map();
  return {
    at(x,y,pointerTarget,rotation=0) {
      let hoveredId=null;
      if(isComplex && isOverComplexBoard(geometry(),x,y)) {
        hoveredId=scanner()?.occupied.get(cellIndexAt(geometry(),x,y)) || null;
      } else {
        const node=pointerTarget?.closest?.('[data-item-id]');
        if(node?.closest?.('[data-inventory-index]'))hoveredId=node.dataset.itemId;
      }
      if(!hoveredId || hoveredId===itemId)return null;
      const key=`${hoveredId}:${rotation}`;
      if(cache.has(key))return cache.get(key);
      const pockets=grants().compartments;
      if(!pockets.some(bag=>bag.providerId===hoveredId))return null;
      const result=resolveInventoryContainerDrop({movingId:itemId,hoveredId,
        compartments:pockets,placements:state().placements,shapes:shapes(),rotation});
      cache.set(key,result);
      return result;
    },
    clear() { cache.clear(); }
  };
}

/** Cheap hover feedback for a backpack item tile, never a second drag ghost. */
export function createInventoryContainerMarker(root) {
  let active=null,tiles=null;
  const clear=()=>{active?.classList.remove('is-container-drop-target','is-container-drop-full');active=null;};
  return {
    show(location) {
      if(location?.containerDrop && !tiles)tiles=new Map(
        [...root.querySelectorAll('[data-item-id]')]
          .filter(node=>node.closest('[data-inventory-index], [data-complex-board]') &&
            !node.closest('[data-storage-board]'))
          .map(node=>[node.dataset.itemId,node]));
      const next=location?.containerDrop
        ? tiles.get(String(location.storageId||'').split(':')[0]) : null;
      if(active!==next){clear();active=next;}
      active?.classList.toggle('is-container-drop-target',location.index>=0);
      active?.classList.toggle('is-container-drop-full',location.index<0);
    },
    clear
  };
}
