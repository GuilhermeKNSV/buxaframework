/** Shared preview/commit planner for external items (Scene -> Inventory and
 * Item Directory -> Inventory). The display uses the same masked artwork,
 * rarity accents, and 90-degree rotations as an internal complex-grid drag. */
import { MODULE_ID } from '../core/constants.js';
import { getSheetConfig } from '../core/config.js';
import { getItemRarity } from '../core/item-config.js';
import { getInventoryState, getEffectiveInventoryConfig, getActorStorage } from '../core/inventory.js';
import { normalizeItemShape, rotatedCells, shapeBounds } from '../core/inventory-shapes.js';
import { shapeArtworkStyle } from '../core/shape-artwork.js';
import { createComplexDecorationSvg } from '../apps/complex-shape-decoration.js';
import { nearestExternalComplexPlacement } from '../core/external-item-placement.js';
import { nearestExternalStoragePlacement } from '../core/external-storage-placement.js';
import { measureComplexBoard } from '../core/complex-drag-geometry.js';

let preview=null, session=null;
const itemKey=item=>String(item?.id || item?._id || item?.img || item?.data?.img || item?.name||'');
const asFlags=item=>item?.flags || item?.data?.flags || {};
const rawShape=item=>item?.getFlag?.(MODULE_ID,'item')?.shape ?? asFlags(item)?.[MODULE_ID]?.item?.shape;
const itemImage=item=>item?.img ?? item?.data?.img ?? 'icons/svg/item-bag.svg';
const existingActor=(target,sceneId) => {
  const actorId=target?.actorId;
  if(!actorId)return null;
  if(target?.targetTokenId) {
    const token=game.scenes?.get?.(sceneId)?.tokens?.get?.(target.targetTokenId);
    return token?.actor?.id===actorId?token.actor:null;
  }
  return game.actors?.get?.(actorId)??null;
};
export function beginPhysicalInventoryDrag(item,{gripX=.5,gripY=.5}={}) {
  const valid=n=>Number.isFinite(Number(n))?Math.min(.999,Math.max(0,Number(n))):.5;
  session={key:itemKey(item),rotation:0,gripX:valid(gripX),gripY:valid(gripY),last:null};
  clearPhysicalInventoryPreview();
}
export function endPhysicalInventoryDrag() {clearPhysicalInventoryPreview();session=null;}
export function clearPhysicalInventoryPreview() {preview?.remove?.();preview=null;}
export function activePhysicalInventoryRotation() {return session?.rotation||0;}
export function hasActivePhysicalInventoryDrag() {return Boolean(session);}
export function activePhysicalInventoryGrip() {return {gripX:session?.gripX??.5,gripY:session?.gripY??.5};}
export function rotatePhysicalInventoryPreview() {
  if(!session)return false;
  session.rotation=(session.rotation+1)%4;
  const last=session.last;
  if(preview){preview._buxaHoverKey=null;preview._buxaRenderKey=null;}
  if(last)showPhysicalInventoryPreview(last.item,last.target,last.x,last.y);
  return true;
}
function ensurePreview() {
  if(preview)return preview;
  const div=document.createElement('div');
  div.className='buxa-external-inventory-preview buxa-inventory-drag-ghost is-complex-ghost';
  div.setAttribute('aria-hidden','true');div.style.pointerEvents='none';
  document.body.append(div);preview=div;return div;
}
function matchedSheet(actor,x,y) {
  const hover=document.elementFromPoint?.(x,y)?.closest?.('[data-buxa-drop-actor-id]');
  return (hover?.dataset?.buxaDropActorId===actor.id ? hover : null)
    ||document.querySelector?.(`[data-buxa-drop-actor-id="${globalThis.CSS?.escape?.(actor.id)??actor.id}"]`);
}
function matchedBoard(actor,x,y,storageId=null) {
  const root=matchedSheet(actor,x,y);
  if(!root)return null;
  if(storageId) return [...(root.querySelectorAll?.('[data-storage-board]')??[])]
    .find(board=>board.dataset.storageBoard===storageId) ?? null;
  return root.querySelector?.('[data-complex-board]');
}
export function externalPreviewGripOffset(bounds, grip=session) {
  return {
    x:Math.min(bounds.width-1,Math.max(0,Math.floor((grip?.gripX??.5)*bounds.width))),
    y:Math.min(bounds.height-1,Math.max(0,Math.floor((grip?.gripY??.5)*bounds.height)))
  };
}
export function describeExternalInventoryPreview({item,actor,target,x,y,rotation=0}) {
  if(!item || !actor || !target)return null;
  const config=getSheetConfig();
  const inventory=getEffectiveInventoryConfig(actor,config);
  const position=target.position;
  const shape=normalizeItemShape(rawShape(item));
  const useComplex=inventory.mode==='complex';
  const cells=useComplex?rotatedCells(shape,rotation):[{x:0,y:0}];
  const bounds=shapeBounds(cells);
  const grip=externalPreviewGripOffset(bounds);
  const storageId=position?.area==='storage'?position.storageId:null;
  const board=matchedBoard(actor,x,y,storageId);
  let geometry=null,columns=0,rows=0;
  if(storageId && board) {
    const bag=getActorStorage(actor,config).compartments.find(b=>b.storageId===storageId);
    if(!bag)return null;
    const rect=board.getBoundingClientRect?.();
    columns=bag.columns;rows=bag.rows;
    if(rect?.width && rect?.height)geometry={left:rect.left,top:rect.top,
      cellSize:rect.width/columns,cellHeight:rect.height/rows,columns,rows};
  } else if(board) {
    geometry=measureComplexBoard(board);
    columns=geometry?.columns||0;rows=geometry?.rows||0;
  }
  if(geometry && (storageId || (useComplex && position?.area==='inventory'))) {
    const hoveredX=Math.floor((x-geometry.left)/geometry.cellSize);
    const hoveredY=Math.floor((y-geometry.top)/geometry.cellHeight);
    if(hoveredX<0||hoveredX>=columns||hoveredY<0||hoveredY>=rows)return null;
    const desiredX=hoveredX-grip.x,desiredY=hoveredY-grip.y;
    const preferred=desiredX>=0&&desiredX<columns&&desiredY>=0&&desiredY<rows
      ?desiredY*columns+desiredX : null;
    const requested=preferred ?? (Number.isInteger(position.index)?position.index:null);
    const state=getInventoryState(actor,config);
    const shapes=Object.fromEntries([...(actor.items??[])].map(doc=>[doc.id,doc.getFlag?.(MODULE_ID,'item')?.shape]));
    const temporaryId='__buxa_incoming_preview__';shapes[temporaryId]=shape;
    let fit=null;
    if(storageId) {
      const bag=getActorStorage(actor,config).compartments.find(e=>e.storageId===storageId);
      fit=nearestExternalStoragePlacement({compartment:bag,placements:state.placements,shapes,
        itemId:temporaryId,requestedIndex:requested,rotation,maxDistance:Math.SQRT2+.01});
    } else {
      const nearest=nearestExternalComplexPlacement({placements:state.placements,shapes,itemId:temporaryId,
        requestedIndex:requested,rotation,grid:inventory.complex});
      if(nearest!==null && requested!==null) {
        const dx=nearest%columns-requested%columns;
        const dy=Math.floor(nearest/columns)-Math.floor(requested/columns);
        if(Math.hypot(dx,dy)<=Math.SQRT2+.01)fit=nearest;
      }
    }
    const valid=fit!==null;
    // On blocked cells the invalid preview stays under the pointer instead
    // of teleporting across the board to a distant available origin.
    const visualX=valid ? fit%columns : desiredX;
    const visualY=valid ? Math.floor(fit/columns) : desiredY;
    return {valid,left:geometry.left+visualX*geometry.cellSize,
      top:geometry.top+visualY*geometry.cellHeight,
      cellWidth:geometry.cellSize,cellHeight:geometry.cellHeight,cells,bounds,shape,rotation,
      img:itemImage(item),snappedIndex:fit,storageId,area:storageId?'storage':'inventory'};
  }
  const cell=42;
  return {valid:true,left:x-cell/2,top:y-cell/2,cellWidth:cell,cellHeight:cell,
    cells:[{x:0,y:0}],bounds:{width:1,height:1},shape,rotation:0,img:itemImage(item),snappedIndex:null};
}
/** The *same* planning calculation for preview and final GM transfer. */
export function externalInventoryDropPosition(item,target,x,y) {
  const position=target?.position;
  if(!position || !['inventory','storage'].includes(position.area) || position.auto)return position??null;
  const actor=existingActor(target,globalThis.canvas?.scene?.id);
  if(!actor)return position;
  const rotation=activePhysicalInventoryRotation();
  const planned=describeExternalInventoryPreview({item,actor,target,x,y,rotation});
  if(!planned || planned.snappedIndex===null || planned.snappedIndex===undefined)
    return {...position,index:-1,rotation,strict:true};
  return {...position,index:planned.snappedIndex,rotation,strict:true};
}
export function showPhysicalInventoryPreview(item,target,x,y) {
  if(!item || target?.kind!=='actor'){clearPhysicalInventoryPreview();return null;}
  const actor=existingActor(target,globalThis.canvas?.scene?.id);
  if(!actor){clearPhysicalInventoryPreview();return null;}
  if(!session || session.key!==itemKey(item))beginPhysicalInventoryDrag(item);
  session.last={item,target,x,y};
  const rotation=session.rotation;
  const hoverKey=['inventory','storage'].includes(target.position?.area) ? JSON.stringify([
    actor.id,actor._stats?.modifiedTime ?? actor.items?.size ?? 0,
    itemKey(item),target.position.index,target.position.storageId,rotation,rawShape(item),session?.gripX,session?.gripY]) : null;
  if(hoverKey && preview?._buxaHoverKey===hoverKey)return preview._buxaData;
  let data;
  try {data=describeExternalInventoryPreview({item,actor,target,x,y,rotation});}
  catch(error) {console.warn(`${MODULE_ID} | External inventory preview failed`,error);clearPhysicalInventoryPreview();return null;}
  if(!data){clearPhysicalInventoryPreview();return null;}
  const element=ensurePreview();element._buxaHoverKey=hoverKey;element._buxaData=data;
  const {left,top,cellWidth,cellHeight,cells,bounds,valid,img,shape}=data;
  element.style.left=`${left}px`;element.style.top=`${top}px`;
  element.style.width=`${bounds.width*cellWidth}px`;
  element.style.height=`${bounds.height*cellHeight}px`;
  element.classList.toggle('is-invalid',!valid);
  const rarity=getItemRarity({getFlag:()=>asFlags(item)?.[MODULE_ID]?.item},getSheetConfig());
  const accent=/^#[0-9a-f]{6}$/i.test(rarity?.color)?rarity.color:'#91a7bb';
  element.style.setProperty('--buxa-rarity-color',accent);
  element.style.setProperty('--buxa-rarity-accent',accent);
  element.style.setProperty('--buxa-rarity-bg-opacity','1');
  element.style.setProperty('--buxa-rarity-bg-brightness','1');
  element.classList.toggle('has-rarity-ornament',Boolean(rarity?.ornament));
  element.classList.toggle('has-rarity-glint',Boolean(rarity?.glint));
  element.classList.toggle('is-rarity-spectrum',Boolean(rarity?.spectrum));
  element.classList.toggle('is-rarity-animated',Boolean(rarity?.animated));
  element.classList.toggle('buxa-rarity-bg-full',rarity?.backgroundMode==='full');
  const renderKey=JSON.stringify([data.snappedIndex,valid,img,bounds,cellWidth,cellHeight,cells,rotation,accent,rarity]);
  if(element._buxaRenderKey===renderKey)return data;
  element._buxaRenderKey=renderKey;
  element.replaceChildren();
  const backdrop=document.createElement('div');backdrop.className='buxa-complex-backdrop';
  backdrop.style.cssText=shapeArtworkStyle(shape,rotation);element.append(backdrop);
  const art=document.createElement('div');art.className='buxa-complex-art';
  art.style.cssText=shapeArtworkStyle(shape,rotation);
  const image=document.createElement('img');image.src=img;image.alt='';image.draggable=false;art.append(image);element.append(art);
  for(const point of cells) {
    const tile=document.createElement('span');tile.className='buxa-complex-ghost-cell';
    Object.assign(tile.style,{left:`${point.x*cellWidth}px`,top:`${point.y*cellHeight}px`,
      width:`${cellWidth}px`,height:`${cellHeight}px`});element.append(tile);
  }
  element.append(createComplexDecorationSvg(document,cells));
  const hint=document.createElement('span');
  hint.className='buxa-external-rotate-hint';hint.textContent='R · Rotate';
  element.append(hint);
  return data;
}
