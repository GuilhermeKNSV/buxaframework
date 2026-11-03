import { itemBoardImageOf } from '../core/item-board-image.js';
import { stackArtworkFor } from "../core/item-stack-artwork.js";
import { compositeStackArtwork } from "../core/stack-artwork-canvas.js";
/** Non-tile physical Item display; sprites move with Foundry camera natively. */
import { MODULE_ID } from '../core/constants.js';
import { getSheetConfig } from '../core/config.js';
import { normalizeItemSystemConfig } from '../core/item-config.js';
import { scenePhysicalItems, normalizePhysicalSettings, PHYSICAL_SETTINGS, canInteractPhysical, groundItemLootDisabled, groundItemStorageSpecs, physicalQuantity } from '../core/physical-items.js';
import { requestPhysicalAction } from './physical-item-transfers.js';
import { bindPhysicalItemPointer } from './physical-item-pointer.js';
import { openPhysicalItemEditor, applyPhysicalArtworkGeometry } from './physical-item-editor.js';
import { clearPhysicalDropGhost, showPhysicalDropGhost, installWorldPhysicalGhost, boardScenePoint } from './physical-item-ghost.js';
import { notifyWarning } from '../core/notifications.js';
import { trashcanState, trashcanSelectSceneItem, trashcanItemSelected, trashcanDragTarget, trashcanDeleteSceneItems } from '../apps/gm-trashcan.js';
import { createPhysicalItemFx, positionPhysicalItemFx, revealPhysicalItemFx, hidePhysicalItemFxReveal, tickPhysicalItemFx } from './physical-item-fx.js';
import { closePhysicalLootMenu, openPhysicalLootMenu, physicalDropFromItem } from '../apps/physical-item-ui.js';
import { createPhysicalItemLabel, positionPhysicalItemLabel } from './physical-item-label.js';
import { physicalItemVisible } from '../core/physical-item-visibility.js';
import { transferBoardItemAtPointer } from './physical-item-handoff.js';
import { installPhysicalItemHandoffs } from './physical-item-handoff.js';
import { showPhysicalInventoryPreview, clearPhysicalInventoryPreview, beginPhysicalInventoryDrag, endPhysicalInventoryDrag, activePhysicalInventoryGrip, activePhysicalInventoryRotation } from './physical-inventory-preview.js';
import { physicalDropTargetFromClient } from './physical-item-drop-targets.js';
import { canvasItemDropTarget } from './canvas-item-drop-target.js';
import { promptPhysicalQuantity } from '../apps/physical-item-ui.js';
import { notifyError } from '../core/notifications.js';
import { openGroundContainer, groundContainerTargetFromClient, showGroundTransferAtPoint, clearGroundTransferGhost } from '../apps/ground-container-window.js';

let container=null;
let generation=0;
let decorations=null;
let activeSceneId=null;
const entries=new Map();
function clearCanvasObjects() {
  generation++;stopTicker();openedLootId=null;hoveredGmArtwork=null;
  closePhysicalLootMenu();decorations?.destroy?.(); decorations=null;
  for(const entry of entries.values()) entry.destroy?.({children:true});entries.clear();
  try{container?.destroy?.({children:true});}catch(error){console.warn(`${MODULE_ID} | sprite cleanup`,error);}
  container=null; activeSceneId=null;
}
function actorList(){return game.actors?.contents??[...(game.actors??[])];}
function sightTokens(){return canvas?.tokens?.placeables??[];}
let openedLootId=null;
let hoveredGmArtwork=null;
/** Artwork is always separate from optional loot UI and rarity effects. */
export function applyPhysicalLootPresentation(parent,policy,visible=true) {
  if (!parent) return;
  const show=Boolean(visible && ((policy?.lootEnabled || game?.user?.isGM) || parent._buxaIsContainer) && (policy?.alwaysShowLoot || parent._buxaReveal));
  const menuReveal=Boolean(visible && parent._buxaMenuOpen);
  if (parent._buxaFx) {
    const fxVisible=show||menuReveal;
    parent._buxaFx.visible=fxVisible;
    if(parent._buxaFx._frontFx)parent._buxaFx._frontFx.visible=fxVisible&&
      (parent._buxaFx._visualMode!=='shadow'||menuReveal);
  }
  if (parent._buxaNameplate) {
    parent._buxaNameplate.visible=show && !menuReveal;
    if (!show) parent._buxaNameplate._buxaToggleEdit?.(false);
  }
}
function revealPhysicalItem(parent) {
  if (!parent || parent.visible===false) return;
  for (const entry of entries.values()) if(entry!==parent) {
    entry._buxaReveal=false;
    applyPhysicalLootPresentation(entry,getPolicy(),entry.visible!==false);
  }
  parent._buxaReveal=true;
  openedLootId=parent._buxaRecord?.id;
  applyPhysicalLootPresentation(parent,getPolicy(),true);
  if (game?.user?.isGM) parent._buxaNameplate?._buxaToggleEdit?.(true);
}
function dismissPhysicalLoot() {
  openedLootId=null;
  const policy=getPolicy();
  for (const parent of entries.values()) {
    if(parent._buxaMenuOpen)continue;
    parent._buxaReveal=false;
    applyPhysicalLootPresentation(parent,policy,parent.visible!==false);
  }
}
function syncPhysicalItemVisibility() {
  if (!canvas?.ready || canvas?.scene?.id !== activeSceneId) return;
  const policy=getPolicy();
  const context={user:game.user,scene:canvas.scene,visibility:canvas.visibility,tokens:sightTokens(),actors:actorList(),settings:policy};
  for (const parent of entries.values()) {
    parent.visible=physicalItemVisible(parent._buxaRecord,context);
    // Pixi's event boundary is also disabled for concealed objects.
    parent.eventMode=parent.visible ? 'passive' : 'none';
    if(!parent.visible){
      if(parent._buxaMenuOpen)closePhysicalLootMenu();
      parent._buxaReveal=false;
      if(openedLootId===parent._buxaRecord?.id)openedLootId=null;
    }
    applyPhysicalLootPresentation(parent,policy,parent.visible);
  }
}
/** Pixi v7 (Foundry variants) and Pixi v8 both support selection borders. */
export function drawPhysicalSelectionBorder(graphics,sprite,color) {
  const x=-sprite.width/2-2,y=-sprite.height/2-2;
  if(typeof graphics.rect==='function' && typeof graphics.stroke==='function')
    graphics.rect(x,y,sprite.width+4,sprite.height+4).stroke({color,width:3,alpha:.94});
  else if(typeof graphics.lineStyle==='function' && typeof graphics.drawRect==='function') {
    graphics.lineStyle(3,color,.94);
    graphics.drawRect(x,y,sprite.width+4,sprite.height+4);
  }
  return graphics;
}
function rarityForItem(item) {
  const flags=item?.data?.flags?.[MODULE_ID]?.item||{};
  try {
    const rarities=normalizeItemSystemConfig(getSheetConfig().items).rarities;
    return rarities.find(entry=>entry.id===flags.rarityId) || rarities.find(entry=>entry.id==='common') || rarities[0];
  } catch {return {id:'common',label:'COMMON',color:'#90a3bb'};}
}
const getPolicy = () => normalizePhysicalSettings(game.settings.get(MODULE_ID,PHYSICAL_SETTINGS));
let tickerApp=null;
let tickerSeconds=0;
const tick = ticker => {
  tickerSeconds += Math.min(.07,Math.max(0,Number(ticker?.deltaMS||16.667)/1000));
  for(const parent of entries.values()) if(parent.visible && parent._buxaReady && parent._buxaFx?.visible) tickPhysicalItemFx(parent._buxaFx,tickerSeconds);
  for(const parent of entries.values()) {
    const outline=parent._buxaTrashOutline;
    if(outline) outline.visible=trashcanItemSelected(parent._buxaRecord?.id);
  }
};
function stopTicker(){ tickerApp?.ticker?.remove?.(tick);tickerApp=null; }
function startTicker(){
  const app=canvas?.app;
  if(tickerApp===app)return;
  stopTicker();tickerApp=app;
  app?.ticker?.add?.(tick);
}
let lastSceneContext = { id: null, time: 0 };
export function physicalMenuPointer(event, canvasRef=globalThis.canvas) {
  const native=event?.nativeEvent ?? event?.originalEvent ?? event;
  if (Number.isFinite(native?.clientX) && Number.isFinite(native?.clientY))
    return {x:native.clientX,y:native.clientY};
  const view=canvasRef?.app?.renderer?.canvas ?? canvasRef?.app?.view;
  const rect=view?.getBoundingClientRect?.();
  const screen=canvasRef?.app?.renderer?.screen;
  if(rect && Number.isFinite(event?.global?.x) && Number.isFinite(event?.global?.y))
    return {x:rect.left+event.global.x*rect.width/(screen?.width||rect.width),
      y:rect.top+event.global.y*rect.height/(screen?.height||rect.height)};
  return null;
}
function physicalItemTopAnchor(sprite,canvasRef=globalThis.canvas) {
  const view=canvasRef?.app?.renderer?.canvas ?? canvasRef?.app?.view;
  const rect=view?.getBoundingClientRect?.();
  const bounds=sprite?.getBounds?.();
  if(!rect || !bounds || !Number.isFinite(bounds.x) || !Number.isFinite(bounds.y)) return null;
  const screen=canvasRef?.app?.renderer?.screen;
  const scaleX=rect.width/(screen?.width||rect.width);
  const scaleY=rect.height/(screen?.height||rect.height);
  const visual=itemBoardImageOf(sprite?.parent?._buxaRecord?.data).sceneFx.label;
  const zoom=Number(canvasRef?.stage?.scale?.x)||1;
  return {x:rect.left+(bounds.x+bounds.width/2)*scaleX+visual.x*zoom*scaleX,
    y:rect.top+bounds.y*scaleY+visual.y*zoom*scaleY};
}
function onSceneClick(item, sprite, event) {
  event?.stopPropagation?.();event?.nativeEvent?.preventDefault?.();
  const now=Date.now();
  if(lastSceneContext.id===item.id && now-lastSceneContext.time<220)return;
  lastSceneContext={id:item.id,time:now};
  const parent=sprite.parent;
  if (trashcanState().selecting) {trashcanSelectSceneItem(item.id);return;}
  if(parent._buxaMenuOpen){closePhysicalLootMenu();return;}
  const point=physicalMenuPointer(event);
  const anchorPoint=physicalItemTopAnchor(sprite) ?? point;
  // Canvas input can exist without a browser DOM in headless environments.
  // Keep the native label fallback available in that case.
  if (!point || !globalThis.document?.body?.append) {revealPhysicalItem(parent);return;}
  const policy=getPolicy();
  const canLoot=canInteractPhysical({user:game.user,scene:canvas?.scene,item:parent._buxaRecord,
    actors:actorList(),tokens:canvas?.scene?.tokens?.contents??[],settings:policy,operation:'loot'}).allowed;
  const didOpen=openPhysicalLootMenu({item:parent._buxaRecord,sceneId:canvas?.scene?.id,
    point,anchorPoint,getAnchor:()=>physicalItemTopAnchor(sprite),rarity:rarityForItem(item),canEdit:game.user?.isGM,
    canLoot,hasStorage:parent._buxaIsContainer,disableLooting:groundItemLootDisabled(item),
    onReveal:()=>{
      parent._buxaMenuOpen=true;
      applyPhysicalLootPresentation(parent,getPolicy(),parent.visible!==false);
      revealPhysicalItemFx(parent._buxaFx,tickerSeconds);
    },
    onClose:()=>{
      parent._buxaMenuOpen=false;
      hidePhysicalItemFxReveal(parent._buxaFx);
      applyPhysicalLootPresentation(parent,getPolicy(),parent.visible!==false);
    },
    onOpen:()=>openGroundContainer(parent._buxaRecord),
    onEdit:()=>openPhysicalItemEditor({record:parent._buxaRecord,sprite,parent,sceneId:canvas.scene.id})});
  if (!didOpen) revealPhysicalItem(parent);
}
async function makeSprite(item, parent, revision) {
  const art=stackArtworkFor(item?.data,item?.data?.system?.quantity??1);
  const path=art.custom?await compositeStackArtwork(art):art.img;
  let texture;
  const valid = tex => Boolean(tex && !tex.destroyed && Number(tex.width)>0 && Number(tex.height)>0);
  try { texture=await PIXI.Assets.load(path); }
  catch(error) { console.warn(`${MODULE_ID} | Physical item image failed to load`,path,error); }
  if (!valid(texture) && path!=='icons/svg/item-bag.svg') {
    // A broken custom image must not strand an invisible, unlootable item.
    try { texture=await PIXI.Assets.load('icons/svg/item-bag.svg'); }
    catch(error) {console.warn(`${MODULE_ID} | Physical item fallback image also failed`,error);}
  }

  // Async texture loads can finish after an item was looted, removed or edited.
  if (revision!==generation || !container || !parent?.parent || entries.get(item.id)!==parent) return;
  if (!valid(texture)) {
    console.warn(`${MODULE_ID} | Skipping invalid physical item texture`,item.id,path);
    return;
  }
  let sprite=null,fx=null,label=null;
  try {
    sprite=new PIXI.Sprite(texture);
    sprite.label=`Physical Item: ${item.data?.name||'Item'}`;
    applyPhysicalArtworkGeometry(item,sprite,parent);
    sprite.alpha=Number.isFinite(Number(item.opacity))?Math.max(0.05,Math.min(1,Number(item.opacity))):1;
    sprite.eventMode='static';sprite.cursor='grab';
    // Install the actual interactive artwork FIRST. If its label or FX fails,
    // we must never leave an orphaned beam with no visible item.
    parent.addChild(sprite);
    parent._buxaArtworkSprite=sprite;
    if(game.user?.isGM && typeof PIXI.Graphics==='function') {
      const selectionBorder=new PIXI.Graphics();
      drawPhysicalSelectionBorder(selectionBorder,sprite,0xee6f76);
      selectionBorder.eventMode='none';selectionBorder.visible=false;
      parent.addChild(selectionBorder);parent._buxaTrashOutline=selectionBorder;
    }
    bindPhysicalItemPointer(sprite,parent,{
      onSelect:()=>trashcanSelectSceneItem(item.id),
      // Dragging to inventory is a pickup action, not necessarily permission
      // to reposition ground items. Server rechecks the actual destination.
      allow:()=>{
        const context={user:game.user,scene:canvas?.scene,item:parent._buxaRecord,
          actors:actorList(),tokens:canvas?.scene?.tokens?.contents??[],settings:getPolicy()};
        const move=canInteractPhysical({...context,operation:'move'});
        if(move.allowed)return move;
        const loot=canInteractPhysical({...context,operation:'loot'});
        return loot.allowed?loot:move;
      },
      onStart:grip=>{
        if(parent._buxaMenuOpen)closePhysicalLootMenu();
        beginPhysicalInventoryDrag({id:parent._buxaRecord.id,...parent._buxaRecord.data},grip);
      },
      commit:async(point,pointer)=>{
        if(pointer && trashcanDragTarget(pointer.clientX,pointer.clientY)) {
          parent.position?.set?.(parent._buxaRecord.x,parent._buxaRecord.y);
          await trashcanDeleteSceneItems([parent._buxaRecord.id],canvas.scene.id);
          return;
        }
        if(pointer && (groundContainerTargetFromClient(pointer.clientX,pointer.clientY) || physicalDropTargetFromClient(pointer.clientX,pointer.clientY) || canvasItemDropTarget(pointer.clientX,pointer.clientY,{excludeId:parent._buxaRecord.id}))) {
          // Return artwork to the ground while the quantity picker/GM save
          // runs. A cancelled or rejected transfer must never leave a phantom
          // item visually parked over a sheet or the sidebar.
          parent.position?.set?.(parent._buxaRecord.x,parent._buxaRecord.y);
          const moved=await transferBoardItemAtPointer(parent._buxaRecord,pointer.clientX,pointer.clientY);
          if(moved)return;
        }
        return requestPhysicalAction({action:'move',sceneId:canvas.scene.id,itemId:parent._buxaRecord.id,point});
      },
      warn:notifyWarning,
      preview:(clientX,clientY)=>{
        const data=parent._buxaRecord.data;
        if (trashcanDragTarget(clientX,clientY)) {clearPhysicalInventoryPreview();clearGroundTransferGhost();return;}
        const ground=showGroundTransferAtPoint(data,clientX,clientY,{
          ...activePhysicalInventoryGrip(),rotation:activePhysicalInventoryRotation()});
        if(ground){clearPhysicalInventoryPreview();return;}
        const destination=physicalDropTargetFromClient(clientX,clientY);
        if(destination?.kind==='actor')showPhysicalInventoryPreview({
          name:data?.name,img:data?.img,id:parent._buxaRecord.id,flags:data?.flags
        },destination,clientX,clientY);
        else clearPhysicalInventoryPreview();
      },
      clearPreview:()=>{clearGroundTransferGhost();endPhysicalInventoryDrag();}
    });
    const handleRight=event=>onSceneClick(parent._buxaRecord,sprite,event);
    sprite.on('rightdown',handleRight);
    sprite.on('rightclick',handleRight);
    sprite.on('pointerdown',event=>{if(event.button===2)handleRight(event);});
    sprite.on('pointerover',()=>{if(game.user?.isGM)hoveredGmArtwork={itemId:item.id,sceneId:canvas?.scene?.id};});
    sprite.on('pointerout',()=>{if(hoveredGmArtwork?.itemId===item.id)hoveredGmArtwork=null;});
    const visualMode=getPolicy().visualMode;
    try {
      fx=createPhysicalItemFx(item,rarityForItem(item),visualMode,{revealBeam:true});
      if(fx) {
        parent.addChildAt(fx,0);
        positionPhysicalItemFx(fx,item,sprite);
        if(fx._frontFx)parent.addChild(fx._frontFx);
      }
    } catch(error) {
      console.warn(`${MODULE_ID} | Skipping visual effects for item`,item.id,error);
      fx?.destroy?.({children:true});fx=null;
    }
    try {
      parent._buxaIsContainer=groundItemStorageSpecs(item).length>0;
      label=createPhysicalItemLabel({record:item,parent,rarity:rarityForItem(item),beamHeight:fx?._beamHeight||0,visualMode,
        hasStorage:parent._buxaIsContainer,disableLooting:groundItemLootDisabled(item),onOpen:()=>openGroundContainer(parent._buxaRecord),
        onEdit:()=>openPhysicalItemEditor({record:parent._buxaRecord,sprite,parent,sceneId:canvas.scene.id}),
        onContext:event=>onSceneClick(parent._buxaRecord,sprite,event)});
    } catch(error) {
      // TextStyle failures must not destroy the already-interactive artwork.
      console.error(`${MODULE_ID} | Ground item nameplate could not render`,item.id,error);
    }

    parent._buxaNameplate=label;
    parent._buxaFx=fx;
    parent._buxaReady=true;
    applyPhysicalLootPresentation(parent,getPolicy(),parent.visible!==false);
  } catch(error) {
    // A partial Pixi construction must never strand a beam or invalid sprite.
    console.error(`${MODULE_ID} | Physical scene item render failed`,item.id,error);
    fx?.destroy?.({children:true});
    label?.destroy?.({children:true});
    sprite?.destroy?.();
    parent._buxaFx=null;parent._buxaNameplate=null;parent._buxaReady=false;
  }
}
export function refreshPhysicalCanvas() {
  if (!canvas?.ready || !canvas?.scene || !globalThis.PIXI?.Container || !globalThis.PIXI?.Assets?.load) return;
  const sceneId=canvas.scene.id;
  if (!container || activeSceneId !== sceneId || !container.parent) {
    clearCanvasObjects();
    container=new PIXI.Container();container.label='Buxa Physical Items';container.eventMode='passive';
    // InterfaceCanvasGroup participates in the Foundry camera transform and
    // supports pointer interaction without an independent DOM movement loop.
    const layer=canvas.interface||canvas.stage;
    layer.addChild(container);
    activeSceneId=sceneId;
  }
  startTicker();
  const revision=generation;
  const latest=scenePhysicalItems(canvas.scene);
  const wanted=new Set(latest.map(item=>item.id));
  for (const [id,parent] of entries) {
    if (wanted.has(id)) continue;
    if (decorations && decorations.parent && parent.children.includes(decorations.parent)) {
      closePhysicalLootMenu();decorations=null;
    }
    if(openedLootId===id)openedLootId=null;
    parent.destroy({children:true});entries.delete(id);
  }
  for (const item of latest) {
    let parent=entries.get(item.id);
    const signature=`${item.data?.img||''}:${JSON.stringify(item.data?.flags?.buxaframework?.item?.multiple?.stackImages||[])}:${item.data?.system?.quantity??1}:${item.size}:${item.rotation||0}:${item.data?.flags?.[MODULE_ID]?.item?.rarityId||'common'}:${rarityForItem(item)?.beamOpacity??100}:${getPolicy().visualMode}`;
    if (parent && parent._buxaSignature !== signature) {
      if(openedLootId===item.id)openedLootId=null;
      parent.destroy({children:true});entries.delete(item.id);parent=null;
    }
    if (!parent) {
      parent=new PIXI.Container();parent.label=`Physical Item ${item.id}`;
      parent.eventMode='passive';parent._buxaSignature=signature;
      container.addChild(parent);entries.set(item.id,parent);
      parent.position.set(Number(item.x),Number(item.y));
      parent._buxaRecord=item;
      void makeSprite(item,parent,revision);
    } else {
      // Existing sprites retain their textures and listeners during moves.
      // No flicker or graphics allocation on each Scene flag update.
      if (!parent._buxaDragging) {
        const sprite=parent.children.find(child=>child instanceof PIXI.Sprite);
        if(sprite) {
          applyPhysicalArtworkGeometry(item,sprite,parent);
          sprite.alpha=Number.isFinite(Number(item.opacity))?Math.max(0.05,Math.min(1,Number(item.opacity))):1;
          positionPhysicalItemFx(parent._buxaFx,item,sprite);
          positionPhysicalItemLabel(parent._buxaNameplate,item,parent._buxaFx?._beamHeight||0,getPolicy().visualMode);
        }
        else parent.position.set(Number(item.x),Number(item.y));
      }
      parent._buxaRecord=item;
    }
  }
  syncPhysicalItemVisibility();
}

function isOnBoard(target) {
  const board=document.getElementById('board');
  return Boolean(board && (board===target||board.contains(target)));
}
function clientToScene(x,y) {return boardScenePoint(x,y);}
function itemDragData(event) {
  const raw=event?.dataTransfer?.getData?.('text/plain')||event?.dataTransfer?.getData?.('text');
  try {const payload=JSON.parse(raw);return payload?.type==='Item' ? payload : null;}
  catch{return null;}
}
function worldDraggedItem(event) {
  const payload=itemDragData(event);
  if (!/^Item\.[^.]+$/.test(payload?.uuid||''))return null;
  return game.items?.get?.(payload.uuid.split('.').at(-1))||null;
}
async function handleItemDrop(event,point) {
  const payload=itemDragData(event);
  if (!payload) return false;
  const worldItem=worldDraggedItem(event);
  const item=(typeof fromUuid==='function' && payload.uuid ? await fromUuid(payload.uuid) : null)
    || worldItem;
  if(!item){notifyWarning('This item could not be resolved.');return true;}
  const source=item.parent?.documentName==='Actor'||item.parent?.items?.get?.(item.id) ? 'actor' : 'world';
  const actor=item.parent;
  const target=canvasItemDropTarget(event.clientX,event.clientY);
  if(target?.kind==='actor' || target?.kind==='ground-container') {
    const quantity=await promptPhysicalQuantity(item);
    if(!quantity)return true;
    const base={itemId:item.id,sceneId:canvas.scene.id,quantity};
    try {
      if(target.kind==='actor') {
        await requestPhysicalAction({action:'transfer',source,destination:'actor',...base,
          actorId:target.actorId,targetTokenId:target.targetTokenId,
          ...(source==='actor'?{sourceTokenId:actor.isToken?(actor.token?.id||actor.parent?.id):undefined,sourceActorId:actor.id}: {})});
      } else {
        await requestPhysicalAction({action:'container',direction:source==='actor'?'store':'import',source,...base,
          containerId:target.containerId,targetActorId:source==='actor'?actor.id:undefined});
      }
    }catch(error){notifyWarning(error.message);}
    return true;
  }
  await physicalDropFromItem(item,{source,sceneId:canvas.scene.id,itemId:item.id,point,
    ...(source==='actor'?{actorId:actor.id,...(actor.isToken?{sourceTokenId:actor.token?.id||actor.parent?.id}:{})}:{})});
  return true;
}
export function isPhysicalBoardPoint(x,y) {
  return Boolean(canvas?.ready&&isOnBoard(document.elementFromPoint(x,y)));
}
export function dropInventoryItemOnBoard(actor, item, x, y) {
  if (!isPhysicalBoardPoint(x,y)) return false;
  const point=clientToScene(x,y);if(!point)return false;
  clearPhysicalDropGhost();
  const target=canvasItemDropTarget(x,y);
  if(target?.kind==='ground-container') {
    void requestPhysicalAction({action:'container',direction:'store',sceneId:canvas.scene.id,
      containerId:target.containerId,targetActorId:actor.id,
      ...(actor.isToken?{targetTokenId:actor.token?.id||actor.parent?.id}:{}),
      itemId:item.id,quantity:physicalQuantity(item)}).catch(error=>notifyWarning(error.message));
    return true;
  }
  if(target?.kind==='actor') {
    if(target.actorId!==actor.id || target.targetTokenId !== (actor.isToken?(actor.token?.id||actor.parent?.id):target.targetTokenId)) {
      void requestPhysicalAction({action:'transfer',source:'actor',destination:'actor',sceneId:canvas.scene.id,
        actorId:target.actorId,targetTokenId:target.targetTokenId,
        sourceActorId:actor.id,sourceTokenId:actor.isToken?(actor.token?.id||actor.parent?.id):undefined,
        itemId:item.id,quantity:physicalQuantity(item)}).catch(error=>notifyWarning(error.message));
    }
    return true;
  }
  void physicalDropFromItem(item,{source:'actor',actorId:actor.id,
    ...(actor.isToken ? {sourceTokenId:actor.token?.id || actor.parent?.id} : {}),
    itemId:item.id,sceneId:canvas.scene.id,point});
  return true;
}
export function installPhysicalItemCanvas() {
  installPhysicalItemHandoffs();
  Hooks.on('buxaPhysicalSceneItemsChanged',refreshPhysicalCanvas);
  Hooks.on('canvasReady',refreshPhysicalCanvas);
  // V14 visibility is event-driven. Fog/LOS changes must hide the entire
  // interface-level item container, including labels and rarity lights.
  Hooks.on('sightRefresh',syncPhysicalItemVisibility);
  Hooks.on('visibilityRefresh',syncPhysicalItemVisibility);
  Hooks.on('controlToken',syncPhysicalItemVisibility);
  Hooks.on('updateActor',(actor,changes)=>{
    if (JSON.stringify(changes?.flags?.[MODULE_ID]??{}).includes('linkedUsers') ||
        JSON.stringify(changes?.flags??{}).includes('linkedUsers')) syncPhysicalItemVisibility();
  });
  Hooks.on('updateToken',syncPhysicalItemVisibility);
  Hooks.on('createToken',syncPhysicalItemVisibility);
  Hooks.on('deleteToken',syncPhysicalItemVisibility);
  Hooks.on('buxaSheetConfigUpdated',()=>{refreshPhysicalCanvas();});
  Hooks.on('buxaPhysicalVisualSettingsChanged',()=>{closePhysicalLootMenu();dismissPhysicalLoot();refreshPhysicalCanvas();syncPhysicalItemVisibility();});
  if (globalThis.canvas?.ready) refreshPhysicalCanvas();
  Hooks.on('canvasTearDown',clearCanvasObjects);
  Hooks.on('updateScene',(scene,changes)=>{
    if (scene.id!==canvas?.scene?.id)return;
    const changed=JSON.stringify(changes);
    if(changed.includes('physicalItems'))refreshPhysicalCanvas();
  });
  installWorldPhysicalGhost(worldDraggedItem);
  // Dismiss a temporarily exposed loot label after a click elsewhere. Defer
  // until Pixi's pointertap handler has had a chance to execute the loot.
  document.addEventListener('pointerup',event=>{
    if(event.button!==0 || !openedLootId) return;
    setTimeout(()=>dismissPhysicalLoot(),0);
  },true);
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape') dismissPhysicalLoot();
    if(event.key?.toLowerCase()==='e' && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey && game.user?.isGM && hoveredGmArtwork?.sceneId===canvas?.scene?.id && !event.target?.closest?.('input,textarea,select,[contenteditable],.window-app,.application')) {
      const parent=entries.get(hoveredGmArtwork.itemId);
      const sprite=parent?._buxaArtworkSprite;
      if(parent?.visible && parent?._buxaReady && sprite){
        event.preventDefault();event.stopPropagation();
        closePhysicalLootMenu();
        openPhysicalItemEditor({record:parent._buxaRecord,sprite,parent,sceneId:canvas.scene.id});
      }
    }
  },true);
  document.addEventListener('dragover',e=>{
    if(!canvas?.ready||!isOnBoard(e.target))return;
    if (![...(e.dataTransfer?.types||[])].some(type=>['text/plain','text'].includes(type)))return;
    e.preventDefault();e.dataTransfer.dropEffect='copy';
  },true);
  document.addEventListener('drop',e=>{
    if(!canvas?.ready||!isOnBoard(e.target)||!itemDragData(e))return;
    // Prevent Foundry from interpreting an Actor-owned Item as a Scene
    // embedded document ("Scene is not valid embedded Document in Actor").
    const point=clientToScene(e.clientX,e.clientY);
    e.preventDefault();e.stopImmediatePropagation();clearPhysicalDropGhost();
    if(point)void handleItemDrop(e,point).catch(error=>notifyWarning(error.message));
  },true);
}
