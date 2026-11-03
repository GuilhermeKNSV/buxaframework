import { itemBoardImageOf } from "../core/item-board-image.js";
/** Center-anchored physical item ghost and temporary drop-distance radius.
 * The authoritative transfer converts this displayed center to a top-left
 * Scene origin, using the exact same geometry as the preview. */
import { MODULE_ID } from '../core/constants.js';
import { PHYSICAL_SETTINGS, normalizePhysicalSettings, canDropPhysical,
  physicalDropRange, physicalDropArtworkOrigin } from '../core/physical-items.js';
import { globalFromClient } from './physical-item-pointer.js';
let ghost=null, radiusGraphics=null, radiusParent=null, rangeOverlay=null;
let lastCenter=null;
const onBoard=(x,y)=>{
  const board=document.getElementById('board');
  const target=document.elementFromPoint(x,y);
  return Boolean(board && (board===target || board.contains(target)));
};
export function boardScenePoint(clientX,clientY) {
  // Foundry V14 exposes the complete client -> canvas transform. Unlike a
  // manual stage.toLocal map, this handles scene padding, DPI and canvas zoom.
  const converted=globalThis.canvas?.canvasCoordinatesFromClient?.({x:clientX,y:clientY});
  if(Number.isFinite(converted?.x)&&Number.isFinite(converted?.y))
    return {x:converted.x,y:converted.y};
  const global=globalFromClient(clientX,clientY);
  if(!global || !globalThis.canvas?.stage?.toLocal || !globalThis.PIXI?.Point)return null;
  const local=canvas.stage.toLocal(new PIXI.Point(global.x,global.y));
  return Number.isFinite(local?.x)&&Number.isFinite(local?.y)?{x:local.x,y:local.y}:null;
}
function clearRange(){
  radiusGraphics?.destroy?.();radiusGraphics=null;radiusParent=null;
  rangeOverlay?.remove?.();rangeOverlay=null;
}
export function clearPhysicalDropGhost(){ghost?.remove?.();ghost=null;lastCenter=null;clearRange();}
const actors=()=>game.actors?.contents??[...(game.actors??[])];
const tokens=()=>canvas?.scene?.tokens?.contents??[...(canvas?.scene?.tokens??[])];
function rangeForActor(actor) {
  if(!actor || !canvas?.scene)return null;
  let policy;
  try{policy=normalizePhysicalSettings(game.settings.get(MODULE_ID,PHYSICAL_SETTINGS));}catch{return null;}
  if(!policy.playerDropRangeEnabled)return null;
  const user=game.user;
  return {policy,validation:physicalDropRange({user,actorId:actor.id,scene:canvas.scene,
    actors:actors(),tokens:tokens(),settings:policy})};
}
function circle(g,x,y,r,color,alpha) {
  if(typeof g.circle==='function' && typeof g.stroke==='function')g.circle(x,y,r).stroke({color,width:2,alpha});
  else if(typeof g.lineStyle==='function' && typeof g.drawCircle==='function'){
    g.lineStyle(2,color,alpha);g.drawCircle(x,y,r);
  }
}
function drawRange(actor,valid) {
  const state=rangeForActor(actor);
  if(!state?.policy.showDropRangeOutline || !state.validation.allowed){clearRange();return;}
  const toClient=canvas?.clientCoordinatesFromCanvas;
  const {centers,radius}=state.validation;
  // Use Foundry's actual projection for the radius rather than adding screen
  // pixels to a canvas-space position. This remains accurate at any zoom,
  // resolution, or scene padding. The HTML overlay cannot block pointer drops.
  if(typeof toClient==='function' && typeof document.createElementNS==='function') {
    radiusGraphics?.destroy?.();radiusGraphics=null;radiusParent=null;
    if(!rangeOverlay) {
      rangeOverlay=document.createElementNS('http://www.w3.org/2000/svg','svg');
      rangeOverlay.setAttribute('aria-hidden','true');
      Object.assign(rangeOverlay.style,{
        position:'fixed',left:'0',top:'0',width:'100vw',height:'100vh',
        zIndex:'99998',pointerEvents:'none',overflow:'hidden'
      });
      document.body.append(rangeOverlay);
    }
    rangeOverlay.replaceChildren();
    for(const point of centers) {
      const center=toClient.call(canvas,{x:point.x,y:point.y});
      const edge=toClient.call(canvas,{x:point.x+radius,y:point.y});
      if(!Number.isFinite(center?.x)||!Number.isFinite(center?.y)||!Number.isFinite(edge?.x))continue;
      const ring=document.createElementNS('http://www.w3.org/2000/svg','circle');
      ring.setAttribute('cx',String(center.x));ring.setAttribute('cy',String(center.y));
      ring.setAttribute('r',String(Math.max(1,Math.hypot(edge.x-center.x,edge.y-center.y))));
      ring.setAttribute('fill','none');
      ring.setAttribute('stroke',valid?'#79dbe9':'#f36b80');
      ring.setAttribute('stroke-width','2.5');
      ring.setAttribute('stroke-opacity','.92');
      ring.setAttribute('stroke-dasharray','8 5');
      ring.setAttribute('vector-effect','non-scaling-stroke');
      rangeOverlay.append(ring);
    }
    return;
  }
  // Lightweight PIXI fallback for older Foundry runtimes and test harnesses.
  if(!globalThis.PIXI?.Graphics){clearRange();return;}
  rangeOverlay?.remove?.();rangeOverlay=null;
  const layer=canvas.interface||canvas.stage;
  if(!layer?.addChild){clearRange();return;}
  if(!radiusGraphics || radiusParent!==layer){clearRange();radiusGraphics=new PIXI.Graphics();radiusParent=layer;
    radiusGraphics.eventMode='none';radiusGraphics.interactiveChildren=false;layer.addChild(radiusGraphics);}
  radiusGraphics.clear?.();
  for(const {x,y} of centers)circle(radiusGraphics,x,y,radius,valid?0x79dbe9:0xf36b80,.92);
}
export function describeBoardDropPreview(item,clientX,clientY,{actor=null}={}) {
  const center=boardScenePoint(clientX,clientY);
  if(!center || !canvas?.scene)return null;
  const scene=canvas.scene;
  const image=itemBoardImageOf(item);
  const size=image.size;
  const origin=physicalDropArtworkOrigin(center,Math.round(size),scene);
  const state=rangeForActor(actor);
  let allowed=true,reason=null;
  if(state?.policy.playerDropRangeEnabled){
    const check=canDropPhysical({user:game.user,actorId:actor.id,scene,point:center,
      actors:actors(),tokens:tokens(),settings:state.policy});
    allowed=check.allowed;reason=check.reason;
  }
  return {center,origin,valid:Boolean(origin)&&allowed,reason,sceneSize:size};
}
export function showPhysicalDropGhost(item,x,y,{valid=true,actor=null}={}) {
  if(!item || !onBoard(x,y) || !canvas?.ready){clearPhysicalDropGhost();return false;}
  const data=describeBoardDropPreview(item,x,y,{actor});
  if(!data){clearPhysicalDropGhost();return false;}
  const src=item.img||item?.data?.img||'icons/svg/item-bag.svg';
  if(!ghost){ghost=document.createElement('div');ghost.className='buxa-physical-drop-ghost';ghost.setAttribute('aria-hidden','true');
    const image=document.createElement('img');image.draggable=false;ghost.append(image);document.body.append(ghost);}
  const art=ghost.querySelector('img');if(art.getAttribute('src')!==src)art.src=src;
  const imageDefaults=itemBoardImageOf(item);
  if(art.style)art.style.transform=`rotate(${imageDefaults.rotation}deg)`;
  ghost.style.opacity=String(imageDefaults.opacity);
  const zoom=canvas?.stage?.scale?.x||1;
  const board=document.getElementById('board');
  const rect=board?.getBoundingClientRect();
  const renderer=canvas?.app?.renderer;
  const screen=renderer?.screen;
  const renderScale=rect?.width&&screen?.width?rect.width/screen.width:1;
  let size=Math.min(400,Math.max(16,data.sceneSize*zoom*renderScale));
  let left=x-size/2,top=y-size/2;
  if(data.origin && typeof canvas?.clientCoordinatesFromCanvas==='function') {
    const a=canvas.clientCoordinatesFromCanvas(data.origin);
    const b=canvas.clientCoordinatesFromCanvas({x:data.origin.x+data.sceneSize,y:data.origin.y+data.sceneSize});
    if([a?.x,a?.y,b?.x,b?.y].every(Number.isFinite)) {
      left=a.x;top=a.y;size=Math.max(1,Math.abs(b.x-a.x));
      ghost.style.height=`${Math.max(1,Math.abs(b.y-a.y))}px`;
    }
  } else ghost.style.height=`${size}px`;
  ghost.style.width=`${size}px`;
  ghost.style.left=`${left}px`;ghost.style.top=`${top}px`;
  ghost.classList.toggle('is-invalid',!valid||!data.valid);
  lastCenter=data.center;
  drawRange(actor,valid&&data.valid);
  return true;
}
export function installWorldPhysicalGhost(getItem){
  let draggingItem=null;
  document.addEventListener('dragstart',event=>{
    const id=event.target?.closest?.('[data-buxa-dir-item]')?.dataset.buxaDirItem;
    draggingItem=(id&&game.items?.get?.(id))||null;
  },false);
  document.addEventListener('dragover',event=>{
    const item=getItem(event)||draggingItem;
    if(item)showPhysicalDropGhost(item,event.clientX,event.clientY);
    else clearPhysicalDropGhost();
  },true);
  const abandonDrag=()=>{draggingItem=null;clearPhysicalDropGhost();};
  for(const event of ['drop','dragend'])document.addEventListener(event,abandonDrag,true);
  document.defaultView?.addEventListener('blur',abandonDrag);
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden')abandonDrag();
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape')clearPhysicalDropGhost();},true);
}
