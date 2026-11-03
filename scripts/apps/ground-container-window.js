/** Ground storage uses the SAME complex-item artwork/grid language as Player
 * Inventory. Mouse drag is pointer-based and transfers are GM serialized.
 * No selectors, no click-to-loot, no intermediate Actor needed. */
import { MODULE_ID } from '../core/constants.js';
import { groundVisibleCellAtPoint } from '../core/ground-window-hit-geometry.js';
export { groundCellAtPoint,groundVisibleCellAtPoint } from '../core/ground-window-hit-geometry.js';
import { scenePhysicalItems, canInteractPhysical, PHYSICAL_SETTINGS, normalizePhysicalSettings, physicalQuantity } from '../core/physical-items.js';
import { groundCompartments, groundDirectItems, groundMoveWithin, groundPlacementChecker } from '../core/ground-container.js';
import { normalizeItemShape, rotatedCells, shapeBounds } from '../core/inventory-shapes.js';
import { storageArtworkStyle } from '../core/shape-artwork.js';
import { getSheetConfig } from '../core/config.js';
import { GROUND_STORAGE_CELL_PX, groundWindowLayout, groundCompartmentMarkup, groundMarkupItem,
  groundLayoutFingerprint, diffGroundEntries, classifyGroundContents } from './ground-container-view.js';
export { GROUND_STORAGE_CELL_PX, groundWindowLayout };
import { normalizeItemSystemConfig } from '../core/item-config.js';
import { createComplexDecorationSvg } from './complex-shape-decoration.js';
import { requestPhysicalAction } from '../integrations/physical-item-transfers.js';
import { notifyError, notifySuccess, notifyWarning } from '../core/notifications.js';
import { physicalDropTargetFromClient } from '../integrations/physical-item-drop-targets.js';
import { canvasItemDropTarget } from '../integrations/canvas-item-drop-target.js';
import { boardScenePoint } from '../integrations/physical-item-ghost.js';
import { beginPhysicalInventoryDrag, showPhysicalInventoryPreview, endPhysicalInventoryDrag, externalInventoryDropPosition, rotatePhysicalInventoryPreview } from '../integrations/physical-inventory-preview.js';
import { planGroundContainerPlacement, groundNoFitMessage, groundRejectedFootprint } from '../core/ground-drop-intent.js';
export { groundNoFitMessage };
import { showGroundTransferGhost, clearGroundTransferGhost } from './ground-transfer-ghost.js';
import { nativeWorldDragItem } from '../integrations/native-world-drag-session.js';
import { activePhysicalInventoryRotation, activePhysicalInventoryGrip } from '../integrations/physical-inventory-preview.js';

const html=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let windowState=null;
const actors=()=>game.actors?.contents??[...(game.actors??[])];
const worldRecord=state=>scenePhysicalItems(game.scenes?.get?.(state.sceneId)).find(e=>e.id===state.id);
const rarityOf=data=>{
  try {
    const list=normalizeItemSystemConfig(getSheetConfig().items).rarities;
    return list.find(r=>r.id===data?.flags?.[MODULE_ID]?.item?.rarityId)||list.find(r=>r.id==='common')||list[0];
  }catch{return {color:'#8aacc8'};}
};
const rootContent=(state,id)=>groundDirectItems(worldRecord(state)).find(e=>e.sourceId===id);
/** Visible artwork bounds are separate from the original stored grid indices.
 * A 5x5 backpack mask with a centered 3x3 active region produces a 3x3
 * window, without remapping any saved contents or drop indices. */
/** Keyboard navigation stays within the true active storage shape. */
export function groundKeyboardNextCell(bag,index,key) {
  if(!bag || !(bag.columns>0) || !(bag.rows>0))return null;
  const step={ArrowRight:1,ArrowLeft:-1,ArrowUp:-bag.columns,ArrowDown:bag.columns}[key];
  if(step===undefined)return null;
  const x=index%bag.columns,y=Math.floor(index/bag.columns);
  const options={ArrowRight:[x+1,y],ArrowLeft:[x-1,y],ArrowUp:[x,y-1],ArrowDown:[x,y+1]};
  let [nx,ny]=options[key];
  while(nx>=0&&nx<bag.columns&&ny>=0&&ny<bag.rows) {
    const next=ny*bag.columns+nx;
    if(bag.mode!=='complex'||bag.cells.includes(next))return next;
    nx+=key==='ArrowRight'?1:key==='ArrowLeft'?-1:0;
    ny+=key==='ArrowDown'?1:key==='ArrowUp'?-1:0;
  }
  return null;
}
function keyboardContentAt(record,bag,index) {
  return groundDirectItems(record).find(entry=>{
    if(`root:${entry.compartmentId}`!==bag.storageId)return false;
    const x=entry.index%bag.columns,y=Math.floor(entry.index/bag.columns);
    const cells=bag.itemMode==='simple'?[{x:0,y:0}]
      :rotatedCells(entry.data?.flags?.[MODULE_ID]?.item?.shape,entry.rotation||0);
    return cells.some(cell=>index===(y+cell.y)*bag.columns+x+cell.x);
  }) || null;
}
function bindGroundKeyboard(state,body) {
  const notify=message=>{const status=body.querySelector('[data-ground-status]');if(status)status.textContent=message;};
  body.addEventListener('keydown',event=>{
    if(!windowState || windowState!==state || state.dragging || state.pendingAction)return;
    const record=worldRecord(state);
    if(!record)return;
    if(event.key==='Escape' && state.keyboardHeld) {
      state.keyboardHeld=null;notify('Move canceled.');event.preventDefault();return;
    }
    const item=event.target?.closest?.('[data-ground-content-id]');
    if(item && ['Enter',' '].includes(event.key)) {
      const id=item.dataset.groundContentId;
      const entry=groundDirectItems(record).find(child=>child.sourceId===id);
      if(!entry)return;
      state.keyboardHeld=id;
      notify(`${entry.data?.name||'Item'} selected. Use arrow keys and Enter to place, Escape to cancel.`);
      const cell=body.querySelector(`.buxa-storage-cell[data-ground-storage-id="root:${entry.compartmentId}"][data-ground-index="${entry.index}"]`);
      cell?.focus?.();event.preventDefault();return;
    }
    const cell=event.target?.closest?.('.buxa-storage-cell[data-ground-index]');
    if(!cell)return;
    const storageId=cell.dataset.groundStorageId;
    const bag=groundCompartments(record).find(spec=>spec.storageId===storageId);
    if(!bag)return;
    const index=Number(cell.dataset.groundIndex);
    if(event.key.startsWith('Arrow')) {
      const next=groundKeyboardNextCell(bag,index,event.key);
      if(next!=null)body.querySelector(`.buxa-storage-cell[data-ground-storage-id="${storageId}"][data-ground-index="${next}"]`)?.focus?.();
      event.preventDefault();return;
    }
    if(!['Enter',' '].includes(event.key))return;
    if(!state.keyboardHeld) {
      const entry=keyboardContentAt(record,bag,index);
      if(entry){state.keyboardHeld=entry.sourceId;notify(`${entry.data?.name||'Item'} selected. Choose a cell and press Enter.`);}
      event.preventDefault();return;
    }
    const id=state.keyboardHeld;state.keyboardHeld=null;
    try {groundMoveWithin(record,id,storageId,index,groundDirectItems(record).find(entry=>entry.sourceId===id)?.rotation||0);}
    catch(error){notify(error.message);notifyWarning(error.message);event.preventDefault();return;}
    notify('Moving item.');
    void submit(state,{contentId:id,direction:'reposition',storageId,index,
      rotation:groundDirectItems(record).find(entry=>entry.sourceId===id)?.rotation||0});
    event.preventDefault();
  });
}

/** Move only the floating window chrome; grid pointer handlers stay intact. */
export function clampGroundWindowPosition(left,top,width,height,viewportWidth,viewportHeight,margin=6) {
  return {
    left: Math.round(Math.max(margin, Math.min(Math.max(margin,viewportWidth-width-margin),left))),
    top: Math.round(Math.max(margin, Math.min(Math.max(margin,viewportHeight-height-margin),top)))
  };
}
export function installGroundWindowHeaderDrag(state,header){
  if (!header) return;
  header.addEventListener('pointerdown',event=>{
    if (event.button!==0 || event.target?.closest?.('[data-ground-close],button,input,select')) return;
    state.cancelWindowDrag?.();
    const rect=state.element.getBoundingClientRect();
    const origin={x:event.clientX,y:event.clientY};
    const pointer=event.pointerId;
    const move=e=>{
      if (pointer!=null && e.pointerId!=null && e.pointerId!==pointer)return;
      const next=clampGroundWindowPosition(rect.left+e.clientX-origin.x,rect.top+e.clientY-origin.y,
        rect.width,rect.height,window.innerWidth,window.innerHeight);
      state.element.style.right='auto';
      state.element.style.left=`${next.left}px`;
      state.element.style.top=`${next.top}px`;
      e.preventDefault?.();
    };
    const finish=e=>{
      if(e && pointer!=null && e.pointerId!=null && e.pointerId!==pointer)return;
      window.removeEventListener('pointermove',move,true);
      window.removeEventListener('pointerup',finish,true);
      window.removeEventListener('pointercancel',finish,true);
      window.removeEventListener('blur',finish,true);
      if(state.cancelWindowDrag===cancel)state.cancelWindowDrag=null;
    };
    const cancel=()=>finish();
    state.cancelWindowDrag=cancel;
    window.addEventListener('pointermove',move,true);
    window.addEventListener('pointerup',finish,true);
    window.addEventListener('pointercancel',finish,true);
    window.addEventListener('blur',finish,true);
    event.preventDefault?.();event.stopPropagation?.();
  });
}
function originAtGrip(target,grip) {
  if(!target)return null;
  const col=target.column-(grip?.x||0),row=target.row-(grip?.y||0);
  if(col<0 || row<0 || col>=target.bag.columns || row>=target.bag.rows)return null;
  return row*target.bag.columns+col;
}
function paintGroundGhost(ghost, entry, rotation, itemMode='complex'){
  const shape=normalizeItemShape(entry.data?.flags?.[MODULE_ID]?.item?.shape);
  const cells=itemMode==='simple'?[{x:0,y:0}]:rotatedCells(shape,rotation),bounds=shapeBounds(cells),rarity=rarityOf(entry.data);
  const color=/^#[0-9a-f]{6}$/i.test(rarity?.color||'')?rarity.color:'#8aacc8';
  ghost.style.width=`${bounds.width*GROUND_STORAGE_CELL_PX}px`;ghost.style.height=`${bounds.height*GROUND_STORAGE_CELL_PX}px`;
  ghost.style.setProperty('--buxa-rarity-color',color);ghost.style.setProperty('--buxa-rarity-accent',color);
  ghost.classList.toggle('is-rectangular-shape',cells.length===bounds.width*bounds.height);
  ghost.replaceChildren();
  const backdrop=document.createElement('div');backdrop.className='buxa-complex-backdrop';backdrop.style.cssText=storageArtworkStyle(shape,rotation,itemMode);ghost.append(backdrop);
  const art=document.createElement('div');art.className='buxa-complex-art';art.style.cssText=storageArtworkStyle(shape,rotation,itemMode);
  const image=document.createElement('img');image.src=entry.data?.img||'icons/svg/item-bag.svg';image.alt='';image.draggable=false;art.append(image);ghost.append(art);
  for(const cell of cells){const tile=document.createElement('span');tile.className='buxa-complex-ghost-cell';
    Object.assign(tile.style,{left:`${cell.x*GROUND_STORAGE_CELL_PX}px`,top:`${cell.y*GROUND_STORAGE_CELL_PX}px`,width:`${GROUND_STORAGE_CELL_PX}px`,height:`${GROUND_STORAGE_CELL_PX}px`});ghost.append(tile);}
  ghost.append(createComplexDecorationSvg(document,cells));
  return bounds;
}
export function closeGroundContainer(){windowState?.cancelWindowDrag?.();windowState?.cancelDrag?.();windowState?.element?.remove();windowState=null;clearGroundTransferGhost();endPhysicalInventoryDrag();}
function render() {
  const state=windowState;
  if(!state || state.dragging)return;
  const record=worldRecord(state);
  if(!record){closeGroundContainer();return;}
  state._planCache=null;
  const specs=groundCompartments(record),contents=groundDirectItems(record);
  if(!specs.length){closeGroundContainer();return;}
  const root=state.element;
  const body=root.querySelector('[data-ground-body]');
  // Keep the working 0.13.22 storage semantics and drop-target structure:
  // external-storage-area > storage-compartment > board-scroll > storage-grid.
  // Only its chrome is compacted, never the placement/drag DOM hierarchy.
  const multiple=specs.length>1;
  // Crop the VIEWPORT to visible cells. Keep the original full grid and its
  // saved indices under that viewport so item positions and hit tests agree.
  const {views,columns:maxColumns,width:windowWidth}=groundWindowLayout(specs);
  root.style.setProperty('--buxa-ground-window-columns',String(maxColumns));
  root.style.setProperty('--buxa-storage-cell-px',`${GROUND_STORAGE_CELL_PX}px`);
  // Do not rely solely on stylesheet cascade in the Foundry desktop app.
  // Explicit content width also prevents older theme rules from restoring a
  // broad fixed-size window around a cropped 3x3 shape.
  root.style.setProperty('width',`${windowWidth}px`,'important');
  const unplaced=classifyGroundContents(specs,contents).unplaced;
  const layoutSignature=groundLayoutFingerprint(record,views)+':unplaced:'+unplaced.map(entry=>entry.sourceId).join(',');
  const unchangedLayout=!unplaced.length && state.renderLayout===layoutSignature && Boolean(body.querySelector('[data-ground-visible-viewport]'));
  if (unchangedLayout) {
    const diff=diffGroundEntries(state.renderItems??new Map(),contents);
    if(!diff.removed.length && !diff.changed.length)return;
    for(const id of diff.removed) {
      for(const element of body.querySelectorAll('[data-ground-content-id]'))
        if(element.dataset.groundContentId===id)element.remove();
    }
    for(const entry of diff.changed) {
      for(const element of body.querySelectorAll('[data-ground-content-id]'))
        if(element.dataset.groundContentId===entry.sourceId)element.remove();
      const grid=[...body.querySelectorAll('.buxa-storage-grid[data-ground-storage-id]')]
        .find(element=>element.dataset.groundStorageId===`root:${entry.compartmentId}`);
      const bag=specs.find(spec=>spec.storageId===`root:${entry.compartmentId}`);
      if(!grid || !bag) continue;
      const wrapper=document.createElement('div');wrapper.innerHTML=groundMarkupItem(entry,bag);
      const element=wrapper.firstElementChild;
      if(element){grid.appendChild(element);bindGroundItem(state,element,entry);}
    }
    state.renderItems=diff.next;
    return;
  }
  state.cancelWindowDrag?.();
  body.innerHTML=`<header class="buxa-ground-head" data-ground-drag-handle title="Drag to move window"><div><img src="${html(record.data?.img||'icons/svg/item-bag.svg')}" alt=""><strong>${html(record.data?.name||'Storage')}</strong></div><button type="button" data-ground-close aria-label="Close storage">×</button></header><span data-ground-status class="buxa-ground-screenreader-status" role="status" aria-live="polite"></span><div class="buxa-ground-scroll buxa-external-storage-area">${groundCompartmentMarkup(views,contents,multiple)}</div>`;
  state.renderLayout=layoutSignature;
  state.renderItems=diffGroundEntries(new Map(),contents).next;
  installGroundWindowHeaderDrag(state,body.querySelector('[data-ground-drag-handle]'));
  body.querySelector('[data-ground-close]')?.addEventListener('click',closeGroundContainer);
  for(const el of body.querySelectorAll('[data-ground-content-id]')){
    const entry=contents.find(c=>c.sourceId===el.dataset.groundContentId);
    if(entry)bindGroundItem(state,el,entry);
  }
}
export function bindGroundItem(state,el,entry) {
  const bag=(globalThis.game ? groundCompartments(worldRecord(state)) : []).find(c=>c.storageId===`root:${entry.compartmentId}`);
  const cells=bag?.itemMode==='simple'?[{x:0,y:0}]
    :rotatedCells(entry.data?.flags?.[MODULE_ID]?.item?.shape,entry.rotation||0);
  const artwork=el.querySelector('.buxa-complex-art');
  if(artwork)el.insertBefore(createComplexDecorationSvg(document,cells),artwork);
  el.addEventListener('pointerdown',e=>startDrag(state,entry,el,e));
}
/** Translate a visible pointer hit into the ORIGINAL uncropped slot index.
 * A 3x3 visible cutout in a 5x5 board starts at saved index 6, not zero. */
/** Hit-test the visible cropped viewport, then translate to the original grid.
 * Do not use a nested item's DOM bounding rectangle as the destination. */
function gridTarget(x,y,doc=globalThis.document) {
  const root=windowState?.element;
  const hit=doc?.elementFromPoint?.(x,y);
  if(!root || !hit || !root.contains(hit))return null;
  const specs=groundCompartments(worldRecord(windowState));
  for(const viewport of root.querySelectorAll('[data-ground-visible-viewport]')) {
    const rect=viewport.getBoundingClientRect();
    if(!(rect.width>0 && rect.height>0))continue;
    const board=viewport.querySelector('.buxa-storage-grid[data-ground-storage-id]');
    const bag=specs.find(c=>c.storageId===board?.dataset?.groundStorageId);
    if(!board||!bag)continue;
    const cell=groundVisibleCellAtPoint(x,y,{viewportRect:rect,boardRect:board.getBoundingClientRect(),bag});
    if(!cell)continue;
    return {storageId:bag.storageId,index:cell.index,bag,board,column:cell.column,row:cell.row};
  }
  return null;
}
const itemSnapshot=item=>item?.toObject?.() || item?.data || item;
/** The same snapped placement drives overlay, payload and final GM validation. */
export function groundTransferAtPoint(item,x,y,{
  rotation=0,gripX=.5,gripY=.5,movingContentId=null,doc=globalThis.document,fresh=false
}={}) {
  if(!windowState?.element)return null;
  const hit=doc?.elementFromPoint?.(x,y);
  if(!hit || !windowState.element.contains(hit))return null;
  const record=worldRecord(windowState);
  if(!record)return null;
  const cell=gridTarget(x,y,doc);
  // Pointer drops require a real unmasked slot. Do not turn a drop on the
  // title, scroll bar or a masked hole into an arbitrary auto-placement.
  if(!cell)return {kind:'ground-container',containerId:windowState.id,sceneId:windowState.sceneId,valid:false};
  const key=JSON.stringify([windowState.id,item?.id??item?.sourceId??'',
    itemSnapshot(item)?.flags?.[MODULE_ID]?.item?.shape,
    cell?.storageId,cell?.index,rotation,gripX,gripY,movingContentId]);
  // Hover previews may be cached, but a pointer-up is a new transaction.
  // Never commit a cached negative result after other content has moved.
  if(!fresh && windowState._planCache?.key===key)return windowState._planCache.value;
  const planned=planGroundContainerPlacement(record,itemSnapshot(item),{
    storageId:cell?.storageId??null,hoverIndex:cell?.index??null,
    rotation,gripX,gripY,movingContentId});
  const value=planned?{kind:'ground-container',containerId:windowState.id,sceneId:windowState.sceneId,
    storageId:planned.storageId,index:planned.index,rotation:planned.rotation,valid:true,plan:planned}
    :{kind:'ground-container',containerId:windowState.id,sceneId:windowState.sceneId,valid:false};
  windowState._planCache={key,value};
  return value;
}
export function showGroundTransferAtPoint(item,x,y,options={}) {
  const target=groundTransferAtPoint(item,x,y,options);
  if(!target){clearGroundTransferGhost();return null;}
  const board=windowState?.element?.querySelector(
    `.buxa-storage-grid[data-ground-storage-id="${target.storageId||''}"]`);
  if(target.valid&&board)showGroundTransferGhost(itemSnapshot(item),target.plan,board);
  else {
    const rejected=groundRejectedFootprint(gridTarget(x,y,options.doc),itemSnapshot(item),options);
    const invalidBoard=windowState?.element?.querySelector(
      `.buxa-storage-grid[data-ground-storage-id="${rejected?.bag?.storageId||''}"]`);
    if(rejected && invalidBoard)showGroundTransferGhost(itemSnapshot(item),rejected,invalidBoard,{valid:false});
    else clearGroundTransferGhost();
  }
  return target;
}
export {clearGroundTransferGhost};
const notifyFailure=error=>notifyWarning(error?.message||'Item does not fit.');
/** One storage request at a time per open window. Older asynchronous results
 * must never rerender a newly opened container. */
async function withGroundWindowAction(state, task) {
  if (!state || windowState !== state) return false;
  if (state.pendingAction) { notifyWarning('A storage transfer is already in progress.'); return false; }
  state.pendingAction = true;
  try {
    if (windowState !== state) return false;
    await task();
    return true;
  } finally {
    state.pendingAction = false;
    if (windowState === state) render();
  }
}
async function submit(state,payload){
  try {
    await withGroundWindowAction(state, () => requestPhysicalAction({action:'container',sceneId:state.sceneId,containerId:state.id,...payload}));
  } catch(error) { notifyFailure(error); }
}
function startDrag(state,entry,el,e){
  if(e.button!==0||state.dragging||!entry)return;
  const start={x:e.clientX,y:e.clientY};
  const pointer=e.pointerId;
  const shape=normalizeItemShape(entry.data?.flags?.[MODULE_ID]?.item?.shape);
  let rotation=Number(entry.rotation)||0,active=false,ghost=null,hover=null,external=false,moveChecker=null;
  const sourceBag=(globalThis.game ? groundCompartments(worldRecord(state)) : []).find(c=>c.storageId===`root:${entry.compartmentId}`);
  let ghostMode=sourceBag?.itemMode==='simple'?'simple':'complex';
  const startGrip=e.target.closest?.('[data-buxa-piece-x]');
  const gripX=Number(startGrip?.dataset?.buxaPieceX ?? 0),gripY=Number(startGrip?.dataset?.buxaPieceY ?? 0);
  const getGrip=(bag=sourceBag)=>{if(bag?.itemMode==='simple')return {x:0,y:0};
    const cells=rotatedCells(shape,rotation),b=shapeBounds(cells);return {x:Math.min(b.width-1,gripX),y:Math.min(b.height-1,gripY)};};
  const previewData={id:entry.sourceId,name:entry.data?.name,img:entry.data?.img,flags:entry.data?.flags};
  const cleanup=()=>{
    window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',end,true);
    window.removeEventListener('pointercancel',cancel,true);window.removeEventListener('keydown',rotate,true);
    ghost?.remove();moveChecker=null;hover?.classList.remove('is-storage-drop-target','is-storage-invalid');
    el.classList.remove('is-dragging');
    state.dragging=false;state.cancelDrag=null;clearGroundTransferGhost();endPhysicalInventoryDrag();
  };
  const cancel=()=>{cleanup();render();};
  const rotate=event=>{if(active&&event.key?.toLowerCase()==='r'){rotation=(rotation+1)%4;rotatePhysicalInventoryPreview();if(ghost)paintGroundGhost(ghost,entry,rotation,ghostMode);event.preventDefault();update({clientX:state.lastX??start.x,clientY:state.lastY??start.y});}};
  function update(event){
    if(!active)return;
    state.lastX=event.clientX;state.lastY=event.clientY;
    const target=gridTarget(event.clientX??start.x,event.clientY??start.y);
    hover?.classList.remove('is-storage-drop-target','is-storage-invalid');hover=null;
    const sheet=physicalDropTargetFromClient(event.clientX,event.clientY);
    if(sheet?.kind==='actor') {
      external=true;
      showPhysicalInventoryPreview(previewData,sheet,event.clientX,event.clientY);
      if(ghost)ghost.style.display='none';
    }else {
      if(external){endPhysicalInventoryDrag();external=false;}
      if(ghost){ghost.style.display='';const grip=getGrip(target?.bag);ghost.style.transform=`translate3d(${event.clientX-(grip.x+.5)*GROUND_STORAGE_CELL_PX}px,${event.clientY-(grip.y+.5)*GROUND_STORAGE_CELL_PX}px,0)`;}
    }
    const nextGhostMode=target?.bag?.itemMode==='simple'?'simple':'complex';
    if(ghost && !external && nextGhostMode!==ghostMode){ghostMode=nextGhostMode;paintGroundGhost(ghost,entry,rotation,ghostMode);}
    if(target){
      const origin=originAtGrip(target,getGrip(target.bag));
      const cell=target.board.querySelector(`[data-ground-index="${origin ?? target.index}"]`);
      const valid=origin!=null && Boolean(moveChecker?.fits(target.storageId,origin,rotation));
      cell?.classList.add(valid?'is-storage-drop-target':'is-storage-invalid');hover=cell;
      ghost?.classList.toggle('is-invalid',!valid);
      if(ghost && origin!=null) {
        const rect=target.board.getBoundingClientRect();
        ghost.style.transform=`translate3d(${rect.left+(origin%target.bag.columns)*GROUND_STORAGE_CELL_PX}px,${rect.top+Math.floor(origin/target.bag.columns)*GROUND_STORAGE_CELL_PX}px,0)`;
      }
    }
  }
  const move=event=>{
    if(pointer!=null&&event.pointerId!=null&&event.pointerId!==pointer)return;
    if(!active && Math.hypot(event.clientX-start.x,event.clientY-start.y)<5)return;
    if(!active){
      active=true;state.dragging=true;
      try{
        const record=state.id && state.sceneId ? worldRecord(state) : null;
        if(record)moveChecker=groundPlacementChecker(record,null,entry.sourceId);
        else if(state.id && state.sceneId)throw Error('This container is no longer available.');
      }catch(error){notifyFailure(error);cleanup();return;}
      ghost=document.createElement('div');ghost.className='buxa-ground-drag-ghost buxa-inventory-drag-ghost is-complex-ghost';
      paintGroundGhost(ghost,entry,rotation,ghostMode);
      document.body.append(ghost);
      const bounds=shapeBounds(rotatedCells(shape,rotation));
      beginPhysicalInventoryDrag(previewData,{gripX:(gripX+.5)/bounds.width,gripY:(gripY+.5)/bounds.height});
      // Pointerdown has already dispatched when this window-level move runs.
      // Its event.currentTarget is now null; use the captured content element.
      el.classList.add('is-dragging');
    }
    update(event);event.preventDefault?.();
  };
  const end=event=>{
    if(pointer!=null&&event.pointerId!=null&&event.pointerId!==pointer)return;
    const moved=active;
    const target=gridTarget(event.clientX,event.clientY);
    const sourcePosition=target?originAtGrip(target,getGrip(target.bag)):null;
    const sheet=physicalDropTargetFromClient(event.clientX,event.clientY);
    const canvasTarget=canvasItemDropTarget(event.clientX,event.clientY,{excludeId:state.id});
    const boardNode=document.getElementById('board');
    const boardHit=document.elementFromPoint?.(event.clientX,event.clientY);
    const board=canvasTarget || (boardNode && (boardHit===boardNode||boardNode.contains(boardHit))?{kind:'scene'}:null);
    const point=boardScenePoint(event.clientX,event.clientY);
    const position=sheet?.kind==='actor'?externalInventoryDropPosition(previewData,sheet,event.clientX,event.clientY):null;
    cleanup();
    if(!moved){render();return;}
    event.preventDefault?.();event.stopPropagation?.();
    const payload={contentId:entry.sourceId};
    if(target){if(sourcePosition===null){notifyWarning('Item does not fit at that position.');render();return;}void submit(state,{...payload,direction:'reposition',storageId:target.storageId,index:sourcePosition,rotation});return;}
    if(sheet?.kind==='actor') {void submit(state,{...payload,direction:'take',targetActorId:sheet.actorId,targetTokenId:sheet.targetTokenId,position});return;}
    if(sheet?.kind==='world') {void submit(state,{...payload,direction:'export',destination:'world',folderId:sheet.folderId});return;}
    if(board?.kind==='actor') {void submit(state,{...payload,direction:'export',destination:'actor',targetActorId:board.actorId,targetTokenId:board.targetTokenId});return;}
    if(board?.kind==='ground-container') {void submit(state,{...payload,direction:'shift',destinationContainerId:board.containerId,rotation});return;}
    if(board?.kind==='scene'&&point){void submit(state,{...payload,direction:'export',destination:'scene',point});return;}
    notifyWarning('Drop onto an inventory, character, or scene.');render();
  };
  state.cancelDrag=cancel;
  window.addEventListener('pointermove',move,true);window.addEventListener('pointerup',end,true);
  window.addEventListener('pointercancel',cancel,true);window.addEventListener('keydown',rotate,true);
  e.preventDefault();e.stopPropagation();
}
export function openGroundContainer(record){
  const scene=canvas?.scene;
  if(!scene||!groundCompartments(record).length)return false;
  const policy=normalizePhysicalSettings(game.settings.get(MODULE_ID,PHYSICAL_SETTINGS));
  const allow=canInteractPhysical({user:game.user,scene,item:record,actors:actors(),tokens:scene.tokens?.contents??[],settings:policy,operation:'open'});
  if(!allow.allowed && !game.user?.isGM){notifyWarning(allow.reason);return false;}
  closeGroundContainer();
  const element=document.createElement('aside');element.className='buxa buxa-ground-container-window';
  element.innerHTML='<div data-ground-body></div>';
  document.body.append(element);
  windowState={sceneId:scene.id,id:record.id,element,actorId:allow.candidate?.actorId||null,dragging:false,pendingAction:false};
  bindGroundKeyboard(windowState,element.querySelector('[data-ground-body]'));
  render();return true;
}
export function installGroundContainerWindow(){
  document.addEventListener('dragover',event=>{
    if(!windowState?.element?.contains?.(event.target)){
      clearGroundTransferGhost();return;
    }
    const types=[...(event.dataTransfer?.types||[])];
    if(!types.includes('text/plain')&&!types.includes('text'))return;
    event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='copy';
    const world=nativeWorldDragItem();
    if(world)showGroundTransferAtPoint(world,event.clientX,event.clientY,{
      ...activePhysicalInventoryGrip(),rotation:activePhysicalInventoryRotation()});
  },true);
  document.addEventListener('drop',event=>{
    if(!windowState?.element?.contains?.(event.target))return;
    let payload;try{payload=JSON.parse(event.dataTransfer?.getData('text/plain')||'null');}catch{return;}
    if(payload?.type!=='Item' || !payload.uuid)return;
    event.preventDefault();event.stopImmediatePropagation();
    const state=windowState;
    const sceneId=state.sceneId,containerId=state.id;
    // Capture these synchronously: native dragend may fire before fromUuid
    // resolves, and must not reset the final rotation/grab anchor.
    const coords={x:event.clientX,y:event.clientY};
    const dragOptions={...activePhysicalInventoryGrip(),rotation:activePhysicalInventoryRotation()};
    void (async()=>{
      if (windowState !== state) return;
      const item=await fromUuid(payload.uuid);
      if (windowState !== state) return;
      if(!item)throw Error('Item no longer exists.');
      const location=groundTransferAtPoint(item,coords.x,coords.y,{...dragOptions,fresh:true});
      clearGroundTransferGhost();
      if(!location?.valid)throw Error(groundNoFitMessage(item));
      const actor=item.parent?.documentName==='Actor'?item.parent:null;
      const common={action:'container',sceneId,containerId,itemId:item.id,quantity:physicalQuantity(item),storageId:location.storageId,index:location.index,rotation:location.rotation};
      await withGroundWindowAction(state, () => requestPhysicalAction(actor?{
        ...common,direction:'store',targetActorId:actor.id,
        ...(actor.isToken?{targetTokenId:actor.token?.id||actor.parent?.id}:{})
      }:{...common,direction:'import',source:'world'}));
    })().catch(notifyFailure);
  },true);
  Hooks.on('buxaPhysicalSceneItemsChanged',()=>{if(windowState)render();});
  Hooks.on('canvasTearDown',closeGroundContainer);
}
/** Buxa Inventory uses pointer DnD rather than browser DnD. */
export function dropInventoryIntoGroundContainer(actor,item,x,y,doc=globalThis.document,options={}){
  if(!actor||!item)return false;
  const target=groundTransferAtPoint(item,x,y,{...options,doc,fresh:true});
  if(!target)return false;
  clearGroundTransferGhost();
  if(!target.valid){notifyWarning(groundNoFitMessage(item));return true;}
  const state=windowState;
  void withGroundWindowAction(state, () => requestPhysicalAction({action:'container',direction:'store',sceneId:state.sceneId,containerId:state.id,
    targetActorId:actor.id,...(actor.isToken?{targetTokenId:actor.token?.id||actor.parent?.id}:{}),
    itemId:item.id,quantity:physicalQuantity(item),storageId:target.storageId,index:target.index,rotation:target.rotation}))
    .catch(notifyFailure);
  return true;
}
/** A shared target for Scene sprites, world templates, and chest content. */
export function groundContainerTargetFromClient(x,y,doc=globalThis.document,options=null){
  if(options?.item)return groundTransferAtPoint(options.item,x,y,{...options,doc});
  const hit=doc?.elementFromPoint?.(x,y);
  if(!windowState?.element || !hit || !windowState.element.contains(hit))return null;
  const target=gridTarget(x,y,doc);
  return {kind:'ground-container',containerId:windowState.id,sceneId:windowState.sceneId,
    ...(target?{storageId:target.storageId,index:target.index}:{})};
}
