/** Native Foundry Item-directory → Actor sheet import (including backpacks). */
import { MODULE_ID } from './constants.js';
import { getSheetConfig } from './config.js';
import { receiveActorStacks } from './stack-receiver.js';
import { getEffectiveInventoryConfig, getInventoryState, getActorStorage, trackInventoryItem, moveInventoryItem } from './inventory.js';
import { nearestExternalComplexPlacement } from './external-item-placement.js';
import { nearestExternalStoragePlacement, resolveAutomaticStorageDrop } from './external-storage-placement.js';

const freshOptions = () => ({ [`${MODULE_ID}.inventory`]: true });
export async function makeStack(actor, chunk, position, config) {
  // Hooks may persist an embedded Item and then throw before createEmbeddedDocuments
  // returns. Keep the pre-create IDs and transfer identity for exact cleanup.
  const beforeIds=new Set([...(actor.items??[])].map(entry=>entry.id));
  const identity=chunk?.flags?.[MODULE_ID]?.itemInstance?.instanceId;
  let item;
  try {
    const created=await actor.createEmbeddedDocuments('Item',[chunk],freshOptions());
    item=created?.[0];
    if (!item?.id || !actor.items?.get?.(item.id)) throw Error('Item creation was not confirmed.');
    await trackInventoryItem(actor,item.id,config);
    if (position?.area === 'storage') {
      const bag=getActorStorage(actor,config).compartments.find(entry=>entry.storageId===position.storageId);
      const shapes=Object.fromEntries([...(actor.items??[])].map(entry=>[entry.id,entry.getFlag?.(MODULE_ID,'item')?.shape]));
      const placements=getInventoryState(actor,config).placements;
      const automatic=position.auto ? resolveAutomaticStorageDrop(position,
        {compartments:[bag],placements,shapes,itemId:item.id}) : null;
      const nearest=position.auto ? automatic?.index ?? null : nearestExternalStoragePlacement({
        compartment:bag,placements,shapes,itemId:item.id,
        requestedIndex:Number(position.index)||0,rotation:position.rotation||0});
      if(nearest===null || (!position.auto && position.strict && nearest!==position.index)) throw Error('No free storage cell for the next stack.');
      if(!await moveInventoryItem(actor,item.id,{...position,index:nearest,
        rotation:automatic?.rotation ?? position.rotation ?? 0,auto:false},config)) throw Error('Could not save storage placement.');
    } else if (position?.area === 'inventory') {
      const inventory=getEffectiveInventoryConfig(actor,config);
      let index=position.index;
      if(inventory.mode==='complex') {
        const shapes=Object.fromEntries([...(actor.items??[])].map(entry=>[entry.id,entry.getFlag?.(MODULE_ID,'item')?.shape]));
        index=nearestExternalComplexPlacement({placements:getInventoryState(actor,config).placements,shapes,
          itemId:item.id,requestedIndex:index,rotation:position.rotation||0,grid:inventory.complex});
        if(index===null || (position.strict && index!==position.index))throw Error('No free cell for the next stack.');
      }
      if(!await moveInventoryItem(actor,item.id,{...position,index},config))throw Error('Could not position incoming stack.');
    }
    const placed=getInventoryState(actor,config).placements[item.id];
    if(!placed || placed.area !== (position?.area || 'inventory') ||
      (position?.area==='storage' && placed.storageId!==position.storageId))
      throw Error('There is not enough room for all stacks.');
    return item;
  }catch(error) {
    // Only remove documents created by THIS operation, never an older stack.
    const leaked=[...(actor.items??[])].filter(entry=>!beforeIds.has(entry.id) &&
      (entry.id===item?.id || (identity &&
       (entry.getFlag?.(MODULE_ID,'itemInstance')?.instanceId ??
        entry.flags?.[MODULE_ID]?.itemInstance?.instanceId)===identity)));
    const ids=[...new Set(leaked.map(entry=>entry.id))];
    if(ids.length) {
      try {await actor.deleteEmbeddedDocuments('Item',ids,freshOptions());}
      catch(rollback) {
        if(ids.some(id=>actor.items?.get?.(id)))
          throw Error('Item creation failed and cleanup also failed. Ask the GM to inspect the inventory.',{cause:rollback});
      }
      if(ids.some(id=>actor.items?.get?.(id)))
        throw Error('Item creation failed but a new stack remains. Ask the GM to reconcile it.',{cause:error});
    }
    throw error;
  }
}
export async function importStackableToActor(actor, source, position, config=getSheetConfig()) {
  const data=structuredClone(source.toObject());
  delete data._id;delete data._stats;
  data.flags??={};data.flags[MODULE_ID]??={};
  const old=data.flags[MODULE_ID].itemInstance||{};
  data.flags[MODULE_ID].itemInstance={...old,originUuid:old.originUuid||source.uuid||'',version:1};
  return receiveActorStacks(actor,data,position,config,(chunk,location)=>makeStack(actor,chunk,location,config));
}
