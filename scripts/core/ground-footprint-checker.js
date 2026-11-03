/** Immutable occupancy snapshot for one ground-storage drag/placement search.
 * Existing invalid records are excluded by the same classifyGroundPlacements
 * reconciliation that renders the chest; masks/rotations remain authoritative. */
import { normalizeItemShape, rotatedCells } from './inventory-shapes.js';
import { MODULE_ID } from './constants.js';
import { safeGridIndex } from './numeric-field.js';

export function createGroundFootprintChecker(compartments, placements, shapes, itemData, movingId='new') {
  const shape=normalizeItemShape(itemData?.flags?.[MODULE_ID]?.item?.shape);
  const bags=new Map();
  for(const bag of compartments||[]) {
    const columns=Number(bag.columns),rows=Number(bag.rows);
    if(!Number.isSafeInteger(columns)||columns<1||!Number.isSafeInteger(rows)||rows<1)continue;
    const allowed=bag.mode==='complex'
      ?new Set((Array.isArray(bag.cells)?bag.cells:[]).map(i=>safeGridIndex(i,columns*rows)).filter(i=>i!==null)):null;
    const occupied=new Set();
    for(const [id,p] of Object.entries(placements||{})) {
      if(id===movingId || p?.area!=='storage' || p.storageId!==bag.storageId)continue;
      const origin=safeGridIndex(p.index,columns*rows);
      const rotation=safeGridIndex(p.rotation??0,4);
      if(origin===null || rotation===null)continue;
      const ox=origin%columns,oy=Math.floor(origin/columns);
      const footprint=(bag.itemMode??bag.mode)==='complex'
        ?rotatedCells(normalizeItemShape(shapes?.[id]),rotation):[{x:0,y:0}];
      const cells=footprint.map(cell=>({x:ox+cell.x,y:oy+cell.y}));
      // Invalid legacy placements remain recoverable, but must never block
      // unrelated cells by wrapping across rows or overlapping valid items.
      const indices=cells.map(cell=>cell.y*columns+cell.x);
      if(cells.some(cell=>cell.x<0||cell.y<0||cell.x>=columns||cell.y>=rows) ||
         indices.some(i=>(allowed&&!allowed.has(i))||occupied.has(i)))continue;
      for(const index of indices)occupied.add(index);
    }
    bags.set(bag.storageId,{bag,columns,rows,allowed,occupied});
  }
  return {
    fits(storageId,index,rotation=0) {
      const state=bags.get(storageId);
      if(!state || !Number.isSafeInteger(index)||index<0||index>=state.columns*state.rows ||
        !Number.isInteger(rotation) || rotation<0 || rotation>3)return false;
      const {bag,columns,rows,allowed,occupied}=state;
      if(movingId===bag.providerId)return false;
      // Ground root compartments have providerId='root'; only a direct child
      // may be moved into them, so no descendant cycle is possible here.
      const cells=(bag.itemMode??bag.mode)==='complex'?rotatedCells(shape,rotation):[{x:0,y:0}];
      const ox=index%columns,oy=Math.floor(index/columns);
      return cells.every(c=>{const x=ox+c.x,y=oy+c.y;
        return x>=0 && y>=0 && x<columns && y<rows &&
          (!allowed||allowed.has(y*columns+x)) && !occupied.has(y*columns+x);
      });
    }
  };
}
