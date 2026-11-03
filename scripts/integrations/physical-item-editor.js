/** GM-only direct-manipulation editor. The preview is local; Save is the only Scene write. */
import { normalizePhysicalArtwork } from '../core/physical-items.js';
import { requestPhysicalAction } from './physical-item-transfers.js';
import { notifyError, notifySuccess } from '../core/notifications.js';
import { positionPhysicalItemFx } from './physical-item-fx.js';
import { positionPhysicalItemLabel } from './physical-item-label.js';

const rendererPoint = (x,y) => {
  const result=globalThis.canvas?.canvasCoordinatesFromClient?.({x,y});
  if (Number.isFinite(result?.x)&&Number.isFinite(result?.y)) return result;
  const board=document.getElementById('board');
  const rect=board?.getBoundingClientRect();
  if (!rect) return null;
  const stage=globalThis.canvas?.stage;
  const screen=globalThis.canvas?.app?.renderer?.screen;
  const sx=(x-rect.left)*(screen?.width??rect.width)/rect.width;
  const sy=(y-rect.top)*(screen?.height??rect.height)/rect.height;
  return stage?.toLocal?.(new PIXI.Point(sx,sy))??null;
};
function artworkGeometry(record,sprite,parent) {
  parent.position.set(record.x,record.y);
  const size=record.size;
  const tex=sprite.texture;
  const factor=Math.min(size/Math.max(1,tex?.width||size),size/Math.max(1,tex?.height||size));
  sprite.width=Math.max(1,(tex?.width||size)*factor);
  sprite.height=Math.max(1,(tex?.height||size)*factor);
  sprite.anchor?.set?.(0.5);
  sprite.position.set(size/2,size/2);
  sprite.rotation=record.rotation*Math.PI/180;
}
export { artworkGeometry as applyPhysicalArtworkGeometry };

export function openPhysicalItemEditor({record,sprite,parent,sceneId}) {
  if (!game.user?.isGM) return;
  document.querySelector('.buxa-physical-editor')?.remove();
  const original=normalizePhysicalArtwork(record,record);
  let draft={...original};
  const overlay=document.createElement('div');
  overlay.className='buxa-physical-editor';
  overlay.innerHTML=`<span class="buxa-physical-editor-frame"></span><button type="button" data-handle="rotate" title="Rotate item" aria-label="Rotate item">⟳</button><button type="button" data-handle="resize" title="Resize item" aria-label="Resize item">↘</button><div class="buxa-physical-editor-actions"><span>DRAG · RESIZE · ROTATE</span><button type="button" data-cancel>Cancel</button><button type="button" data-save>Save</button></div>`;
  document.body.append(overlay);
  let active=null,frame=0,done=false;
  const position=()=>{
    frame=0;
    if(done)return;
    const board=document.getElementById('board');
    const bounds=sprite.getBounds?.();const br=board?.getBoundingClientRect?.();
    if(!bounds||!br)return;
    const screen=canvas.app?.renderer?.screen;
    const factorX=br.width/(screen?.width||br.width),factorY=br.height/(screen?.height||br.height);
    overlay.style.left=`${br.left+bounds.x*factorX}px`;
    overlay.style.top=`${br.top+bounds.y*factorY}px`;
    overlay.style.width=`${Math.max(24,bounds.width*factorX)}px`;
    overlay.style.height=`${Math.max(24,bounds.height*factorY)}px`;
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(position);};
  const updatePreview=record=>{
    artworkGeometry(record,sprite,parent);
    positionPhysicalItemFx(parent._buxaFx,record,sprite);
    positionPhysicalItemLabel(parent._buxaNameplate,record,parent._buxaFx?._beamHeight||0,parent._buxaFx?._visualMode||'beam');
  };
  const preview=()=>{updatePreview(draft);schedule();};
  const teardown=(restore=false)=>{
    done=true;if(frame)cancelAnimationFrame(frame);
    window.removeEventListener('pointermove',move,true);
    window.removeEventListener('pointerup',end,true);
    window.removeEventListener('pointercancel',end,true);
    window.removeEventListener('keydown',key,true);
    if(restore)updatePreview(original);
    overlay.remove();
  };
  const move=event=>{
    if(!active||event.pointerId!==active.id)return;
    const point=rendererPoint(event.clientX,event.clientY);
    if(!point)return;
    const dx=point.x-active.start.x,dy=point.y-active.start.y;
    if(active.mode==='move') draft={...active.initial,x:Math.round(active.initial.x+dx),y:Math.round(active.initial.y+dy)};
    else if(active.mode==='resize') draft={...active.initial,size:Math.max(20,Math.min(800,Math.round(active.initial.size+Math.max(dx,dy))))};
    else {
      const centerX=active.initial.x+active.initial.size/2,centerY=active.initial.y+active.initial.size/2;
      const angle=Math.atan2(point.y-centerY,point.x-centerX);
      draft={...active.initial,rotation:Math.round(active.initial.rotation+(angle-active.startAngle)*180/Math.PI)};
    }
    preview();event.preventDefault();event.stopPropagation();
  };
  const end=()=>{active=null;};
  const key=event=>{if(event.key==='Escape'){teardown(true);event.preventDefault();}};
  overlay.addEventListener('pointerdown',event=>{
    if(event.button!==0||event.target.closest('[data-save],[data-cancel]'))return;
    const point=rendererPoint(event.clientX,event.clientY);if(!point)return;
    const mode=event.target.closest('[data-handle]')?.dataset.handle||'move';
    const initial={...draft};
    const startAngle=Math.atan2(point.y-initial.y-initial.size/2,point.x-initial.x-initial.size/2);
    active={id:event.pointerId,mode,start:point,initial,startAngle};
    event.preventDefault();event.stopPropagation();
  });
  overlay.querySelector('[data-cancel]').addEventListener('click',()=>teardown(true));
  overlay.querySelector('[data-save]').addEventListener('click',async()=>{
    const button=overlay.querySelector('[data-save]');button.disabled=true;
    try{await requestPhysicalAction({action:'edit',sceneId,itemId:record.id,artwork:draft});notifySuccess('Physical item artwork saved.');teardown(false);}
    catch(error){notifyError(error.message);button.disabled=false;}
  });
  window.addEventListener('pointermove',move,true);
  window.addEventListener('pointerup',end,true);
  window.addEventListener('pointercancel',end,true);
  window.addEventListener('keydown',key,true);
  position();
}
