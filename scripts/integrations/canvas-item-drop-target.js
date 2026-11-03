/** Identify real canvas drop destinations using scene-space geometry, never
 * the DOM board element (tokens and item sprites live on the same canvas). */
import { boardScenePoint } from './physical-item-ghost.js';
import { scenePhysicalItems, groundItemStorageSpecs, normalizePhysicalSettings, PHYSICAL_SETTINGS } from '../core/physical-items.js';
import { MODULE_ID } from '../core/constants.js';
import { physicalItemVisible } from '../core/physical-item-visibility.js';

export function findCanvasItemTargetAtPoint(point, {scene, tokens=[], records=[], user, excludeId=null, visible=()=>true}={}) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  // A storage item is smaller than a token and should win when they overlap.
  for (const item of [...records].reverse()) {
    if (item.id===excludeId || !groundItemStorageSpecs(item).length || !visible(item)) continue;
    const size=Math.max(20,Number(item.size)||76);
    if(point.x>=item.x && point.x<=item.x+size && point.y>=item.y && point.y<=item.y+size)
      return {kind:'ground-container',containerId:item.id,sceneId:scene?.id};
  }
  const grid=Number(scene?.grid?.size)||100;
  for (const token of [...tokens].reverse()) {
    const doc=token?.document||token;
    const actor=token?.actor||doc?.actor;
    if (!doc || !actor || doc.hidden && !user?.isGM) continue;
    const x=Number(doc.x),y=Number(doc.y),w=Number(doc.width||1)*grid,h=Number(doc.height||1)*grid;
    if(point.x>=x && point.x<=x+w && point.y>=y && point.y<=y+h)
      return {kind:'actor',actorId:actor.id,targetTokenId:doc.id,sceneId:scene?.id,position:null};
  }
  return null;
}
export function canvasItemDropTarget(clientX,clientY,{excludeId=null}={}) {
  const board=document.getElementById('board');
  const hit=document.elementFromPoint?.(clientX,clientY);
  if(!board || !(hit===board||board.contains(hit)) || !canvas?.ready || !canvas.scene)return null;
  const point=boardScenePoint(clientX,clientY);
  const tokens=canvas.tokens?.placeables ?? canvas.scene.tokens?.contents ?? [];
  const context={user:game.user,scene:canvas.scene,visibility:canvas.visibility,
    tokens,actors:game.actors?.contents??[],
    settings:normalizePhysicalSettings(game.settings.get(MODULE_ID,PHYSICAL_SETTINGS))};
  return findCanvasItemTargetAtPoint(point,{scene:canvas.scene,tokens,
    records:scenePhysicalItems(canvas.scene),user:game.user,excludeId,
    visible:record=>physicalItemVisible(record,context)});
}
