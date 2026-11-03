/** Portable ground-container placement and nested content transformations.
 * All helpers are pure; callers perform serialized, confirmed world writes. */
import { normalizeItemStorage, fitsExternalStorage } from './item-storage.js';
import { normalizeItemShape } from './inventory-shapes.js';
import { createGroundFootprintChecker } from './ground-footprint-checker.js';
import { getPackedContents, attachPackedContents, stripPackedContents } from './backpack-transfers.js';
import { MODULE_ID } from './constants.js';
import { safeGridIndex } from './numeric-field.js';

export function groundCompartments(record) {
  const raw=record?.data?.flags?.[MODULE_ID]?.item?.storage;
  const inherited = record?.data?.flags?.[MODULE_ID]?.portableStorageMode === 'simple' ? 'simple' : 'complex';
  return normalizeItemStorage(raw).slots.external.map(c=>({...c,storageId:`root:${c.id}`,providerId:'root',
    itemMode:c.itemMode==='inherit'?inherited:c.itemMode}));
}
export function groundDirectItems(record) {
  return getPackedContents(record?.data).filter(e=>e.providerId==='root');
}
export function groundContentBranch(contents, sourceId) {
  // Index once rather than scanning every entry on each nesting level.
  const children=new Map();
  for(const entry of contents){
    const siblings=children.get(entry.providerId)||[];
    siblings.push(entry.sourceId);
    children.set(entry.providerId,siblings);
  }
  const ids=new Set(),queue=[sourceId];
  for(let cursor=0;cursor<queue.length;cursor++) {
    const id=queue[cursor];
    if(ids.has(id))continue;
    ids.add(id);
    for(const child of children.get(id)||[])if(!ids.has(child))queue.push(child);
  }
  return contents.filter(entry=>ids.has(entry.sourceId));
}
/** A single occupancy source for display, pointer previews and GM writes.
 * Items saved in cells removed by the storage editor (or overlapping a valid
 * item) are recoverable, but must not occupy phantom grid cells. */
export function classifyGroundPlacements(compartments, contents) {
  const bags=new Map((compartments||[]).map(bag=>[bag.id,bag]));
  const placements={},shapes={},valid=[],unplaced=[],seen=new Set();
  for(const entry of contents||[]) {
    const bag=bags.get(entry?.compartmentId);
    const id=entry?.sourceId;
    const index=entry?.index;
    const rotation=safeGridIndex(entry?.rotation??0,4);
    if(!bag || typeof id!=='string' || !id || seen.has(id) ||
       !Number.isSafeInteger(index) || index<0 || rotation===null) {
      unplaced.push(entry);continue;
    }
    seen.add(id);
    shapes[id]=normalizeItemShape(entry?.data?.flags?.[MODULE_ID]?.item?.shape);
    // The scanner consumes only earlier valid records. Invalid legacy items
    // remain stored for recovery, but cannot block genuine free cells.
    if(!fitsExternalStorage(bag,placements,shapes,id,index,rotation)) {
      unplaced.push(entry);continue;
    }
    placements[id]={area:'storage',storageId:bag.storageId,index,rotation};
    valid.push(entry);
  }
  return {valid,unplaced,placements,shapes};
}

/** Build a read-only occupancy snapshot once for an entire pointer drag.
 * Do not clone/serialize the entire packed bundle at every hovered cell.
 * Every write still revalidates against current authoritative contents. */
export function groundPlacementChecker(record, itemData, movingContentId=null) {
  const contents=getPackedContents(record.data);
  validateGroundChildBundle(contents);
  const moving=movingContentId?contents.find(e=>e.sourceId===movingContentId && e.providerId==='root'):null;
  if(movingContentId && !moving)throw Error('Item is no longer in this container.');
  const bags=groundCompartments(record);
  const neighbors=contents.filter(e=>e.providerId==='root' && e.sourceId!==movingContentId);
  const classified=classifyGroundPlacements(bags,neighbors);
  return createGroundFootprintChecker(bags,classified.placements,classified.shapes,
    moving?.data||itemData,movingContentId||'new');
}

export function groundPlacement(record, itemData, storageId, rotation=0, preferred=0) {
  const compartments=groundCompartments(record);
  const bag=compartments.find(c=>c.storageId===storageId);
  if(!bag)return null;
  const bundle=getPackedContents(record.data);
  validateGroundChildBundle(bundle);
  const children=bundle.filter(entry=>entry.providerId==='root');
  const {placements,shapes}=classifyGroundPlacements(compartments,children);
  shapes['new']=normalizeItemShape(itemData?.flags?.[MODULE_ID]?.item?.shape);
  const max=bag.columns*bag.rows;
  // Normalize the preferred origin before iterating every cell exactly once.
  // Negative/off-grid inputs must not skip the final valid slot.
  const requested=Number(preferred);
  const first=Number.isSafeInteger(requested) && max>0 ? ((requested%max)+max)%max : 0;
  for(let offset=0;offset<max;offset++){
    const i=(first+offset)%max;
    if(fitsExternalStorage(bag,placements,shapes,'new',i,rotation))return i;
  }
  return null;
}

/** Only automatic (non-cell-targeted) transfers may rotate to find space.
 * Return rotation alongside the exact index so preview and save cannot drift. */
export function groundAutoPlacement(record,itemData,storageId,{rotation=0,preferred=0}={}) {
  const start=((Math.trunc(Number(rotation)||0)%4)+4)%4;
  for(let turn=0;turn<4;turn++){
    const nextRotation=(start+turn)%4;
    const index=groundPlacement(record,itemData,storageId,nextRotation,preferred);
    if(index!==null)return {index,rotation:nextRotation};
  }
  return null;
}
/** Resolve a ground-container destination once, preserving explicit cell drops.
 * Without a cell, search free space and orientations (and all compartments
 * when no compartment was specified), then commit exactly that result. */
export function groundDropDestination(record,itemData,{storageId=null,index=null,rotation=0}={}) {
  const bags=groundCompartments(record).filter(bag=>!storageId || bag.storageId===storageId);
  if(index!==null && index!==undefined) {
    if (!(typeof index === 'number' || (typeof index === 'string' && index.trim() !== '')) ||
        !Number.isSafeInteger(Number(index)) || !Number.isInteger(rotation) || rotation<0 || rotation>3) return null;
    const requested=Number(index);
    // When the caller omitted a compartment, the same cell may be legal in a
    // later compartment even if the first one is full or masked out.
    for (const bag of bags) if (groundPlacement(record,itemData,bag.storageId,rotation,requested)===requested)
      return {storageId:bag.storageId,index:requested,rotation};
    return null;
  }
  for(const bag of bags) {
    const found=groundAutoPlacement(record,itemData,bag.storageId,{rotation});
    if(found)return {storageId:bag.storageId,...found};
  }
  return null;
}

/** Validate portable nested children before assigning fresh scene identities.
 * Duplicate IDs, a missing parent and cycles must not silently be persisted. */
export function validateGroundChildBundle(contents) {
  if (!Array.isArray(contents) || contents.length>250) throw Error('Invalid nested container item count.');
  const byId=new Map();
  for (const entry of contents) {
    if (!entry || typeof entry.sourceId!=='string' || !entry.sourceId ||
        typeof entry.providerId!=='string' || !entry.providerId ||
        typeof entry.compartmentId!=='string' || !/^[a-zA-Z0-9_-]{1,48}$/.test(entry.compartmentId) ||
        !Number.isSafeInteger(entry.index) || entry.index<0 ||
        !Number.isInteger(Number(entry.rotation??0)) || Number(entry.rotation??0)<0 || Number(entry.rotation??0)>3 || !entry.data || typeof entry.data!=='object')
      throw Error('Invalid nested container placement metadata.');
    if(byId.has(entry.sourceId) || entry.sourceId==='root')
      throw Error('Duplicate nested container item identity.');
    byId.set(entry.sourceId,entry);
  }
  // Cache every resolved ancestry chain. Previously an ordered 250-deep bundle
  // walked the same ancestors for each child (quadratic read cost).
  const resolved = new Set();
  for (const entry of contents) {
    const seen = new Set();
    let parent = entry.sourceId;
    while (parent !== 'root' && !resolved.has(parent)) {
      if (seen.has(parent)) throw Error('Circular nested container placement.');
      seen.add(parent);
      const owner = byId.get(parent);
      if (!owner) throw Error('A nested container is missing its parent.');
      parent = owner.providerId;
    }
    for (const id of seen) resolved.add(id);
  }
  return true;
}
export function groundAddBranch(record, itemData, childBundle=[], storageId, index, rotation, makeId) {
  validateGroundChildBundle(childBundle);
  const compartments=groundCompartments(record);
  const bag=compartments.find(c=>c.storageId===storageId);
  if(!bag || !Number.isSafeInteger(index) || !Number.isInteger(rotation) || rotation<0 || rotation>3 ||
     groundPlacement(record,itemData,storageId,rotation,index)!==index)
    throw Error('Item does not fit in this chest compartment.');
  const current=getPackedContents(record.data);
  validateGroundChildBundle(current);
  if(current.length+childBundle.length+1>250)throw Error('Container item limit reached.');
  const ids=new Map();const rootId=makeId();
  const used=new Set(current.map(entry=>entry.sourceId));
  if(typeof rootId!=='string' || !rootId || rootId==='root' || used.has(rootId))throw Error('Could not assign a unique container item ID.');
  used.add(rootId);
  for(const entry of childBundle) {
    const fresh=makeId();
    if(typeof fresh!=='string' || !fresh || fresh==='root' || used.has(fresh))throw Error('Could not assign unique nested item IDs.');
    used.add(fresh);ids.set(entry.sourceId,fresh);
  }
  const root={sourceId:rootId,providerId:'root',compartmentId:bag.id,index,rotation,data:structuredClone(itemData)};
  const descendants=childBundle.map(e=>({...structuredClone(e),sourceId:ids.get(e.sourceId),
    providerId:e.providerId==='root'?rootId:ids.get(e.providerId)}));
  if(descendants.some(e=>!e.providerId))throw Error('Invalid nested container ancestry.');
  return {...record,data:attachPackedContents(record.data,[...current,root,...descendants])};
}
export function groundRemoveBranch(record,sourceId) {
  const contents=getPackedContents(record.data);
  validateGroundChildBundle(contents);
  const target=contents.find(e=>e.sourceId===sourceId&&e.providerId==='root');
  if(!target)throw Error('This chest item is no longer present.');
  const branch=groundContentBranch(contents,sourceId);
  const excluded=new Set(branch.map(e=>e.sourceId));
  const next={...record,data:structuredClone(record.data)};
  next.data.flags ??={};next.data.flags[MODULE_ID] ??={};
  next.data.flags[MODULE_ID].backpackContents=contents.filter(c=>!excluded.has(c.sourceId));
  const remapped=branch.filter(c=>c.sourceId!==sourceId).map(c=>({...c,providerId:c.providerId===sourceId?'root':c.providerId}));
  return {next,data:attachPackedContents(target.data,remapped),target};
}

/** Reposition a stored item without changing identity or nested descendants. */
export function groundMoveWithin(record,sourceId,storageId,index,rotation=0) {
  const checker=groundPlacementChecker(record,null,sourceId);
  if(!checker.fits(storageId,index,rotation))throw Error('Item does not fit at that position.');
  const contents=getPackedContents(record.data);
  const bag=groundCompartments(record).find(c=>c.storageId===storageId);
  const moved=contents.map(e=>e.sourceId===sourceId && e.providerId==='root'
    ? {...e,compartmentId:bag.id,index,rotation} : e);
  return {...record,data:attachPackedContents(record.data,moved)};
}
