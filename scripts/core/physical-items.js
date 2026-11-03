import { itemBoardImageOf } from "./item-board-image.js";
import { numericField } from './numeric-field.js';
import { readScenePartition } from './physical-scene-partitions.js';
/** Pure validation and geometry for physical scene items. Never mutate scene/actor documents here. */
export const PHYSICAL_FLAG = 'physicalItems';
export const PHYSICAL_SETTINGS = 'physicalItemSettings';
/** Scene-keyed persistent ground loot. Never a Scene/Actor embedded Document. */
export const PHYSICAL_SCENE_STORE = 'physicalSceneItems';
export const DEFAULT_PHYSICAL_SETTINGS = Object.freeze({
  lootEnabled: true,
  lootDistance: 10,
  playerMoveEnabled: false,
  moveDistance: 10,
  maxMoveDistance: 15,
  playerDropRangeEnabled: false,
  dropDistance: 10,
  showDropRangeOutline: true,
  visualMode: 'beam',
  alwaysShowLoot: false,
  gmItemView: true
});
const numeric = (value, fallback, min = 0, max = 10000) => {
  return numericField(value, fallback, min, max);
};
export function normalizePhysicalSettings(input) {
  const raw = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  return {
    lootEnabled: raw.lootEnabled !== false,
    lootDistance: numeric(raw.lootDistance, 10, 0, 10000),
    playerMoveEnabled: raw.playerMoveEnabled === true,
    moveDistance: numeric(raw.moveDistance, 10, 0, 10000),
    maxMoveDistance: numeric(raw.maxMoveDistance, 15, 0, 10000),
    playerDropRangeEnabled: raw.playerDropRangeEnabled === true,
    dropDistance: numeric(raw.dropDistance, 10, 0, 10000),
    showDropRangeOutline: raw.showDropRangeOutline !== false,
    visualMode: raw.visualMode === 'shadow' ? 'shadow' : 'beam',
    alwaysShowLoot: raw.alwaysShowLoot === true,
    gmItemView: raw.gmItemView !== false
  };
}
/** Read the authoritative world setting first. Old Scene flags remain a
 * read-only legacy source until the first write to this scene migrates them.
 * An explicitly saved [] must override legacy entries, including after reload. */
export function physicalSceneStore() {
  try {
    const value = globalThis.game?.settings?.get?.('buxaframework', PHYSICAL_SCENE_STORE);
    if(value && typeof value === 'object' && !Array.isArray(value))return value;
    if(globalThis.game?.settings?.settings?.has?.('buxaframework.'+PHYSICAL_SCENE_STORE))
      throw Error('Ground-item world storage returned an invalid value.');
    return {};
  } catch(error) {
    // Prior to init, a missing setting is expected. After registration an
    // unreadable live store must NEVER be mistaken for an empty world.
    if (globalThis.game?.settings?.settings?.has?.('buxaframework.'+PHYSICAL_SCENE_STORE))
      throw Error('Buxa ground-item storage cannot be read. Ask the GM to check the world setting.',{cause:error});
    return {};
  }
}
/** One schema for scene reads, diagnostics, and writes. In particular,
 * Number(null) and Number('') equal zero but are not valid canvas positions. */
export function validPhysicalSceneRecord(record) {
  const validCoordinate = value => {
    if(typeof value==='number') return Number.isFinite(value);
    if(typeof value!=='string') return false;
    const trimmed=value.trim();
    // Accept legacy decimal-string coordinates, not arrays/objects/booleans
    // that JavaScript Number() would silently convert into scene positions.
    return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(trimmed) &&
      Number.isFinite(Number(trimmed));
  };
  return Boolean(record && typeof record.id === 'string' && record.id.trim() &&
    record.data && typeof record.data === 'object' && !Array.isArray(record.data) &&
    [record.x,record.y].every(validCoordinate));
}

/** Stop scene writes or migrations if an older record would be silently
 * filtered out by the canvas-friendly scenePhysicalItems reader. Rendering
 * may omit broken entries; persistence must NEVER overwrite them with only
 * the visible subset. A GM can use diagnosePhysicalSceneItems to inspect the
 * original stored records and repair them deliberately. */
export function assertPhysicalSceneRecordsWritable(scene) {
  const id=scene?.id;
  if(!id)throw Error('A valid scene is required to save physical items.');
  const partition=readScenePartition(id);
  const legacy=physicalSceneStore();
  const records=partition?.initialized ? partition.records :
    Object.hasOwn(legacy,id) ? legacy[id] :
    (scene?.getFlag?.('buxaframework',PHYSICAL_FLAG) ??
      scene?.flags?.buxaframework?.[PHYSICAL_FLAG] ?? []);
  if(!Array.isArray(records))
    throw Error('Scene contains invalid physical item records. Nothing was overwritten; ask the GM to inspect saved scene items.');
  const ids=new Set();
  for(const record of records) {
    if(!validPhysicalSceneRecord(record) || ids.has(record.id))
      throw Error('Scene has malformed or duplicate physical items. Nothing was overwritten; ask the GM to inspect saved scene items.');
    ids.add(record.id);
  }
  return true;
}
/** Non-mutating repair diagnostic; never silently discard an ambiguous ID. */
export function diagnosePhysicalSceneItems(scene) {
  const id=scene?.id;
  const store=physicalSceneStore();
  const partition=id?readScenePartition(id):null;
  const raw=(partition?.initialized?partition.records:
    (id && Object.hasOwn(store,id)?store[id]:scene?.getFlag?.('buxaframework',PHYSICAL_FLAG)))??[];
  const duplicateIds=[],invalidIndices=[],seen=new Set();
  if(!Array.isArray(raw))return {sceneId:id,readable:false,duplicateIds,invalidIndices,recordCount:0};
  raw.forEach((record,index)=>{
    if(!validPhysicalSceneRecord(record))invalidIndices.push(index);
    if(record?.id){if(seen.has(record.id))duplicateIds.push(record.id);seen.add(record.id);}
  });
  return {sceneId:id,readable:true,duplicateIds:[...new Set(duplicateIds)],invalidIndices,recordCount:raw.length};
}
export function scenePhysicalItems(scene) {
  if (scene?.id) {
    const partition=readScenePartition(scene.id);
    if(partition?.initialized) return partition.records.filter(validPhysicalSceneRecord);
  }
  const store = physicalSceneStore();
  const id = scene?.id;
  const stored = id && Object.hasOwn(store, id) ? store[id] : undefined;
  const records = stored !== undefined ? stored
    : (scene?.getFlag?.('buxaframework', PHYSICAL_FLAG) ?? scene?.flags?.buxaframework?.[PHYSICAL_FLAG]);
  return Array.isArray(records) ? records.filter(validPhysicalSceneRecord) : [];
}
export function physicalQuantity(source) {
  const raw = Number(source?.quantity ?? source?.system?.quantity ?? source?.data?.system?.quantity ?? 1);
  return Number.isSafeInteger(raw) ? Math.max(0, raw) : 1;
}
export function validDropQuantity(amount, available) {
  return Number.isSafeInteger(amount) && amount >= 1 && amount <= available;
}
export function physicalDistanceFt(a, b, scene) {
  // An invalid token or scene coordinate must never satisfy a distance gate.
  // Comparing NaN > range is false and previously granted the interaction.
  const ax=Number(a?.x), ay=Number(a?.y), bx=Number(b?.x), by=Number(b?.y);
  if ([a?.x,a?.y,b?.x,b?.y].some(value=>value==null || value==='') ||
      ![ax,ay,bx,by].every(Number.isFinite)) return Infinity;
  const unit = numeric(scene?.grid?.distance, 5, 0.01);
  const cell = numeric(scene?.grid?.size, 100, 0.01);
  return Math.hypot(ax-bx, ay-by) / cell * unit;
}
function validSceneToken(token) {
  return Boolean(token && !token.hidden && !token.document?.hidden &&
    [token.x,token.y,token.width??1,token.height??1].every(value=>
      value!==null && value!=='' && Number.isFinite(Number(value))) &&
    Number(token.width??1)>0 && Number(token.height??1)>0);
}
export function nearestLinkedToken(user, scene, point, actors = [], tokens = []) {
  const linked = new Set(actors.filter(actor => {
    const ids = actor?.getFlag?.('buxaframework', 'linkedUsers');
    // Only explicit player links count. GM implicit ownership is not a link.
    return Array.isArray(ids) && ids.includes(user?.id);
  }).map(actor => actor.id));
  const eligible = tokens.filter(token => linked.has(token.actorId ?? token.actor?.id) && validSceneToken(token));
  const sorted = eligible.map(token => ({
    token, actorId: token.actorId ?? token.actor?.id,
    distance: physicalDistanceFt({x:Number(token.x) + Number(token.width ?? 1) * Number(scene?.grid?.size ?? 100)/2,
      y:Number(token.y) + Number(token.height ?? 1) * Number(scene?.grid?.size ?? 100)/2}, point, scene)
  })).filter(entry=>Number.isFinite(entry.distance)).sort((a,b)=>a.distance - b.distance);
  return sorted[0] ?? null;
}
export function canInteractPhysical({ user, scene, item, actors = [], tokens = [], settings, operation, destination }) {
  const policy = normalizePhysicalSettings(settings);
  if (operation === 'loot' && !policy.lootEnabled) return { allowed:false, reason:'Looting is disabled by the GM.' };
  if (operation === 'move' && !user?.isGM && !policy.playerMoveEnabled) return { allowed:false, reason:'Players cannot move physical items.' };
  if (operation === 'move' && !user?.isGM && destination &&
    physicalDistanceFt({x:item.x,y:item.y}, destination, scene) > policy.maxMoveDistance)
    return { allowed:false, reason:`The item cannot be moved more than ${policy.maxMoveDistance} ft.` };
  const candidate = nearestLinkedToken(user, scene, {x:Number(item.x) + Number(item.size ?? 80)/2,
    y:Number(item.y) + Number(item.size ?? 80)/2}, actors, tokens);
  if (user?.isGM && operation === 'move') return { allowed:true, candidate:null };
  if (!candidate) return { allowed:false, reason:'No explicitly linked character token is on this scene.' };
  const range = ['loot','open'].includes(operation) ? policy.lootDistance : policy.moveDistance;
  if (candidate.distance > range) return { allowed:false, reason:`Move your linked character within ${range} ft.` };
  return { allowed:true, candidate };
}
/** One source for drop distances AND the on-canvas radius. Points represent
 * the center of the dropped image, not its top-left. All lengths are scene
 * coordinates, so feet and the radius outline cannot disagree. */
export function physicalDropRange({user,actorId,scene,actors=[],tokens=[],settings}) {
  const policy=normalizePhysicalSettings(settings);
  const actor=actors.find(entry=>entry.id===actorId);
  const links=actor?.getFlag?.('buxaframework','linkedUsers');
  if(!user?.isGM && (!Array.isArray(links) || !links.includes(user?.id)))
    return {allowed:false,reason:'Link your character before dropping items with a distance limit.',centers:[]};
  const size=Number(scene?.grid?.size)||100;
  const centers=tokens.filter(token=>(token.actorId??token.actor?.id)===actorId && validSceneToken(token)).map(token=>({
    x:Number(token.x)+Number(token.width??1)*size/2,
    y:Number(token.y)+Number(token.height??1)*size/2
  }));
  if(!centers.length)return {allowed:false,reason:'Your linked character must be on this scene to drop items.',centers};
  return {allowed:true,centers,radius:policy.dropDistance / (Number(scene?.grid?.distance)||5)*size};
}
/** A board drop is anchored by its displayed center; stored scene items use
 * a top-left origin. Keep this conversion identical in preview and commit. */
/** Foundry scene coordinates include the padding around the background. The
 * playable rectangle begins at sceneX/sceneY, not necessarily at (0,0).
 * Scene.dimensions.sceneRect is authoritative on V14; fall back only for old
 * document mocks and scenes without derived dimensions. */
export function physicalSceneRect(scene) {
  const bounds=scene?.dimensions?.sceneRect ?? scene?.getDimensions?.()?.sceneRect;
  if (bounds && [bounds.x,bounds.y,bounds.width,bounds.height].every(Number.isFinite) &&
      bounds.width > 0 && bounds.height > 0)
    return {x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height};
  const width=Number(scene?.width),height=Number(scene?.height);
  return {x:0,y:0,width:Number.isFinite(width)&&width>0?width:0,
    height:Number.isFinite(height)&&height>0?height:0};
}
export function physicalDropArtworkOrigin(point,size,scene) {
  const half=Number(size)/2;
  const x=Number(point?.x)-half,y=Number(point?.y)-half;
  const bounds=physicalSceneRect(scene);
  const tolerance=1e-6;
  if(!Number.isFinite(x)||!Number.isFinite(y)||!(size>0) ||
      x<bounds.x-tolerance || y<bounds.y-tolerance ||
      x+size>bounds.x+bounds.width+tolerance || y+size>bounds.y+bounds.height+tolerance)return null;
  return {x:Math.round(x),y:Math.round(y)};
}
/** Validate a non-GM source Actor's proximity before creating a physical drop. */
export function canDropPhysical({user,actorId,scene,point,actors=[],tokens=[],settings}) {
  if (user?.isGM) return {allowed:true};
  const policy=normalizePhysicalSettings(settings);
  if (!policy.playerDropRangeEnabled) return {allowed:true};
  const range=physicalDropRange({user,actorId,scene,actors,tokens,settings:policy});
  if(!range.allowed)return range;
  const distance=Math.min(...range.centers.map(center=>physicalDistanceFt(center,point,scene)));
  if(distance>policy.dropDistance+1e-7)
    return {allowed:false,reason:`You must drop within ${policy.dropDistance} ft of your linked character.`};
  return {allowed:true};
}

export function normalizePhysicalArtwork(input, current={}) {
  const number=(value,fallback,min,max)=>{
    if (value==null || value==='') return fallback;
    const n=Number(value);
    return Number.isFinite(n) ? Math.min(max,Math.max(min,n)) : fallback;
  };
  return {
    x:Math.round(number(input?.x,Number(current.x)||0,-100000,100000)),
    y:Math.round(number(input?.y,Number(current.y)||0,-100000,100000)),
    size:Math.round(number(input?.size,Number(current.size)||76,20,800)),
    rotation:number(input?.rotation,Number(current.rotation)||0,-3600,3600)%360
  };
}

export function toPhysicalItem(item, quantity, point, size, id) {
  const data = structuredClone(item.toObject());
  delete data._id;
  delete data._stats;
  data.system ??= {};
  if ('quantity' in data.system) data.system.quantity = quantity;
  if ('equipped' in data.system) data.system.equipped = false;
  data.flags ??= {};
  data.flags.buxaframework ??= {};
  const instance = data.flags.buxaframework.itemInstance ??= {};
  if (!instance.originUuid && item?.uuid) instance.originUuid = item.uuid;
  instance.instanceId = id;
  const image=itemBoardImageOf(data);
  return { id, x:Math.round(point.x), y:Math.round(point.y), size:image.size, rotation:image.rotation, opacity:image.opacity, quantity, data };
}
export function physicalDestination(point, canvas) {
  const size = numeric(canvas?.grid?.size, numeric(canvas?.scene?.grid?.size,100,1),1);
  const x = Number(point?.x), y = Number(point?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const bounds=physicalSceneRect(canvas?.scene);
  if (x < bounds.x || y < bounds.y ||
      x > bounds.x+bounds.width || y > bounds.y+bounds.height) return null;
  return { x, y, size:Math.round(size * 0.76) };
}

/** Individual ground items can act as fixed world containers. */
export function groundItemLootDisabled(entry) {
  return entry?.data?.flags?.buxaframework?.item?.disableLooting === true;
}
export function groundItemStorageSpecs(entry) {
  return Array.isArray(entry?.data?.flags?.buxaframework?.item?.storage?.slots?.external)
    ? entry.data.flags.buxaframework.item.storage.slots.external : [];
}
