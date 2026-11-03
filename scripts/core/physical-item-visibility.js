/** Determine whether a physical scene item is currently visible to this viewer.
 * Physical items live in canvas.interface (not fog-masked), so both drawing
 * and interaction need an explicit LOS gate using Foundry's vision service.
 */
const center = record => {
  const x=Number(record?.x), y=Number(record?.y), size=Number(record?.size)||76;
  if (!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(size)||size<=0) return null;
  return {x,y,size,cx:x+size/2,cy:y+size/2};
};
// Never use "any point visible" for a dropped item. Items are drawn above the
// Foundry fog mask, so a permissive edge/corner test leaks the entire sprite,
// nameplate and rarity effect into obscured space. Demand that the item core
// (center and its inset corners) is actually visible before drawing any of it.
const pointsFor = ({x,y,size,cx,cy}) => {
  // Denser conservative core than the previous 5-point check. Native pixel
  // masking is not exposed to these custom Interface sprites in Foundry V14.
  const points=[];
  for(const row of [0.16,0.3,0.5,0.7,0.84])
    for(const col of [0.16,0.3,0.5,0.7,0.84])
      points.push({x:x+size*col,y:y+size*row});
  return points;
};
const sightToken = token => {
  const doc=token?.document ?? token;
  return Boolean(doc && !doc.hidden && !token?.hidden && doc.sight?.enabled !== false);
};
/** Only Buxa's explicit actor links qualify for linked-character sight.
 * Tokens do not need to be controlled: an owner can see through their
 * linked character while no token is selected. */
function linkedVisionSources(user, tokens=[], actors=[]) {
  if (!user?.id) return [];
  const linked=new Set(actors.filter(actor=>{
    const users=actor?.getFlag?.('buxaframework','linkedUsers');
    return Array.isArray(users) && users.includes(user.id);
  }).map(actor=>actor.id));
  if (!linked.size) return [];
  return tokens.filter(token=>sightToken(token) && linked.has(
    token?.document?.actorId ?? token?.actor?.id ?? token?.actorId
  ));
}
function controlledVisionSources(tokens=[]) {
  return tokens.filter(token=>token?.controlled && sightToken(token));
}
function sourceSeesPoint(token, point) {
  const source=token?.vision || token?.visionSource || token?.source;
  // V14's PointVisionSource.testPoint uses its restricted source shape,
  // including sight range, rather than the potentially unbounded LOS alone.
  if (typeof source?.testPoint === 'function') {
    try { return Boolean(source.testPoint({...point,elevation:0})); }
    catch { /* Continue to the shape when a source is initializing. */ }
  }
  const polygon=source?.shape || source?.los;
  if (typeof polygon?.contains === 'function') return polygon.contains(point.x,point.y);
  return null;
}
/** Foundry V14 accepts arrays of target points and returns true if one is
 * visible. Test each sample independently, otherwise a visible corner reveals
 * an item whose center is in darkness. Older signatures are still supported. */
function sceneSeesPoint(visibility, point) {
  try { return Boolean(visibility.testVisibility([point], {tolerance:0})); }
  catch {
    try { return Boolean(visibility.testVisibility(point, {tolerance:0})); }
    catch {return false;}
  }
}
export function physicalItemVisible(record, {user,scene,visibility,tokens=[],actors=[],settings}={}) {
  const location=center(record);
  if (!location || !scene || !user?.id) return false;
  // GM omniscience is an explicit Buxa option. Default to enabled so even
  // controlling a token does not unexpectedly hide dropped items.
  if (user?.isGM && settings?.gmItemView !== false) return true;
  if (scene.tokenVision === false) return true;
  const points=pointsFor(location);
  const linked=linkedVisionSources(user,tokens,actors);
  // With the GM override disabled, a manually controlled token takes
  // precedence. Otherwise, use the GM's explicitly linked actor tokens.
  const selected=user?.isGM ? controlledVisionSources(tokens) : [];
  const sources=selected.length ? selected : linked;
  if (sources.length) {
    // All interior points must be visible. Union the eligible character
    // sources point by point to avoid revealing items through a fog edge.
    return points.every(point=>sources.some(token=>sourceSeesPoint(token,point)===true));
  }
  // An explicitly linked character with no active sight on this scene must
  // not fall back to a different character's view or a GM's visibility.
  const linkedActors=actors.some(actor=>{
    const users=actor?.getFlag?.('buxaframework','linkedUsers');
    return Array.isArray(users) && users.includes(user?.id);
  });
  if (user?.isGM || linkedActors) return false;
  // Compatibility for worlds without Buxa links: defer to Foundry's current
  // scene visibility, instead of making all existing items disappear.
  if (scene.tokenVision == null && visibility?.tokenVision === false) return true;
  if (typeof visibility?.testVisibility !== 'function') return false;
  return points.every(point=>sceneSeesPoint(visibility,point));
}
