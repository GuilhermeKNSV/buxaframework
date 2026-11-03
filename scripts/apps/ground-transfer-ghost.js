/** Above-window DOM ghost for Scene, Actor and Item Directory drags.
 * Pointer events always pass through to the real storage cells underneath. */
import { MODULE_ID } from '../core/constants.js';
import { normalizeItemShape, rotatedCells, shapeBounds } from '../core/inventory-shapes.js';
import { storageArtworkStyle } from '../core/shape-artwork.js';
import { createComplexDecorationSvg } from './complex-shape-decoration.js';
import { GROUND_STORAGE_CELL_PX } from './ground-container-view.js';
let preview=null;
export function clearGroundTransferGhost() {preview?.remove?.();preview=null;}
export function showGroundTransferGhost(itemData,plan,board,{valid=true}={}) {
  if(!itemData||!board||!plan){clearGroundTransferGhost();return null;}
  const doc=board.ownerDocument||document;
  if(!preview || !preview.isConnected) {
    preview=doc.createElement('div');
    preview.className='buxa-ground-transfer-ghost buxa-inventory-drag-ghost is-complex-ghost';
    preview.style.pointerEvents='none';
    preview.setAttribute('aria-hidden','true');doc.body.appendChild(preview);
  }
  const shape=normalizeItemShape(itemData?.flags?.[MODULE_ID]?.item?.shape);
  const cells=plan.bag?.itemMode==='simple'?[{x:0,y:0}]:rotatedCells(shape,plan.rotation),bounds=shapeBounds(cells);
  const rect=board.getBoundingClientRect();
  const cellWidth=rect.width/plan.bag.columns,cellHeight=rect.height/plan.bag.rows;
  const x=plan.index%plan.bag.columns,y=Math.floor(plan.index/plan.bag.columns);
  Object.assign(preview.style,{left:`${rect.left+x*cellWidth}px`,top:`${rect.top+y*cellHeight}px`,
    width:`${bounds.width*cellWidth}px`,height:`${bounds.height*cellHeight}px`});
  preview.classList.toggle('is-invalid',!valid);
  const key=JSON.stringify([itemData?.img,shape,plan.index,plan.rotation,plan.bag?.itemMode,cellWidth,cellHeight,itemData?.flags?.[MODULE_ID]?.item?.rarityId]);
  if(preview._renderKey===key)return preview;
  preview._renderKey=key;
  preview.replaceChildren();
  const color=String(itemData?.flags?.[MODULE_ID]?.item?.rarityColor||'#92c0ec');
  preview.style.setProperty('--buxa-rarity-accent',/^#[\da-f]{6}$/i.test(color)?color:'#92c0ec');
  const backdrop=doc.createElement('div');backdrop.className='buxa-complex-backdrop';backdrop.style.cssText=storageArtworkStyle(shape,plan.rotation,plan.bag?.itemMode);preview.append(backdrop);
  const art=doc.createElement('div');art.className='buxa-complex-art';art.style.cssText=storageArtworkStyle(shape,plan.rotation,plan.bag?.itemMode);
  const img=doc.createElement('img');img.src=itemData.img||'icons/svg/item-bag.svg';img.alt='';img.draggable=false;art.append(img);preview.append(art);
  for(const point of cells) {
    const cell=doc.createElement('span');cell.className='buxa-complex-ghost-cell';
    Object.assign(cell.style,{left:`${point.x*cellWidth}px`,top:`${point.y*cellHeight}px`,width:`${cellWidth}px`,height:`${cellHeight}px`});preview.append(cell);
  }
  preview.append(createComplexDecorationSvg(doc,cells));
  return preview;
}
