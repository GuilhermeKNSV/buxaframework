/** Portable, exact-geometry backpack contents. Item documents belong to an
 * Actor, not to a Scene: when a backpack leaves an Actor, its contained Items
 * and their compartment coordinates travel as a value-only payload on the
 * backpack's Buxa flags. Never recreate a child without confirming the source
 * transfer, and never reinterpret a storage cell as a main inventory cell. */
import { MODULE_ID } from './constants.js';
import { writeBackpackInventory } from './actor-inventory-transaction-write.js';
import { getInventoryState, getActorStorage, getEffectiveInventoryConfig } from './inventory.js';
import { nearestExternalStoragePlacement } from './external-storage-placement.js';
import { normalizeItemShape, firstFitShape } from './inventory-shapes.js';
import { fitsExternalStorage } from './item-storage.js';
import { canEquipItem } from './item-runtime.js';
import { nearestExternalComplexPlacement } from './external-item-placement.js';

export const PACKED_CONTENTS_KEY = 'backpackContents';
/** Snapshot Follow Inventory occupancy for a portable backpack. Its Item
 * configuration stays 'inherit', but the ground has no Actor inventory mode
 * and must not reinterpret an already packed one-cell-per-item arrangement. */
export function preservePortableStorageMode(itemData, config) {
  const specs = itemData?.flags?.[MODULE_ID]?.item?.storage?.slots?.external;
  if (!Array.isArray(specs) || !specs.length) return itemData;
  const flags = itemData.flags[MODULE_ID];
  flags.portableStorageMode = config?.inventory?.mode === 'simple' ? 'simple' : 'complex';
  return itemData;
}

const clone = value => structuredClone(value);
const storageParent = placement => placement?.area==='storage'
  ? String(placement.storageId||'').split(':')[0] : null;
const slotSuffix = (id, parent) => String(id||'').slice(`${parent}:`.length);

/** Capture only the descendants of this specific container, recursively.
 * Reject stale/corrupt placements; silently discarding one would lose items. */
export function captureBackpackContents(actor, backpackId, config) {
  const raw=actor.getFlag?.(MODULE_ID,'inventory')?.placements ?? {};
  const validated=getInventoryState(actor,config).placements;
  const found=[];
  const visited=new Set([backpackId]);
  // One provider index replaces the previous O(depth × Actor.items) scans.
  const children=new Map();
  for(const item of [...(actor.items??[])]){
    const parent=storageParent(raw[item.id]);
    if(parent){const list=children.get(parent)||[];list.push(item);children.set(parent,list);}
  }
  function visit(provider) {
    for(const item of children.get(provider)||[]) {
      const placement=raw[item.id];
      if(visited.has(item.id)) throw Error('This backpack has a circular container placement.');
      if(!validated[item.id] || validated[item.id].area!=='storage' ||
        validated[item.id].storageId!==placement.storageId ||
        Number(validated[item.id].index)!==Number(placement.index) ||
        Number(validated[item.id].rotation||0)!==Number(placement.rotation||0))
        throw Error(`Cannot move backpack: placement of ${item.name||'a contained item'} needs repair.`);
      const compartmentId=slotSuffix(placement.storageId,provider);
      if(!compartmentId)throw Error('A contained item has no compartment identifier.');
      visited.add(item.id);
      const data=clone(item.toObject());
      delete data._id;delete data._stats;
      found.push({sourceId:item.id,providerId:provider===backpackId?'root':provider,compartmentId,
        index:Number(placement.index),rotation:Number(placement.rotation||0),data});
      if(found.length>250)throw Error('Backpack contains too many items to transfer safely.');
      visit(item.id);
    }
  }
  visit(backpackId);
  // A deleted Item may leave behind an obsolete placement in Actor flags.
  // Such a record is NOT a contained item: there is no Item document to pack,
  // and blocking the drop would permanently trap a genuinely empty backpack.
  // Existing Item documents are still checked strictly below so corrupted
  // ancestry never silently discards a real item during a transfer.
  for(const [id,placement] of Object.entries(raw)) {
    if(visited.has(id) || !actor.items?.get?.(id))continue;
    let parent=storageParent(placement),steps=0;
    const seen=new Set();
    while(parent && steps++<260 && !seen.has(parent)) {
      if(parent===backpackId)throw Error('Backpack contains an item that could not be safely packed.');
      seen.add(parent);
      parent=storageParent(raw[parent]);
    }
  }
  return found;
}

/** Repair legacy, still-owned backpack descendants BEFORE packing them.
 * Earlier builds could leave a child's old storage flag pointing at a cell
 * rejected by the Actor grid. Repair only that child, inside the very same
 * compartment; never silently drop it from the portable bundle. */
export async function repairBackpackPlacements(actor, backpackId, config) {
  const raw=clone(actor.getFlag?.(MODULE_ID,'inventory')||{});
  const original=clone(raw);
  const positions=raw.placements||{};
  const byId=new Map([...(actor.items??[])].map(item=>[item.id,item]));
  const targets=[];
  for(const [id,position] of Object.entries(positions)) {
    if(!byId.has(id) || position?.area!=='storage')continue;
    let parent=storageParent(position);
    const seen=new Set([id]);
    while(parent && !seen.has(parent)) {
      if(parent===backpackId){targets.push(id);break;}
      seen.add(parent);parent=storageParent(positions[parent]);
    }
    if(parent && seen.has(parent) && parent!==backpackId)
      throw Error('Cannot transfer a backpack containing a circular placement.');
  }
  if(!targets.length)return 0;
  const bags=new Map(getActorStorage(actor,config).compartments.map(bag=>[bag.storageId,bag]));
  const shapes=Object.fromEntries([...byId].map(([id,item])=>[
    id,normalizeItemShape(item.getFlag?.(MODULE_ID,'item')?.shape)]));
  let accepted={...getInventoryState(actor,config).placements};
  let repaired=0;
  for(const id of targets) {
    const wanted=positions[id],actual=accepted[id];
    if(actual?.area==='storage' && actual.storageId===wanted.storageId &&
       actual.index===Number(wanted.index) && Number(actual.rotation||0)===Number(wanted.rotation||0))continue;
    const bag=bags.get(wanted.storageId);
    if(!bag)throw Error(`Cannot move backpack: the original compartment for ${byId.get(id)?.name||'an item'} no longer exists.`);
    const max=bag.columns*bag.rows;
    const start=Math.max(0,Math.min(max-1,Number(wanted.index)||0));
    const originalRotation=((Number(wanted.rotation)||0)%4+4)%4;
    let found=null;
    for(let turn=0;turn<4;turn++) {
      const rotation=(originalRotation+turn)%4;
      const index=nearestExternalStoragePlacement({compartment:bag,placements:accepted,
        shapes,itemId:id,requestedIndex:start,rotation});
      if(index!==null){found={area:'storage',storageId:wanted.storageId,index,rotation};break;}
    }
    if(!found)throw Error(`Cannot move backpack: ${byId.get(id)?.name||'a stored item'} cannot fit inside its original compartment. No items were transferred.`);
    positions[id]=found;
    accepted[id]=found;
    repaired++;
  }
  if(!repaired)return 0;
  await writeBackpackInventory(actor,raw,{[`${MODULE_ID}.physicalTransfer`]:true});
  const state=getInventoryState(actor,config).placements;
  if(targets.some(id=>{
    const wanted=positions[id],got=state[id];
    return !got || got.area!=='storage' || got.storageId!==wanted.storageId ||
      got.index!==wanted.index || Number(got.rotation||0)!==Number(wanted.rotation||0);
  })) {
    try {
      await writeBackpackInventory(actor,original,{[`${MODULE_ID}.physicalTransfer`]:true});
    } catch(rollbackError) {
      throw Error('Backpack repair failed and original placements could not be restored. Ask the GM to inspect this Actor before another transfer.', {cause:rollbackError});
    }
    throw Error('Backpack placement repair could not be confirmed. Original placements were restored.');
  }
  return repaired;
}

export function attachPackedContents(data, contents) {
  const result=clone(data);
  if(contents?.length){
    result.flags ??={};result.flags[MODULE_ID] ??={};
    result.flags[MODULE_ID][PACKED_CONTENTS_KEY]=clone(contents);
  }
  return result;
}
/** Capacity/validation checks shouldn't clone every child's full Item snapshot. */
export function packedContentsCount(data) {
  const contents=data?.flags?.[MODULE_ID]?.[PACKED_CONTENTS_KEY];
  if(contents != null && !Array.isArray(contents))
    throw Error('Backpack contents metadata is corrupt. Contents were not modified.');
  return contents?.length??0;
}
export function getPackedContents(data) {
  const value=data?.flags?.[MODULE_ID]?.[PACKED_CONTENTS_KEY];
  if(value != null && !Array.isArray(value))
    throw Error('Backpack contents metadata is corrupt. Contents were not modified.');
  return Array.isArray(value)?clone(value):[];
}
export function stripPackedContents(data) {
  const result=clone(data);
  if(result.flags?.[MODULE_ID])delete result.flags[MODULE_ID][PACKED_CONTENTS_KEY];
  return result;
}

/** A portable container must be committed as ONE Actor inventory transaction.
 * Pre-stage its root AND child placement metadata while no new Actor Item
 * exists. Foundry V14 can reject Actor updates after creating the root Item,
 * even when the child Item documents have not been created yet. */
export async function createPackedActorBackpack(actor, itemData, contents, config, destination=null, options={}) {
  const rootId=foundry.utils.randomID();
  const data=stripPackedContents(itemData);
  data._id=rootId;
  const state=getInventoryState(actor,config);
  const inventory=getEffectiveInventoryConfig(actor,config);
  const shapes=Object.fromEntries([...(actor.items??[])].map(item=>
    [item.id,normalizeItemShape(item.getFlag?.(MODULE_ID,'item')?.shape)]));
  shapes[rootId]=normalizeItemShape(data.flags?.[MODULE_ID]?.item?.shape);
  let placement;
  if(!destination || destination.area==='inventory') {
    const rotation=Number(destination?.rotation||0);
    if(inventory.mode==='complex') {
      const requested=destination?.index;
      const index=requested==null
        ? firstFitShape(state.placements,shapes,rootId,rotation,inventory.complex)
        : nearestExternalComplexPlacement({placements:state.placements,shapes,itemId:rootId,
            requestedIndex:requested,rotation,grid:inventory.complex});
      if(index===null || (destination?.strict && index!==requested))
        throw Error('Inventory has no space for the chest. It remains on the board.');
      placement={area:'inventory',index,rotation};
    } else {
      const occupied=new Set(Object.values(state.placements).filter(p=>p?.area==='inventory').map(p=>Number(p.index)));
      const index=destination?.index==null
        ? Array.from({length:inventory.slots},(_,i)=>i).find(i=>!occupied.has(i))
        : Number(destination.index);
      if(!Number.isInteger(index)||index<0||index>=inventory.slots||occupied.has(index))
        throw Error('Inventory has no space for the chest. It remains on the board.');
      placement={area:'inventory',index};
    }
  } else if(destination.area==='storage') {
    const compartment=getActorStorage(actor,config).compartments.find(e=>e.storageId===destination.storageId);
    const rotation=Number(destination.rotation||0);
    const requested=Number(destination.index||0);
    let index=destination.auto ? nearestExternalStoragePlacement({compartment,
      placements:state.placements,shapes,itemId:rootId,requestedIndex:0,rotation}) : requested;
    if(index===null || !fitsExternalStorage(compartment,state.placements,shapes,rootId,index,rotation))
      throw Error('The destination storage has no space for this chest.');
    placement={area:'storage',storageId:destination.storageId,index,rotation};
  } else if(destination.area==='equipment') {
    const slot=inventory.equipmentLayout.slots.find(e=>e.id===String(destination.slotId||''));
    const item={name:data.name,type:data.type,flags:data.flags,
      getFlag:(scope,key)=>data.flags?.[scope]?.[key]};
    const canEquip=slot && canEquipItem(actor,item,slot,config);
    if(!canEquip?.ok)throw Error(canEquip?.reason||'Invalid equipment slot for the chest.');
    placement={area:'equipment',slotId:String(destination.slotId),position:Number(destination.position||0)};
  } else throw Error('Invalid destination for a filled container.');
  await restoreBackpackContents(actor,rootId,contents,config,{...options,
    precreateRoot:{data,placement}});
  const result=actor.items?.get?.(rootId);
  if(!result)throw Error('The chest was not confirmed after its contents were restored.');
  return result;
}

/** Restore the same cell indices and rotations, remapping source document IDs
 * to the newly created Actor embedded Item IDs. No auto-packing is allowed. */
/** Plan the child documents and occupied cells before writing any Item documents.
 * In Foundry V14 an Actor update after an embedded-item create can fail when
 * the Actor update backend resolves its parent as another Actor. The incoming
 * payload is immutable, so reserve IDs and validate on a projected Actor,
 * persist placements first, then create the matching embedded Items by ID. */
export async function restoreBackpackContents(actor, rootId, contents, config, options={}) {
  if(!Array.isArray(contents) || !contents.length)return [];
  if(contents.length>250)throw Error('Invalid backpack contents.');
  const precreateRoot=options.precreateRoot ?? null;
  // An embedded Item operation can add a `parent` or `pack` field to its
  // options object. Those must never reach an Actor.update or a later Item
  // operation; Foundry otherwise attempts Actor-within-Actor updates.
  const writeOptions={...options};
  delete writeOptions.precreateRoot;
  delete writeOptions.parent;
  delete writeOptions.pack;
  const original=clone(actor.getFlag?.(MODULE_ID,'inventory') || {});
  const originalIds=new Set([...(actor.items??[])].map(item=>item.id));
  const identities=new Set();
  const bySource=new Map(),ids=new Map([['root',rootId]]),depths=new Map();
  const planned=[];
  let placementsCommitted=false;
  try {
    for(const entry of contents) {
      if(!entry?.sourceId || !entry?.providerId || bySource.has(entry.sourceId) ||
        !/^[a-zA-Z0-9_-]{1,48}$/.test(String(entry.compartmentId||'')) ||
        !Number.isInteger(entry.index) || entry.index<0 ||
        !Number.isInteger(Number(entry.rotation??0)) ||
        Number(entry.rotation??0)<0 || Number(entry.rotation??0)>3 ||
        !entry.data || typeof entry.data!=='object')
        throw Error('Invalid backpack contents metadata.');
      bySource.set(entry.sourceId,entry);
    }
    function depth(id,visiting=new Set()) {
      if(depths.has(id))return depths.get(id);
      if(visiting.has(id))throw Error('Circular backpack contents are not valid.');
      const entry=bySource.get(id);
      if(!entry)throw Error('A nested backpack parent is missing.');
      visiting.add(id);
      const value=entry.providerId==='root'?0:1+depth(entry.providerId,visiting);
      visiting.delete(id);depths.set(id,value);return value;
    }
    for(const id of bySource.keys())depth(id);
    // Keep IDs are chosen before the Actor flag write so every storageId
    // points at the same real embedded Item which Foundry will create.
    const reserved=new Set([...originalIds,rootId]);
    const ordered=[...bySource.values()].sort((x,y)=>depths.get(x.sourceId)-depths.get(y.sourceId));
    for(const entry of ordered) {
      let id;
      do {id=foundry.utils.randomID();} while(reserved.has(id));
      reserved.add(id);ids.set(entry.sourceId,id);
      const data=stripPackedContents(entry.data);
      delete data._stats;
      data._id=id;
      data.system ??={};
      if('equipped' in data.system)data.system.equipped=false;
      data.flags ??={};data.flags[MODULE_ID] ??={};
      const instanceId=foundry.utils.randomID(20);
      identities.add(instanceId);
      data.flags[MODULE_ID].itemInstance={...(data.flags[MODULE_ID].itemInstance||{}),version:1,instanceId};
      const parentId=entry.providerId==='root'?rootId:ids.get(entry.providerId);
      if(!parentId)throw Error('A nested backpack parent is missing.');
      planned.push({id,data,entry,depth:depths.get(entry.sourceId),placement:{area:'storage',
        storageId:`${parentId}:${entry.compartmentId}`,index:entry.index,rotation:Number(entry.rotation??0)}});
    }
    const raw=clone(original);
    raw.version=4;
    raw.tracked=[...new Set([...(raw.tracked||[]),rootId,...planned.map(e=>e.id)])];
    raw.placements={...(raw.placements||{})};
    if(precreateRoot)raw.placements[rootId]=clone(precreateRoot.placement);
    for(const child of planned)raw.placements[child.id]=child.placement;
    raw.autoSort=false;
    // Virtual read-only Item documents expose exactly the fields our normal
    // inventory/storage geometry readers need. No Foundry database call yet.
    const projectedItems=new Map([...(actor.items??[])].map(item=>[item.id,item]));
    if(precreateRoot)projectedItems.set(rootId,{
      id:rootId,name:precreateRoot.data.name,img:precreateRoot.data.img,type:precreateRoot.data.type,
      system:precreateRoot.data.system,flags:precreateRoot.data.flags,
      getFlag:(scope,key)=>precreateRoot.data.flags?.[scope]?.[key]});
    for(const child of planned) projectedItems.set(child.id,{
      id:child.id,name:child.data.name,img:child.data.img,type:child.data.type,
      system:child.data.system,flags:child.data.flags,
      getFlag:(scope,key)=>child.data.flags?.[scope]?.[key]
    });
    const projectedActor={...actor,items:{get:id=>projectedItems.get(id),
      [Symbol.iterator]:()=>projectedItems.values()},getFlag:(scope,key)=>
      scope===MODULE_ID && key==='inventory'?raw:actor.getFlag?.(scope,key)};
    const placements=()=>getInventoryState(projectedActor,config).placements;
    const same=(actual,wanted)=>Boolean(actual?.area==='storage' &&
      actual.storageId===wanted.storageId && actual.index===wanted.index &&
      Number(actual.rotation||0)===Number(wanted.rotation||0));
    let accepted=placements();
    if(precreateRoot) {
      const desired=precreateRoot.placement, actual=accepted[rootId];
      if(!actual || actual.area!==desired.area ||
          (desired.area==='inventory' && (actual.index!==desired.index || Number(actual.rotation||0)!==Number(desired.rotation||0))) ||
          (desired.area==='storage' && (actual.storageId!==desired.storageId || actual.index!==desired.index)) ||
          (desired.area==='equipment' && (actual.slotId!==desired.slotId || actual.position!==desired.position)))
        throw Error('Chest cannot be placed in the requested inventory slot. The source is unchanged.');
    }
    let repaired=0;
    const bags=new Map(getActorStorage(projectedActor,config,raw).compartments.map(b=>[b.storageId,b]));
    const shapes=Object.fromEntries([...projectedItems].map(([id,item])=>[
      id,normalizeItemShape(item.getFlag?.(MODULE_ID,'item')?.shape)]));
    for(const child of planned) {
      if(same(accepted[child.id],raw.placements[child.id]))continue;
      const bag=bags.get(child.placement.storageId);
      if(!bag)throw Error('Backpack storage is missing. The chest is unchanged.');
      let replacement=null;
      for(let turn=0;turn<4;turn++) {
        const rotation=(child.placement.rotation+turn)%4;
        const index=nearestExternalStoragePlacement({compartment:bag,placements:accepted,
          shapes,itemId:child.id,requestedIndex:Math.min(bag.columns*bag.rows-1,child.placement.index),rotation});
        if(index!==null){replacement={...child.placement,index,rotation};break;}
      }
      if(!replacement)throw Error(`Cannot pick up backpack: ${child.data.name||'contained item'} cannot fit inside its original compartment. The chest is unchanged.`);
      child.placement=replacement;
      raw.placements[child.id]=replacement;
      accepted=placements();repaired++;
    }
    if(planned.some(child=>!same(placements()[child.id],child.placement)))
      throw Error('Backpack contents could not be positioned safely. The chest is unchanged.');
    // CRITICAL: Save placement flags BEFORE any child is created. The old
    // implementation did this after createEmbeddedDocuments and failed in
    // Foundry V14 (Actor is not a valid embedded Document within Actor).
    if(precreateRoot) {
      // Using the same Actor.update path as ordinary inventory movements,
      // *before* creating even the container's root Item, prevents Foundry V14
      // from treating the world Actor as an embedded Actor.
      await actor.update({[`flags.${MODULE_ID}.inventory`]:raw},
        {...writeOptions,[`${MODULE_ID}.physicalTransfer`]:true});
      const saved=actor.getFlag?.(MODULE_ID,'inventory');
      if(!saved || !planned.every(child=>
        saved.placements?.[child.id]?.storageId===child.placement.storageId &&
        saved.placements?.[child.id]?.index===child.placement.index))
        throw Error('The Actor did not confirm the prepared chest placements.');
    } else {
      await writeBackpackInventory(actor,raw,
        {...writeOptions,[`${MODULE_ID}.physicalTransfer`]:true});
    }
    placementsCommitted=true;
    if(precreateRoot) {
      const created=await actor.createEmbeddedDocuments('Item',[precreateRoot.data],
        {...writeOptions,keepId:true,[`${MODULE_ID}.physicalTransfer`]:true});
      if(!created?.length || !actor.items?.get?.(rootId))
        throw Error('The chest was not created with its reserved Item ID.');
    }
    for(const level of [...new Set(planned.map(e=>e.depth))].sort((a,b)=>a-b)) {
      const wave=planned.filter(e=>e.depth===level);
      const result=await actor.createEmbeddedDocuments('Item',wave.map(e=>e.data),
        {...writeOptions,keepId:true,[`${MODULE_ID}.physicalTransfer`]:true});
      if(!Array.isArray(result) || result.length!==wave.length ||
        wave.some(child=>!actor.items?.get?.(child.id)))
        throw Error('Contained item creation did not preserve its reserved IDs. The chest is unchanged.');
    }
    const saved=getInventoryState(actor,config).placements;
    if(planned.some(child=>!same(saved[child.id],child.placement)))
      throw Error('Backpack contents were not restored to their original compartment. The chest is unchanged.');
    if(repaired) {
      console.warn(`${MODULE_ID} | Repaired ${repaired} backpack placement(s) while picking up closed storage.`);
      globalThis.ui?.notifications?.warn?.(`Backpack recovered: ${repaired} item(s) were repositioned inside their original storage.`);
    }
    return planned.map(e=>e.id);
  } catch(error) {
    // Roll back child documents first. A hook can throw after successful
    // persistence, so only match this transfer's unique instance identities.
    const created=[...(actor.items??[])].filter(item=>!originalIds.has(item.id) &&
      (item.id===rootId && precreateRoot ||
      identities.has(item.getFlag?.(MODULE_ID,'itemInstance')?.instanceId ??
        item.flags?.[MODULE_ID]?.itemInstance?.instanceId))).map(item=>item.id);
    if(created.length) {
      try {await actor.deleteEmbeddedDocuments('Item',created,writeOptions);}
      catch(rollback) {
        if(created.some(id=>actor.items?.get?.(id)))
          throw Error('Backpack child cleanup failed; ask the GM to inspect the inventory before retrying.',{cause:error});
      }
    }
    // If the write itself threw after persistence, we must also restore flags.
    // No child documents remain now, so Actor.update will not hit the failing
    // post-child creation code path in Foundry V14.
    const current=actor.getFlag?.(MODULE_ID,'inventory');
    if(placementsCommitted || JSON.stringify(current)!==JSON.stringify(original)) {
      try {
        if(precreateRoot)await actor.update({[`flags.${MODULE_ID}.inventory`]:original},
          {...writeOptions,[`${MODULE_ID}.physicalTransfer`]:true});
        else await writeBackpackInventory(actor,original,
          {...writeOptions,[`${MODULE_ID}.physicalTransfer`]:true});
      }
      catch(rollback) {throw Error('Backpack flag rollback failed; ask the GM to inspect the Actor before retrying.',{cause:error});}
    }
    throw error;
  }
}

/** Determine which newly restored descendants belong to a root backpack. */
export function backpackDescendantIds(actor,rootId) {
  const placements=actor.getFlag?.(MODULE_ID,'inventory')?.placements ?? {};
  const descendants=[];
  const visited=new Set([rootId]);
  function visit(provider) {
    for(const [id,position] of Object.entries(placements)) {
      if(storageParent(position)!==provider || visited.has(id))continue;
      visited.add(id);
      if(actor.items?.get?.(id))descendants.push(id);
      visit(id);
    }
  }
  visit(rootId);
  return descendants;
}
