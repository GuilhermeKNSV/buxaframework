/** GM-side, requester-specific sight gate for scene-item interactions.
 * The GM's own omniscient canvas.testVisibility is NOT authoritative for a
 * different player. Only vision sources of that player's explicitly linked
 * tokens may authorize seeing a scene Item. A missing source fails closed. */
const center=record=>{
 const x=Number(record?.x),y=Number(record?.y),size=Number(record?.size);
 if (![x,y,size].every(Number.isFinite)||size<=0)return [];
 // Dense interior samples prevent an item's transparent bounding area from
 // revealing it at a fog edge. This is conservative, not a pixel mask.
 const samples=[];
 for (const ratioY of [0.16,0.3,0.5,0.7,0.84])
  for (const ratioX of [0.16,0.3,0.5,0.7,0.84])
   samples.push({x:x+size*ratioX,y:y+size*ratioY});
 return samples;
};
export function playerSightForPhysicalItem({user,scene,item,actors=[],tokens=[],canvas:viewer=globalThis.canvas}={}) {
 if(user?.isGM) return {allowed:true};
 if (!user?.id || !scene?.id || !item)return {allowed:false,reason:'Invalid scene vision context.'};
 if(scene?.tokenVision===false)return {allowed:true};
 // Without an active scene and initialized GM vision sources, we cannot use
 // omniscient GM vision as proof. Never turn a missing source into access.
 if(!viewer?.ready || viewer.scene?.id!==scene.id)
  return {allowed:false,reason:'The GM must have this scene open to verify character sight.'};
 const linked=new Set(actors.filter(actor=>actor?.getFlag?.('buxaframework','linkedUsers')?.includes?.(user.id)).map(actor=>actor.id));
 if(!linked.size)return {allowed:false,reason:'No character is explicitly linked to this player.'};
 const live=viewer.tokens?.placeables??[];
 const eligible=live.filter(token=>{
  const doc=token.document??token;
  if (doc?.hidden || !doc?.sight?.enabled || !linked.has(doc.actorId??token.actor?.id))return false;
  if (Array.isArray(tokens) && tokens.length && !tokens.some(t=>(t.id??t.document?.id)===(doc.id??token.id)))return false;
  return typeof (token.vision??token.visionSource)?.testPoint==='function';
 });
 const samples=center(item);
 if(!eligible.length || !samples.length)return {allowed:false,reason:'No active linked character vision is available for this item.'};
 const seen=samples.every(point=>eligible.some(token=>{
  try {return (token.vision??token.visionSource).testPoint({...point,elevation:0})===true;}
  catch{return false;}
 }));
 return seen?{allowed:true}:{allowed:false,reason:'The item is outside your character’s visible area.'};
}
