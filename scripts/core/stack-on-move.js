/** Consolidate stacks after an item enters another Actor inventory area.
 * Other compartments and equipped items are never consumed. The plan is
 * rechecked after every awaited Foundry hook, since another GM may mutate the
 * same Actor before the source is reduced. */
import { MODULE_ID } from './constants.js';
import { getInventoryState } from './inventory.js';
import { planStackTransfer, stackQuantity, maxStackOf } from './stack-capacity.js';
import { validStackQuantity } from './stack-quantity.js';
import { makeStack } from './stack-native-import.js';
import { getItemRules } from './item-config.js';

const freshOptions=()=>({ [`${MODULE_ID}.inventory`]:true });
export async function autoStackMovedItem(actor,itemId,config) {
  const source=actor.items?.get?.(itemId);
  if(!source || !getItemRules(source,config).multiple.enabled) return;
  if (!validStackQuantity(source)) throw Error('The moved Item has an invalid stack quantity. Repair it before merging.');
  const placement=getInventoryState(actor,config).placements[itemId];
  if(!['inventory','storage'].includes(placement?.area))return;
  const state=getInventoryState(actor,config);
  const candidates=[...(actor.items??[])].filter(item=>item.id!==itemId &&
    state.placements[item.id]?.area===placement.area &&
    (placement.area!=='storage' || state.placements[item.id].storageId===placement.storageId));
  const initial=stackQuantity(source);
  const plan=planStackTransfer(source,initial,candidates,config);
  if(!plan.merges.length && initial<=maxStackOf(source,config))return;
  const remaining=plan.chunks.reduce((sum,q)=>sum+q,0);
  const extras=plan.chunks.slice(1);
  const plannedTargets=new Map(plan.merges.map(({target})=>[target.id,stackQuantity(target)]));
  const added=[],modified=[];
  const addedQuantities=new Map();
  let sourceExpected=null,deleteAttempted=false;
  const sourceStillUnchanged=()=>actor.items?.get?.(itemId)===source &&
    validStackQuantity(source) && stackQuantity(source)===initial;
  try {
    for(const amount of extras) {
      if(!sourceStillUnchanged())throw Error('Moved stack changed during automatic stacking. Retry after checking quantities.');
      const data=structuredClone(source.toObject());
      delete data._id;delete data._stats;
      data.system??={};data.system.quantity=amount;
      data.flags??={};data.flags[MODULE_ID]??={};
      data.flags[MODULE_ID].itemInstance={...(data.flags[MODULE_ID].itemInstance||{}),
        version:1,instanceId:foundry.utils.randomID(20)};
      const created=await makeStack(actor,data,placement.area==='storage'?
        {area:'storage',storageId:placement.storageId,auto:true}:null,config);
      added.push(created);
      addedQuantities.set(created.id,amount);
    }
    for(const {target,amount} of plan.merges) {
      if(!sourceStillUnchanged())throw Error('Moved stack changed during automatic stacking. Retry after checking quantities.');
      const prior=plannedTargets.get(target.id);
      if(actor.items?.get?.(target.id)!==target || !validStackQuantity(target) ||
         stackQuantity(target)!==prior || prior+amount>maxStackOf(target,config))
        throw Error('Target stack changed during automatic stacking. Retry after checking quantities.');
      modified.push({item:target,prior,expected:prior+amount});
      await actor.updateEmbeddedDocuments('Item',[{_id:target.id,'system.quantity':prior+amount}],freshOptions());
      if(stackQuantity(actor.items?.get?.(target.id))!==prior+amount)throw Error('Stack merge was not saved.');
    }
    if(!sourceStillUnchanged())throw Error('Moved stack changed during automatic stacking. Retry after checking quantities.');
    if(remaining>0) {
      const keep=plan.chunks[0];
      if(keep!==initial) {
        sourceExpected=keep;
        await actor.updateEmbeddedDocuments('Item',[{_id:itemId,'system.quantity':keep}],freshOptions());
        if(stackQuantity(actor.items?.get?.(itemId))!==keep)throw Error('Source stack was not saved.');
      }
    } else {
      deleteAttempted=true;
      await actor.deleteEmbeddedDocuments('Item',[itemId],freshOptions());
      if(actor.items?.get?.(itemId))throw Error('Merged source stack was not removed.');
    }
  }catch(error) {
    // A deletion committed before a post-delete hook threw. The source really
    // is gone: rolling back the targets would destroy the transferred units.
    if(deleteAttempted && !actor.items?.get?.(itemId))return;
    const failures=[];
    if(sourceExpected!==null && actor.items?.get?.(itemId)===source) {
      const actual=stackQuantity(source);
      if(actual!==initial) {
        if(actual!==sourceExpected) failures.push(Error('Source stack changed before rollback.'));
        else try {
          await actor.updateEmbeddedDocuments('Item',[{_id:itemId,'system.quantity':initial}],freshOptions());
          if(stackQuantity(source)!==initial)failures.push(Error('Source stack rollback was not confirmed.'));
        } catch(rollback) {
          if(stackQuantity(source)!==initial)failures.push(rollback);
        }
      }
    } else if (actor.items?.get?.(itemId)!==source) {
      failures.push(Error('Source stack disappeared during rollback.'));
    } else if (stackQuantity(source)!==initial) {
      failures.push(Error('Source stack changed before rollback.'));
    }
    for(const {item,prior,expected} of [...modified].reverse()) {
      const live=actor.items?.get?.(item.id);
      if(live!==item || !validStackQuantity(live)) {
        failures.push(Error('Merged target disappeared or became invalid.'));continue;
      }
      const actual=stackQuantity(live);
      if(actual===prior)continue;
      if(actual!==expected){failures.push(Error('Another action changed a merged target.'));continue;}
      try {
        await actor.updateEmbeddedDocuments('Item',[{_id:item.id,'system.quantity':prior}],freshOptions());
        if(stackQuantity(live)!==prior)failures.push(Error('Target rollback was not confirmed.'));
      }catch(rollback) {if(stackQuantity(live)!==prior)failures.push(rollback);}
    }
    const ids=[];
    for(const item of added) {
      const live=actor.items?.get?.(item.id);
      if(!live)continue;
      if(!validStackQuantity(live) || stackQuantity(live)!==addedQuantities.get(item.id))
        failures.push(Error('A new stack changed after creation; it was left intact.'));
      else ids.push(item.id);
    }
    if(ids.length) try {
      await actor.deleteEmbeddedDocuments('Item',ids,freshOptions());
      if(ids.some(id=>actor.items?.get?.(id)))failures.push(Error('Created stacks were not fully deleted.'));
    }catch(rollback) {if(ids.some(id=>actor.items?.get?.(id)))failures.push(rollback);}
    if(failures.length)throw Error('Auto stacking could not be safely rolled back. Ask the GM to inspect quantities.',{cause:failures[0]});
    throw error;
  }
}
