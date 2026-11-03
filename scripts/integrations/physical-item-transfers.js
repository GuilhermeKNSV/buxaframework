import { reconcileFailedGroundWorldExport } from './physical-world-export-recovery.js';
import { trashSceneItems } from './physical-item-trash.js';
import { itemBoardImageOf, normalizeItemBoardImage } from "../core/item-board-image.js";
/** GM-authoritative physical scene items. Mutations are serialized, never optimistic. */
import { MODULE_ID } from '../core/constants.js';
import { receiveActorStacks } from '../core/stack-receiver.js';
import { receiveGroundStacks } from '../core/ground-stack-receiver.js';
import { getItemRules } from '../core/item-config.js';
import { playerSightForPhysicalItem } from '../core/physical-item-sight-auth.js';
import { readScenePartition, writeScenePartition } from '../core/physical-scene-partitions.js';
import { sameStoredValue } from '../core/value-equality.js';
import { createPhysicalRequestChannel } from './physical-item-request-channel.js';
import { getSheetConfig } from '../core/config.js';
import { getInventoryState, trackInventoryItem, moveInventoryItem, getEffectiveInventoryConfig, getActorStorage } from '../core/inventory.js';
import { nearestExternalComplexPlacement } from '../core/external-item-placement.js';
import { resolveAutomaticStorageDrop } from '../core/external-storage-placement.js';
import { groundCompartments, groundDirectItems, groundDropDestination, groundAddBranch, groundRemoveBranch, groundMoveWithin } from '../core/ground-container.js';
import { captureBackpackContents, attachPackedContents, getPackedContents, stripPackedContents,
  restoreBackpackContents, createPackedActorBackpack, repairBackpackPlacements, backpackDescendantIds, packedContentsCount,
  preservePortableStorageMode } from '../core/backpack-transfers.js';
import { PHYSICAL_FLAG, PHYSICAL_SETTINGS, scenePhysicalItems, physicalQuantity,
  validDropQuantity, normalizePhysicalSettings, canInteractPhysical, toPhysicalItem,
  physicalDestination, physicalSceneRect, canDropPhysical, physicalDropArtworkOrigin, normalizePhysicalArtwork, PHYSICAL_SCENE_STORE, physicalSceneStore, groundItemLootDisabled, assertPhysicalSceneRecordsWritable, validPhysicalSceneRecord } from '../core/physical-items.js';

function checkedSceneInteraction(options) {
  const basic=canInteractPhysical(options);
  if(!basic.allowed)return basic;
  const sight=playerSightForPhysicalItem({user:options.user,scene:options.scene,item:options.item,
    actors:options.actors,tokens:options.tokens});
  return sight.allowed?basic:sight;
}
// Foundry may mutate document-operation options (notably adding `parent` and
// `pack`). Never share an options object between an embedded Item operation
// and an Actor update: the stale parent makes Foundry treat Actor as embedded.
const transferOptions = () => ({ [`${MODULE_ID}.physicalTransfer`]:true });
const localNonce = () => foundry.utils.randomID(18);
const sceneFor = id => game.scenes?.get?.(id);
const currentPolicy = () => normalizePhysicalSettings(game.settings.get(MODULE_ID,PHYSICAL_SETTINGS));
const sceneTokens = scene => scene?.tokens?.contents ?? [...(scene?.tokens ?? [])];
const actorList = () => game.actors?.contents ?? [...(game.actors ?? [])];
/** Elect the same authoritative GM on every client without relying on
 * User.isActiveGM, which can be undefined in Foundry integrations. */
export function physicalActiveGM(users = game.users) {
  const list = [...(users ?? [])];
  const active = users?.activeGM;
  if (active?.isGM && active.active !== false) return active;
  return list.filter(user => user?.isGM && user.active !== false)
    .sort((a,b) => String(a.id).localeCompare(String(b.id)))[0] ?? null;
}
function isPhysicalAuthority() {
  return Boolean(game.user?.isGM && physicalActiveGM()?.id === game.user.id);
}
function sourceActor(payload) {
  if (payload.source !== 'actor') return null;
  if (!payload.sourceTokenId) return game.actors?.get?.(payload.sourceActorId||payload.actorId) || null;
  // A sheet opened from an unlinked token uses a synthetic Actor. Never take
  // inventory from its world Actor template by accident.
  const token = sceneFor(payload.sceneId)?.tokens?.get?.(payload.sourceTokenId);
  const actor = token?.actor;
  return actor?.id === (payload.sourceActorId||payload.actorId) ? actor : null;
}
const cleanItemData = (source, quantity) => {
  const data = structuredClone(source);
  delete data._id; delete data._stats;
  data.system ??= {};
  if ('quantity' in data.system) data.system.quantity = quantity;
  if ('equipped' in data.system) data.system.equipped = false;
  data.flags ??= {};
  data.flags[MODULE_ID] ??= {};
  data.flags[MODULE_ID].itemInstance = {
    ...(data.flags[MODULE_ID].itemInstance || {}), version:1, instanceId:localNonce()
  };
  return data;
};
function requireActorOwner(user, actor) {
  if (!actor || !user || !(user.isGM || actor.testUserPermission?.(user,'OWNER'))) throw Error('You cannot transfer items from this Actor.');
}
async function portableBackpack(actor,item,quantity,available,config) {
  if(actor)await repairBackpackPlacements(actor,item.id,config);
  const contents=actor?captureBackpackContents(actor,item.id,config):[];
  if(contents.length && (quantity!==available || available!==1))
    throw Error('A backpack containing items must be transferred as a single complete item.');
  return contents;
}
async function rollbackNewActorItem(actor,itemId) {
  const ids=[...backpackDescendantIds(actor,itemId),itemId].filter(id=>actor.items?.get?.(id));
  if(ids.length)await actor.deleteEmbeddedDocuments('Item',ids,transferOptions());
}
async function deleteActorBackpack(actor,item,contents) {
  const ids=[...contents.map(child=>child.sourceId),item.id];
  const originalInventory=structuredClone(actor.getFlag?.(MODULE_ID,'inventory')??{});
  const snapshots=ids.map(id=>actor.items?.get?.(id)?.toObject()).filter(Boolean);
  try {
    await actor.deleteEmbeddedDocuments('Item',ids,transferOptions());
    if(ids.some(id=>actor.items?.get?.(id)))throw Error('Some backpack items remain in the source Actor.');
    return true;
  } catch(error) {
    if(ids.every(id=>!actor.items?.get?.(id)))return true; // Hook threw after successful batch.
    try {
      const missing=snapshots.filter(data=>!actor.items?.get?.(data._id));
      if(missing.length)await actor.createEmbeddedDocuments('Item',missing,{...transferOptions(),keepId:true});
      if(ids.some(id=>!actor.items?.get?.(id)))throw Error('Could not restore the original item IDs.');
      await actor.update({[`flags.${MODULE_ID}.inventory`]:originalInventory},transferOptions());
    }catch(rollback) {
      console.error(`${MODULE_ID} | CRITICAL backpack source recovery failed`,rollback);
      const unresolved=Error('Backpack deletion partially failed. Both locations require GM reconciliation; do not repeat.',{cause:error});
      unresolved.buxaUnreconciled=true;
      throw unresolved;
    }
    throw error;
  }
}
/** Write ground loot via the Foundry WORLD SETTINGS API. The previous Scene
 * document write caused Actor5e.getEmbeddedCollection("Scene") in Foundry V14
 * for users with character sheets open, blocking loot, move and artwork edit.
 * A single GM serializes these writes. The initial write transparently copies
 * items from the old Scene flag; an empty saved list is authoritative too.
 * Never touch Scene.update(), updateDocuments(), or embedded documents here. */
export async function writePhysical(scene, entries) {
  if (!scene?.id || !game.user?.isGM || !Array.isArray(entries))
    throw Error('A GM and a valid scene are required to save physical items.');
  if (typeof game.settings?.set !== 'function')
    throw Error('World-setting storage is unavailable. No items were changed.');
  assertPhysicalSceneRecordsWritable(scene);
  const records=structuredClone(entries);
  const ids=new Set();
  for(const record of records) {
    if(!validPhysicalSceneRecord(record) || ids.has(record.id))
      throw Error('Invalid physical Item position or data, or duplicate record; scene storage was not changed.');
    ids.add(record.id);
  }
  // Once the scene partition exists, write ONLY that scene's record. The
  // legacy aggregate is left intact for read-only migration/recovery.
  if (readScenePartition(scene.id)) return writeScenePartition(scene.id,records);
  const before=physicalSceneStore();
  const next={...before,[scene.id]:records};
  const result=await game.settings.set(MODULE_ID,PHYSICAL_SCENE_STORE,next);
  // A successful set must be acknowledged by Foundry; do not silently
  // continue into inventory deletion if the new state was not persisted.
  const after=physicalSceneStore();
  if (!Object.hasOwn(after,scene.id) || !sameStoredValue(after[scene.id],records))
    throw Error('Physical item world storage did not confirm the saved change. Inventory was not modified.');
  return result;
}
async function dropToScene(payload, user) {
  const scene = sceneFor(payload.sceneId);
  if (!scene) throw Error('Scene not found.');
  const actor = sourceActor(payload);
  if (payload.source === 'actor') requireActorOwner(user,actor);
  else if (payload.source !== 'world' || !user.isGM) throw Error('Only a GM can place world-item templates.');
  const item = actor ? actor.items?.get?.(payload.itemId) : game.items?.get?.(payload.itemId);
  if (!item) throw Error('Source item no longer exists.');
  const available = physicalQuantity(item);
  const quantity = Number(payload.quantity);
  if (!validDropQuantity(quantity,available)) throw Error('Invalid quantity or item count changed.');
  const dest = physicalDestination(payload.point,{grid:scene.grid,scene,dimensions:{width:scene.width,height:scene.height}});
  if (!dest) throw Error('Drop position is outside the scene.');
  if (actor) {
    const allowed=canDropPhysical({user,actorId:actor.id,scene,point:dest,actors:actorList(),tokens:sceneTokens(scene),settings:currentPolicy()});
    if (!allowed.allowed) throw Error(allowed.reason);
  }
  // `payload.point` is the cursor and artwork CENTER. Persist a top-left
  // scene origin only after validating the complete visible footprint.
  const imageDefaults=itemBoardImageOf(item.toObject());
  const origin=physicalDropArtworkOrigin(dest,imageDefaults.size,scene);
  if(!origin)throw Error('The whole item image must fit inside the scene.');
  const contents=actor?await portableBackpack(actor,item,quantity,available,getSheetConfig()):getPackedContents(item.toObject());
  if(contents.length && (quantity!==available || available!==1)) throw Error('A filled backpack cannot be split into multiple ground items.');
  const id = localNonce();
  const entry = toPhysicalItem(item, quantity, origin, dest.size, id);
  if(actor) preservePortableStorageMode(entry.data, getSheetConfig());
  if(contents.length)entry.data=attachPackedContents(entry.data,contents);
  try { await writePhysical(scene,[...scenePhysicalItems(scene), entry]); }
  catch (error) {
    // Some document hooks throw after a successful Scene write.
    // Make a best-effort cleanup while the source Item is still untouched.
    if (scenePhysicalItems(scene).some(e=>e.id===id)) {
      try { await writePhysical(scene,scenePhysicalItems(scene).filter(e=>e.id!==id)); }
      catch (rollback) { console.error(`${MODULE_ID} | CRITICAL scene creation rollback failed`,rollback);
        throw Error('Scene creation failed and may have persisted. Ask the GM to inspect the scene before retrying.',{cause:error}); }
    }
    throw error;
  }
  if (!actor) return { id };
  try {
    if (quantity === available && contents.length) {
      await deleteActorBackpack(actor,item,contents);
    } else if (quantity === available) {
      const deleted = await actor.deleteEmbeddedDocuments('Item',[item.id],transferOptions());
      if (actor.items?.get?.(item.id) || !deleted?.length) throw Error('Inventory item could not be removed.');
    } else {
      const changed = await actor.updateEmbeddedDocuments('Item',[{_id:item.id,'system.quantity':available-quantity}],transferOptions());
      if (!changed?.length || physicalQuantity(actor.items.get(item.id)) !== available-quantity) throw Error('Inventory quantity could not be reduced.');
    }
  } catch (error) {
    if(error?.buxaUnreconciled)throw error; // Keep the verified destination bundle to avoid item loss.
    // A post-delete hook may throw even after Foundry removed the source.
    // In that case keeping the scene item prevents accidental item loss.
    if ((quantity === available && !actor.items?.get?.(item.id) && contents.every(child=>!actor.items?.get?.(child.sourceId))) ||
        (quantity < available && physicalQuantity(actor.items?.get?.(item.id)) === available-quantity))
      return { id, note:'Source mutation completed despite a hook error.' };
    try { await writePhysical(scene,scenePhysicalItems(scene).filter(e=>e.id!==id)); }
    catch (rollback) { console.error(`${MODULE_ID} | CRITICAL scene drop rollback failed`, rollback); throw Error('Drop failed and needs GM reconciliation. Do not repeat the transfer.',{cause:error}); }
    throw error;
  }
  return { id };
}
async function lootFromScene(payload, user) {
  const scene = sceneFor(payload.sceneId);
  const entry = scenePhysicalItems(scene).find(e=>e.id===payload.itemId);
  if (!entry) throw Error('Physical item has already been looted.');
  if (groundItemLootDisabled(entry)) throw Error('This container cannot be looted. Open it to access its contents.');
  const allowed = checkedSceneInteraction({user,scene,item:entry,actors:actorList(),tokens:sceneTokens(scene),settings:currentPolicy(),operation:'loot'});
  if (!allowed.allowed) throw Error(allowed.reason);
  const actor = game.actors?.get?.(allowed.candidate.actorId);
  requireActorOwner(user,actor);
  const data = cleanItemData(entry.data, entry.quantity);
  const newItem=await createPlacedActorItem(actor,data,null);
  try {
    // A backpack's contents are restored to their original cells before
    // its ground record can be deleted.
    await writePhysical(scene,scenePhysicalItems(scene).filter(e=>e.id!==entry.id));
  } catch(error) {
    if(!scenePhysicalItems(scene).some(e=>e.id===entry.id))return {actorId:actor.id,itemId:newItem.id};
    try {await rollbackPlacedActorItem(actor,newItem);}
    catch(rollback){throw Error('Loot rollback failed; ask the GM to inspect the inventory.',{cause:error});}
    throw error;
  }
  return { actorId:actor.id, itemId:newItem.id };
}
async function moveOnScene(payload, user) {
  const scene = sceneFor(payload.sceneId);
  const entries=scenePhysicalItems(scene);
  const entry=entries.find(e=>e.id===payload.itemId);
  if (!entry) throw Error('Physical item is missing.');
  const dest=physicalDestination(payload.point,{grid:scene.grid,scene,dimensions:{width:scene.width,height:scene.height}});
  if (!dest) throw Error('Invalid destination.');
  const rect=physicalSceneRect(scene);
  const size=Math.max(1,Number(entry.size)||76);
  if(dest.x<rect.x || dest.y<rect.y || dest.x+size>rect.x+rect.width || dest.y+size>rect.y+rect.height)
    throw Error('The whole item image must remain inside the scene.');
  const allowed=checkedSceneInteraction({user,scene,item:entry,actors:actorList(),tokens:sceneTokens(scene),settings:currentPolicy(),operation:'move',destination:dest});
  if (!allowed.allowed) throw Error(allowed.reason);
  await writePhysical(scene,entries.map(e=>e.id===entry.id?{...e,x:Math.round(dest.x),y:Math.round(dest.y)}:e));
  return { id:entry.id };
}
async function editOnScene(payload,user) {
  if (!user?.isGM) throw Error('Only a GM can edit physical item artwork.');
  const scene=sceneFor(payload.sceneId);
  if (!scene) throw Error('Scene not found.');
  const entries=scenePhysicalItems(scene);
  const entry=entries.find(item=>item.id===payload.itemId);
  if (!entry) throw Error('Physical item no longer exists.');
  const artwork=normalizePhysicalArtwork(payload.artwork,entry);
  const rect=physicalSceneRect(scene);
  const inside=artwork.x>=rect.x && artwork.y>=rect.y &&
    artwork.x+artwork.size<=rect.x+rect.width && artwork.y+artwork.size<=rect.y+rect.height;
  if(!inside) throw Error('Artwork must remain inside the scene.');
  const image=normalizeItemBoardImage({...artwork,opacity:entry.opacity??1});
  await writePhysical(scene,entries.map(item=>item.id===entry.id?{
    ...item,...artwork,opacity:image.opacity,
    data:{...item.data,flags:{...item.data.flags,buxaframework:{...item.data.flags?.buxaframework,
      item:{...item.data.flags?.buxaframework?.item,boardImage:image}}}}
  }:item));
  return {id:entry.id};
}
/** Resolve an explicit destination Actor, including synthetic token Actors.
 * Do not substitute a world Actor when the requested token is missing. */
function targetActor(payload) {
  const targetId=payload.targetActorId || payload.actorId;
  if (!targetId) return null;
  if (!payload.targetTokenId) return game.actors?.get?.(targetId) ?? null;
  const token=sceneFor(payload.sceneId)?.tokens?.get?.(payload.targetTokenId);
  return token?.actor?.id===targetId ? token.actor : null;
}
/** Avoid duplicate world Items when a Foundry post-create hook throws after
 * persistence. Only touch documents with this transfer's fresh instance ID. */
async function createVerifiedWorldItem(data, options={}) {
  const identity=data.flags?.[MODULE_ID]?.itemInstance?.instanceId;
  const worldItems=()=>[...(game.items?.values?.() ?? game.items ?? [])];
  const before=new Set(worldItems().map(item=>item.id));
  const matching=()=>identity ? worldItems().filter(item=>!before.has(item.id) &&
    (item.getFlag?.(MODULE_ID,'itemInstance')?.instanceId ??
      item.flags?.[MODULE_ID]?.itemInstance?.instanceId)===identity) : [];
  const cleanup=async error=>{
    const leaked=matching();
    for(const item of leaked) {
      try {await item.delete(transferOptions());}
      catch(rollback) {throw Error('World Item creation failed and duplicate cleanup failed. Ask the GM to inspect the directory.',{cause:rollback});}
    }
    if(matching().length)throw Error('World Item creation failed but a duplicate is still present. Ask the GM to reconcile it.',{cause:error});
  };
  let created;
  try {created=await Item.create(data,options);}
  catch(error) {await cleanup(error);throw error;}
  if(!created?.id || game.items?.get?.(created.id)!==created) {
    const error=Error('The Item Directory did not confirm the new item.');
    await cleanup(error);
    throw error;
  }
  return created;
}

async function createSinglePlacedActorItem(actor,data,position) {
  const packed=getPackedContents(data);
  const itemData=stripPackedContents(data);
  if(packed.length) return createPackedActorBackpack(actor,itemData,packed,getSheetConfig(),position,transferOptions());
  // Foundry hooks may throw AFTER creating the embedded Item. If that happens,
  // silently leaving it behind duplicates the transferred item on retry.
  // Only clean up a newly added document with THIS transfer's instance ID.
  const beforeIds=new Set([...(actor.items??[])].map(item=>item.id));
  const identity=itemData.flags?.[MODULE_ID]?.itemInstance?.instanceId;
  let created;
  try {created=await actor.createEmbeddedDocuments('Item',[itemData],transferOptions());}
  catch(error) {
    const leaked=identity ? [...(actor.items??[])].filter(item=>
      !beforeIds.has(item.id) &&
      (item.getFlag?.(MODULE_ID,'itemInstance')?.instanceId ??
        item.flags?.[MODULE_ID]?.itemInstance?.instanceId)===identity).map(item=>item.id) : [];
    if(leaked.length) {
      try {await actor.deleteEmbeddedDocuments('Item',leaked,transferOptions());}
      catch(rollback) {throw Error('Actor Item creation failed after persisting; cleanup also failed. Ask the GM to inspect inventory before retrying.',{cause:rollback});}
      if(leaked.some(id=>actor.items?.get?.(id)))
        throw Error('Actor Item creation failed and the duplicate could not be removed. Ask the GM to reconcile inventory.',{cause:error});
    }
    throw error;
  }
  const added=created?.[0];
  if (!added?.id || !actor.items?.get?.(added.id)) {
    const leaked=identity ? [...(actor.items??[])].filter(item=>!beforeIds.has(item.id) &&
      (item.getFlag?.(MODULE_ID,'itemInstance')?.instanceId ??
        item.flags?.[MODULE_ID]?.itemInstance?.instanceId)===identity).map(item=>item.id) : [];
    if(leaked.length) {
      try {await actor.deleteEmbeddedDocuments('Item',leaked,transferOptions());}
      catch(rollback){throw Error('Unconfirmed Actor Item cleanup failed. Ask the GM to inspect inventory.',{cause:rollback});}
    }
    throw Error('The destination Actor did not confirm creation of the item.');
  }
  try {
    const config=getSheetConfig();
    await trackInventoryItem(actor,added.id,config);
    // Equipment and backpack targets can be valid even when the ordinary
    // inventory has no free cell. Do not reject before trying the requested
    // destination; it may be a perfectly valid slot outside the main grid.
    if (!position && !getInventoryState(actor,config).placements[added.id])
      throw Error('Inventory has no available space. Nothing was transferred.');
    if(position) {
      let resolved={...position};
      const inventory=getEffectiveInventoryConfig(actor,config);
      if(position.area==='inventory' && inventory.mode==='complex') {
        const shapes=Object.fromEntries([...(actor.items??[])].map(item=>[item.id,item.getFlag?.(MODULE_ID,'item')?.shape]));
        const nearest=nearestExternalComplexPlacement({placements:getInventoryState(actor,config).placements,
          shapes,itemId:added.id,requestedIndex:position.index,rotation:position.rotation||0,grid:inventory.complex});
        if(nearest===null || (position.strict && nearest!==position.index))
          throw Error('Inventory has no space at the indicated position.');
        resolved={...position,index:nearest};
      }
      if(position.area==='storage' && position.auto) {
        const bag=getActorStorage(actor,config).compartments.find(e=>e.storageId===position.storageId);
        const shapes=Object.fromEntries([...(actor.items??[])].map(item=>[item.id,item.getFlag?.(MODULE_ID,'item')?.shape]));
        const automatic=resolveAutomaticStorageDrop(position,{compartments:[bag],
          placements:getInventoryState(actor,config).placements,shapes,itemId:added.id});
        if(!automatic) throw Error('The backpack has no space for this item.');
        resolved={...position,...automatic,auto:false};
      }
      const moved=await moveInventoryItem(actor,added.id,resolved,config);
      if (!moved) throw Error('The item does not fit in that inventory slot.');
      const placed=getInventoryState(actor,config).placements[added.id];
      if (!placed || placed.area!==resolved.area || (resolved.area==='inventory' && placed.index!==resolved.index) ||
          (resolved.area==='storage' && (placed.storageId!==resolved.storageId || placed.index!==resolved.index)) ||
          (resolved.area==='equipment' && placed.slotId!==resolved.slotId))
        throw Error('Inventory placement was not saved at the requested location.');
    }
    if(packed.length)await restoreBackpackContents(actor,added.id,packed,config,transferOptions());
  }catch(error){
    try {await rollbackNewActorItem(actor,added.id);}
    catch(rollback){throw Error('Inventory placement failed and destination rollback failed; ask the GM to inspect inventory.',{cause:rollback});}
    throw error;
  }
  return added;
}
// Each receipt knows how to undo both new Item creation and changes to
// pre-existing partial stacks if a subsequent source mutation fails.
const stackReceipts = new WeakMap();
async function createPlacedActorItem(actor,data,position) {
  const config=getSheetConfig();
  if (!getItemRules({getFlag:(scope,key)=>data.flags?.[scope]?.[key]},config).multiple.enabled || getPackedContents(data).length || position?.area==='equipment')
    return createSinglePlacedActorItem(actor,data,position);
  const receipt=await receiveActorStacks(actor,data,position,config,
    (chunk,location)=>createSinglePlacedActorItem(actor,chunk,location));
  if(!receipt.item)throw Error('No items were received.');
  stackReceipts.set(receipt.item,receipt);
  return receipt.item;
}
async function rollbackPlacedActorItem(actor,item) {
  const receipt=stackReceipts.get(item);
  if(receipt) {stackReceipts.delete(item);return receipt.rollback();}
  return rollbackNewActorItem(actor,item.id);
}
async function removeActorQuantity(actor,item,amount,available) {
  if(amount===available) {
    const deleted=await actor.deleteEmbeddedDocuments('Item',[item.id],transferOptions());
    if(actor.items?.get?.(item.id) || !deleted?.length) throw Error('Source inventory item could not be removed.');
  } else {
    const updated=await actor.updateEmbeddedDocuments('Item',[{_id:item.id,'system.quantity':available-amount}],transferOptions());
    if(!updated?.length || physicalQuantity(actor.items?.get?.(item.id))!==available-amount)
      throw Error('Source inventory quantity could not be reduced.');
  }
}
function actorSourceWasReduced(actor,item,amount,available) {
  return amount===available ? !actor.items?.get?.(item.id)
    : physicalQuantity(actor.items?.get?.(item.id))===available-amount;
}
async function transferCrossSurface(payload,user) {
  const source=payload.source, dest=payload.destination;
  if(!['actor','scene','world'].includes(source) || !['actor','world'].includes(dest) || (source==='world'&&dest==='world'))
    throw Error('Unsupported Item transfer direction.');
  const scene=sceneFor(payload.sceneId);
  const actor=source==='actor'?sourceActor(payload):null;
  if(source==='actor')requireActorOwner(user,actor);
  const entry=source==='scene' ? scenePhysicalItems(scene).find(e=>e.id===payload.itemId) : null;
  if(source==='scene' && !entry)throw Error('This ground item no longer exists.');
  if(source==='scene' && groundItemLootDisabled(entry))throw Error('This container cannot be picked up.');
  // Directory creation permission alone must not bypass the distance and
  // explicit character-link rules for picking up physical ground loot.
  if(source==='scene' && !user?.isGM) {
    const allowed=checkedSceneInteraction({user,scene,item:entry,actors:actorList(),
      tokens:sceneTokens(scene),settings:currentPolicy(),operation:'loot'});
    if(!allowed.allowed)throw Error(allowed.reason);
  }
  const worldItem=source==='world'?game.items?.get?.(payload.itemId):null;
  if(source==='world' && (!worldItem || (!user?.isGM && !worldItem.testUserPermission?.(user,'OBSERVER'))))
    throw Error('You cannot use that world item template.');
  const item=source==='actor'?actor.items?.get?.(payload.itemId):worldItem;
  if(source!=='scene'&&!item)throw Error('The source item no longer exists.');
  const available=source==='scene'?entry.quantity:physicalQuantity(item);
  const quantity=Number(payload.quantity);
  if(!validDropQuantity(quantity,Number(available)))throw Error('Invalid item quantity or the source stack changed.');
  if(source!=='actor' && packedContentsCount(source==='scene'?entry.data:item?.toObject?.()) &&
     (quantity!==available || available!==1)) throw Error('A filled backpack must be transferred whole, not split.');
  if(dest==='world' && !(user?.isGM || user?.can?.('ITEM_CREATE')))
    throw Error('You cannot create items in the world Item Directory.');
  let destinationActor=null;
  if(dest==='actor') {
    destinationActor=targetActor(payload);
    requireActorOwner(user,destinationActor);
    if(source==='scene'&&!user?.isGM) {
      const allowed=checkedSceneInteraction({user,scene,item:entry,actors:actorList(),tokens:sceneTokens(scene),settings:currentPolicy(),operation:'loot'});
      if(!allowed.allowed)throw Error(allowed.reason);
      if(allowed.candidate.actorId!==destinationActor.id ||
         !destinationActor.getFlag?.(MODULE_ID,'linkedUsers')?.includes?.(user.id))
        throw Error('You can pick up ground items only for your explicitly linked character.');
    }
  }
  // Same-Actor relocation is an ordinary inventory move, never a copy.
  if(source==='actor' && dest==='actor' && actor===destinationActor) {
    if(!payload.position) return {actorId:actor.id,itemId:item.id};
    if(!await moveInventoryItem(actor,item.id,payload.position,getSheetConfig()))throw Error('Item does not fit there.');
    return {actorId:actor.id,itemId:item.id};
  }
  const snapshot=source==='scene'?entry.data:item.toObject();
  const packed=source==='actor'?await portableBackpack(actor,item,quantity,available,getSheetConfig()):[];
  const prepared=cleanItemData(snapshot,quantity);
  if(source==='actor')preservePortableStorageMode(prepared,getSheetConfig());
  if(source==='world' && item?.uuid)prepared.flags[MODULE_ID].itemInstance.originUuid ||= item.uuid;
  const data=packed.length?attachPackedContents(prepared,packed):prepared;
  let created;
  if(dest==='world') {
    if(typeof Item?.create!=='function')throw Error('World Item creation is unavailable.');
    const folderId=payload.folderId;
    if(folderId) {
      if(game.folders?.get?.(folderId)?.type!=='Item')throw Error('The destination Item folder does not exist.');
      data.folder=folderId;
    }else data.folder=null;
    data.flags={...data.flags,[MODULE_ID]:{...data.flags?.[MODULE_ID],physicalTransfer:true}};
    created=await createVerifiedWorldItem(data,{[`${MODULE_ID}.physicalTransfer`]:true});
  }else created=await createPlacedActorItem(destinationActor,data,payload.position);
  // Destination has been verified. Only now is the source reduced.
  if(source==='world')return {itemId:created.id,actorId:destinationActor.id};
  try {
    if(source==='scene') {
      const latest=scenePhysicalItems(scene);
      const current=latest.find(e=>e.id===entry.id);
      if(!current || Number(current.quantity)!==Number(available))throw Error('Ground stack was changed during transfer.');
      const remaining=Number(available)-quantity;
      const next=latest.map(e=>e.id===entry.id?{
        ...e,quantity:remaining,data:{...e.data,system:{...e.data.system,quantity:remaining}}
      }:e).filter(e=>e.quantity>0);
      await writePhysical(scene,next);
    }else if(packed.length)await deleteActorBackpack(actor,item,packed);
    else await removeActorQuantity(actor,item,quantity,Number(available));
  }catch(error){
    if(error?.buxaUnreconciled)throw error;
    const reduced=source==='scene' ?
      (Number(scenePhysicalItems(scene).find(e=>e.id===entry.id)?.quantity??0)===Number(available)-quantity) :
      (packed.length ? (!actor.items?.get?.(item.id) && packed.every(child=>!actor.items?.get?.(child.sourceId)))
        : actorSourceWasReduced(actor,item,quantity,Number(available)));
    if(reduced)return {itemId:created.id,sourceCommitted:true};
    try {
      if(dest==='world')await created.delete(transferOptions());
      else await rollbackPlacedActorItem(destinationActor,created);
    }catch(rollback){throw Error('Transfer failed and destination rollback also failed. Ask the GM to inspect both sources before retrying.',{cause:rollback});}
    throw error;
  }
  return {itemId:created.id,actorId:destinationActor?.id??null};
}
/** One GM transaction per deposit/withdrawal; chest world storage remains the
 * authoritative source. Never touch Scene.update or embed Scene on an Actor. */
async function transferGroundContents(payload,user) {
  const scene=sceneFor(payload.sceneId);
  const records=scenePhysicalItems(scene);
  const chest=records.find(e=>e.id===payload.containerId);
  if(!chest || !groundCompartments(chest).length)throw Error('This ground item is not a storage container.');
  const access=checkedSceneInteraction({user,scene,item:chest,actors:actorList(),tokens:sceneTokens(scene),settings:currentPolicy(),operation:'open'});
  if(!access.allowed && !user?.isGM)throw Error(access.reason);
  const needsActor=['take','store'].includes(payload.direction) || (payload.direction==='import' && payload.source==='actor') || (payload.direction==='export'&&payload.destination==='actor');
  const actor=needsActor ? targetActor(payload) : null;
  if(needsActor)requireActorOwner(user,actor);
  if(needsActor && !user?.isGM && (actor.id!==access.candidate?.actorId ||
    !actor.getFlag?.(MODULE_ID,'linkedUsers')?.includes?.(user.id)))
    throw Error('Only your linked character can access this container.');
  const replace=next=>records.map(e=>e.id===chest.id?next:e);
  if(payload.direction==='shift') {
    const other=records.find(e=>e.id===payload.destinationContainerId);
    if(!other || other.id===chest.id || !groundCompartments(other).length)throw Error('Choose a different storage container.');
    const otherAccess=checkedSceneInteraction({user,scene,item:other,actors:actorList(),tokens:sceneTokens(scene),settings:currentPolicy(),operation:'open'});
    if(!otherAccess.allowed && !user?.isGM)throw Error(otherAccess.reason);
    const {next:reduced,data}=groundRemoveBranch(chest,payload.contentId);
    const descendants=getPackedContents(data);
    const rootData=stripPackedContents(data);
    const destination=groundDropDestination(other,rootData,{storageId:payload.storageId??null,
      index:payload.index??null,rotation:Number(payload.rotation)||0});
    if(!destination && !getItemRules({getFlag:(ns,key)=>rootData.flags?.[ns]?.[key]}).multiple.enabled)throw Error('Container is full or the item does not fit at that cell.');
    const updated=receiveGroundStacks(other,rootData,descendants,{storageId:payload.storageId??null,index:payload.index??null,rotation:Number(payload.rotation)||0},localNonce);
    await writePhysical(scene,records.map(e=>e.id===chest.id?reduced:e.id===other.id?updated:e));
    return {stored:true};
  }
  if(payload.direction==='reposition') {
    const next=groundMoveWithin(chest,payload.contentId,payload.storageId,Number(payload.index),Number(payload.rotation)||0);
    await writePhysical(scene,replace(next));
    return {moved:true};
  }
  if(payload.direction==='import') {
    const source=payload.source;
    if(!['world','scene'].includes(source))throw Error('Unsupported container source.');
    const entry=source==='scene'?records.find(e=>e.id===payload.itemId):null;
    if(source==='scene' && (!entry || groundItemLootDisabled(entry)))throw Error('That ground item cannot be taken.');
    if(source==='scene' && entry.id===chest.id)throw Error('A container cannot contain itself.');
    if(source==='scene' && !user?.isGM) {
      const sourceAccess=checkedSceneInteraction({user,scene,item:entry,actors:actorList(),
        tokens:sceneTokens(scene),settings:currentPolicy(),operation:'loot'});
      if(!sourceAccess.allowed)throw Error(sourceAccess.reason);
      if(!access.candidate || sourceAccess.candidate?.actorId!==access.candidate.actorId)
        throw Error('Use the same linked character to transfer items into this container.');
    }
    const item=source==='world'?game.items?.get?.(payload.itemId):null;
    if(source==='world' && (!item || (!user.isGM && !item.testUserPermission?.(user,'OBSERVER'))))throw Error('You cannot use that world Item.');
    const data=source==='scene'?entry.data:item.toObject();
    const available=source==='scene'?Number(entry.quantity):physicalQuantity(item);
    const quantity=Number(payload.quantity);
    if(!validDropQuantity(quantity,available))throw Error('Invalid item quantity.');
    if(packedContentsCount(data) && (quantity!==available || available!==1))throw Error('A filled container must move whole.');
    const prepared=cleanItemData(data,quantity);
    if(source==='world' && item?.uuid)prepared.flags[MODULE_ID].itemInstance.originUuid ||= item.uuid;
    const descendants=getPackedContents(prepared);
    const naked=stripPackedContents(prepared);
    const destination=groundDropDestination(chest,naked,{storageId:payload.storageId??null,
      index:payload.index??null,rotation:Number(payload.rotation)||0});
    if(!destination && !getItemRules({getFlag:(ns,key)=>naked.flags?.[ns]?.[key]}).multiple.enabled)throw Error('Container is full: item does not fit.');
    const next=receiveGroundStacks(chest,naked,descendants,{storageId:payload.storageId??null,index:payload.index??null,rotation:Number(payload.rotation)||0},localNonce);
    const remainder=available-quantity;
    const changed=replace(next).map(e=>source==='scene'&&e.id===entry.id?{
      ...e,quantity:remainder,data:{...e.data,system:{...e.data.system,quantity:remainder}}
    }:e).filter(e=>source!=='scene'||e.id!==entry?.id||e.quantity>0);
    await writePhysical(scene,changed);
    return {stored:true};
  }
  if(payload.direction==='export') {
    const {next,data}=groundRemoveBranch(chest,payload.contentId);
    const destination=payload.destination;
    if(destination==='actor') {
      const placed=await createPlacedActorItem(actor,cleanItemData(data,physicalQuantity(data)),payload.position??null);
      try {await writePhysical(scene,replace(next));}
      catch(error){
        if(groundDirectItems(scenePhysicalItems(scene).find(e=>e.id===chest.id)).some(e=>e.sourceId===payload.contentId)){
          await rollbackPlacedActorItem(actor,placed);throw error;
        }
      }
      return {itemId:placed.id};
    }
    if(destination==='scene') {
      const center=payload.point;
      const place=physicalDestination(center,{grid:scene.grid,scene,dimensions:{width:scene.width,height:scene.height}});
      if(!place)throw Error('Drop position is outside the scene.');
      if(!user?.isGM) {
        const range=canDropPhysical({user,actorId:access.candidate?.actorId,scene,point:place,
          actors:actorList(),tokens:sceneTokens(scene),settings:currentPolicy()});
        if(!range.allowed)throw Error(range.reason);
      }
      const id=localNonce();
      const imageDefaults=itemBoardImageOf(data);
      const origin=physicalDropArtworkOrigin(place,imageDefaults.size,scene);
      if(!origin)throw Error('The item must fit inside the scene.');
      const dropped=toPhysicalItem({toObject:()=>data},physicalQuantity(data),origin,place.size,id);
      await writePhysical(scene,[...replace(next),dropped]);
      return {id};
    }
    if(destination==='world') {
      if(!user?.isGM && !user?.can?.('ITEM_CREATE'))throw Error('You cannot create world Items.');
      if(payload.folderId && game.folders?.get?.(payload.folderId)?.type!=='Item')throw Error('Destination folder is missing.');
      const worldData=cleanItemData(data,physicalQuantity(data));
      worldData.folder=payload.folderId||null;
      worldData.flags={...worldData.flags,[MODULE_ID]:{...worldData.flags?.[MODULE_ID],physicalTransfer:true}};
      const copy=await createVerifiedWorldItem(worldData,{[`${MODULE_ID}.physicalTransfer`]:true});
      try {await writePhysical(scene,replace(next));}
      catch(error){
        const saved=scenePhysicalItems(scene).find(record=>record.id===chest.id);
        const sourceStillPresent=Boolean(saved &&
          groundDirectItems(saved).some(e=>e.sourceId===payload.contentId));
        return reconcileFailedGroundWorldExport({error,created:copy,sourceStillPresent,
          deleteCreated:()=>copy.delete(transferOptions()),
          exists:()=>Boolean(game.items?.get?.(copy.id))});
      }
      return {itemId:copy.id};
    }
    throw Error('Unsupported container destination.');
  }
  if(payload.direction==='take') {
    const {next,data,target}=groundRemoveBranch(chest,payload.contentId);
    const placed=await createPlacedActorItem(actor,cleanItemData(data,physicalQuantity(data)),payload.position??null);
    try {await writePhysical(scene,replace(next));}
    catch(error) {
      if(groundDirectItems(scenePhysicalItems(scene).find(e=>e.id===chest.id)).some(e=>e.sourceId===target.sourceId)) {
        try {await rollbackPlacedActorItem(actor,placed);}
        catch(rollback) {throw Error('Chest withdrawal rollback failed; ask your GM to reconcile it.',{cause:error});}
        throw error;
      }
    }
    return {itemId:placed.id};
  }
  if(payload.direction!=='store')throw Error('Unknown chest transfer action.');
  const item=actor.items?.get?.(payload.itemId);
  if(!item)throw Error('The inventory item no longer exists.');
  const available=physicalQuantity(item);
  const quantity=Number(payload.quantity);
  if(!validDropQuantity(quantity,available))throw Error('Invalid stack quantity.');
  const config=getSheetConfig();
  const descendants=await portableBackpack(actor,item,quantity,available,config);
  const data=cleanItemData(item.toObject(),quantity);
  const destination=groundDropDestination(chest,data,{storageId:payload.storageId??null,
    index:payload.index??null,rotation:Number(payload.rotation)||0});
  if(!destination && !getItemRules({getFlag:(ns,key)=>data.flags?.[ns]?.[key]},config).multiple.enabled)throw Error('Item does not fit at that compartment cell.');
  const next=receiveGroundStacks(chest,data,descendants,{storageId:payload.storageId??null,index:payload.index??null,rotation:Number(payload.rotation)||0},localNonce,config);
  await writePhysical(scene,replace(next));
  try {
    if(descendants.length)await deleteActorBackpack(actor,item,descendants);
    else await removeActorQuantity(actor,item,quantity,available);
  }catch(error){
    if(error?.buxaUnreconciled)throw error;
    const reduced=descendants.length?(!actor.items?.get?.(item.id)&&descendants.every(c=>!actor.items?.get?.(c.sourceId))):actorSourceWasReduced(actor,item,quantity,available);
    if(reduced)return {stored:true};
    try {await writePhysical(scene,replace(chest));}
    catch(rollback){throw Error('Chest deposit rollback failed; ask the GM to reconcile the contents.',{cause:error});}
    throw error;
  }
  return {stored:true};
}
async function perform(payload, user) {
  if (!user) throw Error('Unknown user.');
  if (!isPhysicalAuthority()) throw Error('An active GM must be connected to transfer physical items.');
  if (!['drop','loot','move','edit','transfer','container','trash'].includes(payload?.action)) throw Error('Unsupported physical-item action.');
  if (payload.action==='trash') return trashSceneItems(payload,user,{sceneFor,writePhysical});
  if (payload.action==='container') return transferGroundContents(payload,user);
  if (payload.action==='transfer') return transferCrossSurface(payload,user);
  if (payload.action==='drop') return dropToScene(payload,user);
  if (payload.action==='loot') return lootFromScene(payload,user);
  if (payload.action==='edit') return editOnScene(payload,user);
  return moveOnScene(payload,user);
}
const requestChannel=createPhysicalRequestChannel({perform,physicalActiveGM,isPhysicalAuthority});
export function installPhysicalItemTransfers(){return requestChannel.install();}
export function requestPhysicalAction(payload){return requestChannel.request(payload);}
