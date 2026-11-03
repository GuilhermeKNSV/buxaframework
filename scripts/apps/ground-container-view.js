/** Stateless ground-container HTML and per-item change planning. The working
 * drag controller retains the established DOM classes and event contracts. */
import { MODULE_ID } from '../core/constants.js';
import { getSheetConfig } from '../core/config.js';
import { normalizeItemSystemConfig } from '../core/item-config.js';
import { normalizeItemShape, rotatedCells, shapeBounds } from '../core/inventory-shapes.js';
import { storageArtworkStyle } from '../core/shape-artwork.js';
import { stackArtworkFor, stackArtworkMarkup } from '../core/item-stack-artwork.js';
import { physicalQuantity } from '../core/physical-items.js';
import { storageVisibleBounds } from '../core/item-storage.js';
import { classifyGroundPlacements } from '../core/ground-container.js';
export const GROUND_STORAGE_CELL_PX=58;
const html=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rarityOf=data=>{
 try {const list=normalizeItemSystemConfig(getSheetConfig().items).rarities;
 return list.find(r=>r.id===data?.flags?.[MODULE_ID]?.item?.rarityId)||list.find(r=>r.id==='common')||list[0];}
 catch {return {color:'#8aacc8'};}
};
export function groundWindowLayout(specs=[]) {
 const views=specs.map(bag=>({bag,crop:storageVisibleBounds(bag)}));
 const columns=Math.max(1,...views.map(({crop})=>crop.columns));
 return {views,columns,width:columns*GROUND_STORAGE_CELL_PX+2};
}
/** Preserve malformed/legacy placements without letting them cover other
 * active squares. They are shown in a recovery strip and can be dragged back
 * onto a compatible cell; no positions are silently rewritten or deleted. */
export function classifyGroundContents(specs,contents) {
 // The visible footprint and the server's placement validator must agree.
 // Older positions outside a modified storage mask are recovery items.
 return classifyGroundPlacements(specs,contents);
}

export const groundItemFingerprint=entry=>JSON.stringify({id:entry.sourceId,compartmentId:entry.compartmentId,
 index:entry.index,rotation:entry.rotation,quantity:physicalQuantity(entry.data),data:entry.data});
export function diffGroundEntries(previous,contents) {
 const next=new Map(contents.map(entry=>[entry.sourceId,groundItemFingerprint(entry)]));
 return {next,removed:[...previous.keys()].filter(id=>!next.has(id)),
 changed:contents.filter(entry=>previous.get(entry.sourceId)!==next.get(entry.sourceId))};
}
export const groundLayoutFingerprint=(record,views)=>JSON.stringify({name:record.data?.name,img:record.data?.img,
 grids:views.map(({bag,crop})=>({id:bag.storageId,columns:bag.columns,rows:bag.rows,cells:bag.cells,
 mode:bag.mode,itemMode:bag.itemMode,crop,color:bag.color,label:bag.label}))});
export function groundMarkupItem(entry,bag) {
  const shape=normalizeItemShape(entry.data?.flags?.[MODULE_ID]?.item?.shape);
  const cells=bag.itemMode==='simple'?[{x:0,y:0}]:rotatedCells(shape,entry.rotation||0),bounds=shapeBounds(cells);
  const rarity=rarityOf(entry.data);
  const color=/^#[0-9a-f]{6}$/i.test(rarity?.color||'')?rarity.color:'#8aacc8';
  const x=entry.index%bag.columns,y=Math.floor(entry.index/bag.columns);
  const rect=cells.length===bounds.width*bounds.height&&(bounds.width>1||bounds.height>1);
  const quantity=physicalQuantity(entry.data);
  const art=stackArtworkFor(entry.data,quantity);
  const tone=[rarity?.animated?'is-rarity-animated':'',rarity?.glint?'has-rarity-glint':'',rarity?.ornament?'has-rarity-ornament':'',rarity?.spectrum?'is-rarity-spectrum':'',rect?'is-rectangular-shape':''].filter(Boolean).join(' ');
  return `<div class="buxa-complex-item buxa-inventory-item ${tone}" data-ground-content-id="${html(entry.sourceId)}" tabindex="0" role="button" aria-label="Move ${html(entry.data?.name||'Item')}" data-ground-index="${entry.index}" data-ground-storage-id="${html(bag.storageId)}" title="${html(entry.data?.name||'Item')}" style="--buxa-rarity-color:${color};--buxa-rarity-accent:${color};--buxa-shape-x:${x};--buxa-shape-y:${y};--buxa-shape-w:${bounds.width};--buxa-shape-h:${bounds.height}">
    <div class="buxa-complex-backdrop" style="${html(storageArtworkStyle(shape,entry.rotation||0,bag.itemMode))}"></div>
    <div class="buxa-complex-art" style="${html(storageArtworkStyle(shape,entry.rotation||0,bag.itemMode))}">${stackArtworkMarkup(art,html)}</div>
    ${cells.map(c=>`<span class="buxa-complex-piece" style="--buxa-cx:${c.x};--buxa-cy:${c.y};--buxa-shape-w:${bounds.width};--buxa-shape-h:${bounds.height}" data-buxa-piece-x="${c.x}" data-buxa-piece-y="${c.y}"></span>`).join('')}
    ${quantity>1?`<b class="buxa-item-quantity">×${quantity}</b>`:''}
  </div>`;
}

export function groundCompartmentMarkup(views,contents,multiple) {
 const {valid,unplaced}=classifyGroundContents(views.map(view=>view.bag),contents);
 const compartments=views.map(({bag,crop})=>`<section class="buxa-storage-compartment buxa-ground-compartment" data-ground-compartment="${html(bag.storageId)}" style="--buxa-storage-columns:${bag.columns};--buxa-storage-rows:${bag.rows};--buxa-storage-visible-columns:${crop.columns};--buxa-storage-visible-rows:${crop.rows};--buxa-storage-crop-x:${crop.x};--buxa-storage-crop-y:${crop.y};--buxa-storage-color:${html(bag.color||'#6387a9')};width:${crop.columns*GROUND_STORAGE_CELL_PX}px;">${multiple?`<header><strong>${html(bag.label)}</strong></header>`:''}<div class="buxa-storage-board-scroll" style="width:${crop.columns*GROUND_STORAGE_CELL_PX}px;"><div class="buxa-storage-board-viewport" data-ground-visible-viewport style="position:relative;width:${crop.columns*GROUND_STORAGE_CELL_PX}px;height:${crop.rows*GROUND_STORAGE_CELL_PX}px;overflow:hidden;"><div class="buxa-storage-grid is-complex" data-ground-storage-id="${html(bag.storageId)}" style="--buxa-storage-columns:${bag.columns};--buxa-storage-rows:${bag.rows};position:absolute;left:${-crop.x*GROUND_STORAGE_CELL_PX}px;top:${-crop.y*GROUND_STORAGE_CELL_PX}px;width:${bag.columns*GROUND_STORAGE_CELL_PX}px;height:${bag.rows*GROUND_STORAGE_CELL_PX}px;">${Array.from({length:bag.columns*bag.rows},(_,i)=>`<div class="buxa-storage-cell ${bag.mode==='complex'&&!bag.cells.includes(i)?'is-disabled':''}" data-ground-storage-id="${html(bag.storageId)}" data-ground-index="${i}" tabindex="0" role="gridcell" aria-label="Slot ${i+1}"></div>`).join('')}${valid.filter(item=>item.compartmentId===bag.id).map(item=>groundMarkupItem(item,bag)).join('')}</div></div></div></section>`).join('');
 if(!unplaced.length)return compartments;
 // A recovery strip appears ONLY when saved contents cannot occupy the
 // current custom mask. Unlike silent normalization, this never loses items.
 const broken=unplaced.map(entry=>`<div class="buxa-ground-recovery-item" data-ground-recovery-item="${html(entry.sourceId)}" data-ground-content-id="${html(entry.sourceId)}" role="button" tabindex="0" title="Move this item into an available slot"><img src="${html(entry.data?.img||'icons/svg/item-bag.svg')}" alt=""><span>${html(entry.data?.name||'Item')}</span></div>`).join('');
 return compartments+`<section class="buxa-ground-recovery" aria-label="Items needing placement"><strong>Unplaced items</strong><small>Storage shape changed. Drag these items into a valid slot.</small><div class="buxa-ground-recovery-list">${broken}</div></section>`;
}
