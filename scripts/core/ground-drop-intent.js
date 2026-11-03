/** Shared, deterministic placement plan for every source -> ground container.
 * The hover cell is the grabbed occupied cell, not the item's top-left corner.
 * Only return a destination that the authoritative ground transfer accepts. */
import { MODULE_ID } from './constants.js';
import { normalizeItemShape, rotatedCells, shapeBounds } from './inventory-shapes.js';
import { groundCompartments, groundPlacementChecker } from './ground-container.js';

const clamp01=n=>Math.max(0,Math.min(0.999,Number.isFinite(Number(n))?Number(n):.5));
export function groundGrabbedCell(itemData, rotation=0, gripX=.5, gripY=.5) {
  const shape=normalizeItemShape(itemData?.flags?.[MODULE_ID]?.item?.shape);
  const bounds=shapeBounds(rotatedCells(shape,rotation));
  return {x:Math.min(bounds.width-1,Math.floor(clamp01(gripX)*bounds.width)),
    y:Math.min(bounds.height-1,Math.floor(clamp01(gripY)*bounds.height)),bounds};
}
export function planGroundContainerPlacement(record,itemData,{
  storageId=null,hoverIndex=null,rotation=0,gripX=.5,gripY=.5,movingContentId=null
}={}) {
  if(!record || !itemData)return null;
  const bags=groundCompartments(record).filter(bag=>!storageId||bag.storageId===storageId);
  if(!bags.length)return null;
  const start=((Math.trunc(Number(rotation)||0)%4)+4)%4;
  let best=null;
  const checker=groundPlacementChecker(record,itemData,movingContentId);
  for(const bag of bags) {
    const cols=bag.columns,rows=bag.rows;
    if(!(cols>0)||!(rows>0))continue;
    const hasHover=Number.isSafeInteger(hoverIndex)&&hoverIndex>=0&&hoverIndex<cols*rows;
    const hoverX=hasHover?hoverIndex%cols:Math.floor(cols/2);
    const hoverY=hasHover?Math.floor(hoverIndex/cols):Math.floor(rows/2);
    for(let turn=0;turn<4;turn++) {
      const nextRotation=(start+turn)%4;
      const grip=bag.itemMode==='simple'
        ? {x:0,y:0,bounds:{width:1,height:1}}
        : groundGrabbedCell(itemData,nextRotation,gripX,gripY);
      const wantedX=hoverX-grip.x,wantedY=hoverY-grip.y;
      for(let y=0;y<rows;y++)for(let x=0;x<cols;x++) {
        const index=y*cols+x;
        const score=Math.abs(x-wantedX)+Math.abs(y-wantedY)+turn*0.8;
        if(best && score>=best.score)continue;
        if(checker.fits(bag.storageId,index,nextRotation))best={storageId:bag.storageId,index,rotation:nextRotation,score,
          grabbed:{x:grip.x,y:grip.y},bounds:grip.bounds,bag};
      }
    }
  }
  return best;
}

/** A transparent/small-looking icon can still reserve more cells than the
 * artwork suggests. Explain the actual configured footprint on a failed drop. */
export function groundNoFitMessage(itemData) {
  const cells=rotatedCells(itemData?.flags?.[MODULE_ID]?.item?.shape,0);
  const size=shapeBounds(cells);
  return `No compatible space for this item's ${size.width}×${size.height} configured footprint (${cells.length} cells). Check Item Configuration → Size.`;
}
/** Where a rejected item would appear at the pointer. The red preview must
 * show the actual cell shape, not pretend that an invalid placement is legal. */
export function groundRejectedFootprint(cell,itemData,{rotation=0,gripX=.5,gripY=.5}={}) {
  if(!cell?.bag)return null;
  const turns=((Math.trunc(Number(rotation)||0)%4)+4)%4;
  const bounds=cell.bag.itemMode==='simple'?{width:1,height:1}
    :shapeBounds(rotatedCells(itemData?.flags?.[MODULE_ID]?.item?.shape,turns));
  const clip=value=>Math.min(.999,Math.max(0,Number.isFinite(Number(value))?Number(value):.5));
  const grabbedX=Math.floor(clip(gripX)*bounds.width),grabbedY=Math.floor(clip(gripY)*bounds.height);
  const column=Math.max(0,Math.min(cell.bag.columns-1,cell.column-grabbedX));
  const row=Math.max(0,Math.min(cell.bag.rows-1,cell.row-grabbedY));
  return {bag:cell.bag,index:row*cell.bag.columns+column,rotation:turns};
}
