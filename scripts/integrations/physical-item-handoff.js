/** Browser/Pixi drop adapters. Transactional inventory mutations are performed
 * by the authoritative GM in physical-item-transfers.js, never by the UI. */
import { MODULE_ID } from '../core/constants.js';
import { setNativeWorldDragItem } from './native-world-drag-session.js';
import { requestPhysicalAction } from './physical-item-transfers.js';
import { promptPhysicalQuantity } from '../apps/physical-item-ui.js';
import { notifyError, notifySuccess } from '../core/notifications.js';
import { physicalDropTargetFromClient, resolvePhysicalDropTarget, actorDropPayload } from './physical-item-drop-targets.js';
import { canvasItemDropTarget } from './canvas-item-drop-target.js';
import { groundContainerTargetFromClient, showGroundTransferAtPoint, clearGroundTransferGhost, groundNoFitMessage } from '../apps/ground-container-window.js';
import { clearPhysicalInventoryPreview, showPhysicalInventoryPreview, beginPhysicalInventoryDrag, endPhysicalInventoryDrag, rotatePhysicalInventoryPreview, externalInventoryDropPosition, activePhysicalInventoryGrip, activePhysicalInventoryRotation, hasActivePhysicalInventoryDrag } from './physical-inventory-preview.js';

function warn(error) {
  console.error(`${MODULE_ID} | Cross-surface Item transfer failed`,error);
  notifyError(error?.message || 'Item transfer failed. The original item has not been removed.');
}
export async function transferInventoryItemToDirectory(actor,item,clientX,clientY) {
  const target=physicalDropTargetFromClient(clientX,clientY);
  if(target?.kind!=='world')return false;
  const quantity=await promptPhysicalQuantity(item);
  if(quantity==null)return true;
  try {
    await requestPhysicalAction({action:'transfer',source:'actor',destination:'world',
      ...actorDropPayload(actor),sceneId:globalThis.canvas?.scene?.id,itemId:item.id,
      quantity,folderId:target.folderId});
    notifySuccess(`${item.name} moved to the Item Directory.`);
  } catch(error) {warn(error);}
  return true;
}
export async function transferBoardItemAtPointer(item,clientX,clientY) {
  const target=groundContainerTargetFromClient(clientX,clientY,globalThis.document,{item:item.data,...activePhysicalInventoryGrip(),rotation:activePhysicalInventoryRotation(),fresh:true}) || physicalDropTargetFromClient(clientX,clientY) || canvasItemDropTarget(clientX,clientY,{excludeId:item.id});
  if(!target)return false;
  const quantity=await promptPhysicalQuantity({name:item.data?.name,system:{quantity:item.quantity}});
  if(quantity==null)return true;
  try {
    if(target.kind==='ground-container') {
      // Open storage supplies an explicit validated cell. A drop on the crate
      // sprite itself has no cell or `valid` flag: the GM must search all
      // available cells/rotations instead of treating it as an invalid grid hit.
      if(target.valid===false){throw Error(groundNoFitMessage(item.data));}
      const cell=target.valid===true ? {storageId:target.storageId,index:target.index,rotation:target.rotation} : {};
      await requestPhysicalAction({action:'container',direction:'import',source:'scene',sceneId:globalThis.canvas?.scene?.id,
        containerId:target.containerId,itemId:item.id,quantity,...cell});
      notifySuccess(`${item.data?.name||'Item'} stored.`);
      return true;
    }
    const position=target.kind==='actor' ? externalInventoryDropPosition({id:item.id,...item.data},target,clientX,clientY) : null;
    await requestPhysicalAction({action:'transfer',source:'scene',destination:target.kind,
      sceneId:globalThis.canvas?.scene?.id,itemId:item.id,quantity,
      ...(target.kind==='actor'?{actorId:target.actorId,targetTokenId:target.targetTokenId,
        position}:{folderId:target.folderId})});
    notifySuccess(`${item.data?.name||'Item'} transferred.`);
  } catch(error) {warn(error);}
  return true;
}
export function installPhysicalItemHandoffs() {
  let nativeWorldId=null;
  document.addEventListener('dragstart',event=>{
    const node=event.target?.closest?.('[data-buxa-dir-item], [data-buxa-item], [data-document-id], [data-entry-id]');
    const id=node?.dataset?.buxaDirItem || node?.dataset?.buxaItem || node?.dataset?.documentId || node?.dataset?.entryId;
    nativeWorldId=game.items?.get?.(id)?.id??null;
    setNativeWorldDragItem(nativeWorldId ? game.items.get(nativeWorldId) : null);
    if(nativeWorldId)beginPhysicalInventoryDrag(game.items.get(nativeWorldId));
  },true);
  const endDragSession=()=>{
    nativeWorldId=null;setNativeWorldDragItem(null);clearGroundTransferGhost();endPhysicalInventoryDrag();
  };
  document.addEventListener('dragend',endDragSession,true);
  // HTML dragend is sometimes lost when the drag leaves Chromium or the tab
  // becomes hidden. Do not retain a stale rotation, ghost, or source document.
  document.defaultView?.addEventListener('blur',endDragSession);
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden')endDragSession();
  });
  document.addEventListener('keydown',event=>{
    if(event.key?.toLowerCase()!=='r' || event.repeat || !rotatePhysicalInventoryPreview())return;
    event.preventDefault();event.stopPropagation();
  },true);
  // Chromium can suppress keyboard events during a native HTML5 drag.
  // Shift+wheel over the destination grid is an alternate rotation input.
  document.addEventListener('wheel',event=>{
    if(!event.shiftKey || !hasActivePhysicalInventoryDrag())return;
    const target=resolvePhysicalDropTarget(event.target,event.clientX,event.clientY);
    const onStorage=groundContainerTargetFromClient(event.clientX,event.clientY);
    if(!hasActivePhysicalInventoryDrag() || (!onStorage && target?.kind!=='actor') || !rotatePhysicalInventoryPreview())return;
    if(onStorage) {
      // A board-item drag will recalculate the ground-container ghost on the
      // next pointermove; native world drags can update it immediately here.
      const world=nativeWorldId ? game.items?.get?.(nativeWorldId) : null;
      if(world)showGroundTransferAtPoint(world,event.clientX,event.clientY,{...activePhysicalInventoryGrip(),rotation:activePhysicalInventoryRotation()});
    }
    event.preventDefault();event.stopPropagation();
  },{capture:true,passive:false});
  // Capture before Foundry ActorSheetV2 and its default drop implementation;
  // otherwise it may create a duplicate Item or treat a Scene as embedded in
  // an Actor. Only handle world Item template -> Buxa inventory here.
  document.addEventListener('dragover',event=>{
    const target=resolvePhysicalDropTarget(event.target,event.clientX,event.clientY);
    if(target?.kind!=='actor'){clearPhysicalInventoryPreview();return;}
    const types=[...(event.dataTransfer?.types||[])];
    if(!types.includes('text/plain')&&!types.includes('text'))return;
    event.preventDefault();
    if(event.dataTransfer)event.dataTransfer.dropEffect='copy';
    const item=nativeWorldId ? game.items?.get?.(nativeWorldId) : null;
    if(item)showPhysicalInventoryPreview(item,target,event.clientX,event.clientY);
  },true);
  document.addEventListener('drop',event=>{
    // The ground-storage listener owns this native drop. Do not reset the
    // grabbed cell/rotation before its handler resolves the final slot.
    if(groundContainerTargetFromClient(event.clientX,event.clientY))return;
    nativeWorldId=null;setNativeWorldDragItem(null);clearGroundTransferGhost();
    const target=resolvePhysicalDropTarget(event.target,event.clientX,event.clientY);
    if(target?.kind!=='actor'){endPhysicalInventoryDrag();return;}
    let payload;
    try {payload=JSON.parse(event.dataTransfer?.getData('text/plain')||event.dataTransfer?.getData('text')||'null');}
    catch {endPhysicalInventoryDrag();return;}
    if(payload?.type!=='Item' || !/^Item\.[^.]+$/.test(payload?.uuid||'')){endPhysicalInventoryDrag();return;}
    const itemId=payload.uuid.split('.').at(-1);
    const item=game.items?.get?.(itemId);
    if(!item){endPhysicalInventoryDrag();return;}
    const position=externalInventoryDropPosition(item,target,event.clientX,event.clientY);
    endPhysicalInventoryDrag();
    event.preventDefault();event.stopImmediatePropagation();
    void (async()=>{
      const quantity=await promptPhysicalQuantity(item);
      if(quantity==null)return;
      try {
        await requestPhysicalAction({action:'transfer',source:'world',destination:'actor',itemId,
          actorId:target.actorId,targetTokenId:target.targetTokenId,
          sceneId:globalThis.canvas?.scene?.id,position,quantity});
        notifySuccess(`${item.name} added to inventory.`);
      } catch(error) {warn(error);}
    })();
  },true);
}
