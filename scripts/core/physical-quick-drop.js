/** Choose a deterministic nearby drop point for a one-click inventory drop.
 * The authoritative GM transfer still validates ownership, capacity and range.
 * This helper only chooses a real scene-center position that fits the artwork.
 */
import { physicalSceneRect, physicalDropArtworkOrigin, canDropPhysical } from './physical-items.js';

const finite = value => value != null && value !== '' && typeof value !== 'boolean' && Number.isFinite(Number(value));
const centerOf = (token, grid) => ({
  x: Number(token.x) + Number(token.width ?? 1) * grid / 2,
  y: Number(token.y) + Number(token.height ?? 1) * grid / 2
});

export function quickDropPoint({actor,scene,user,tokens=[],actors=[],settings={},selected=[],viewCenter=null}={}) {
  if(!actor?.id || !scene) return null;
  const grid=Math.max(1,Number(scene.grid?.size)||100);
  const artSize=Math.round(grid*.76);
  const actorTokens=tokens.filter(t=>
    (t.actorId ?? t.actor?.id)===actor.id && !t.hidden && finite(t.x) && finite(t.y) &&
    finite(t.width??1) && Number(t.width??1)>0 && finite(t.height??1) && Number(t.height??1)>0);
  const selectedIds=new Set(selected.map(t=>t.id ?? t.document?.id));
  actorTokens.sort((a,b)=>Number(selectedIds.has(b.id ?? b.document?.id))-Number(selectedIds.has(a.id ?? a.document?.id)));
  const origins=actorTokens.map(t=>centerOf(t,grid));
  // A GM with no character token can still drop at the camera center.
  if(!origins.length && user?.isGM) {
    const bounds=physicalSceneRect(scene);
    const fallback={x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2};
    const camera=viewCenter && finite(viewCenter.x) && finite(viewCenter.y)?viewCenter:fallback;
    origins.push(camera);
  }
  if(!origins.length) return null;
  // Try beside the token before its own square. The last center candidate
  // allows a tight scene edge, or a configured distance of exactly zero.
  const offsets=[[.9,0],[-.9,0],[0,.9],[0,-.9],[.7,.7],[-.7,.7],[.7,-.7],[-.7,-.7],[0,0]];
  for(const origin of origins) for(const [dx,dy] of offsets) {
    const point={x:origin.x+dx*grid,y:origin.y+dy*grid};
    if(!physicalDropArtworkOrigin(point,artSize,scene)) continue;
    const allowed=canDropPhysical({user,actorId:actor.id,scene,point,actors,tokens,settings});
    if(allowed.allowed) return point;
  }
  return null;
}
