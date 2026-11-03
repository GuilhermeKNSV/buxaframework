/** Transactional inbound stacking for Actor inventories and external storage.
 * Nothing is removed from the source until the caller commits its transfer. */
import { MODULE_ID } from './constants.js';
import { getInventoryState } from './inventory.js';
import { planStackTransfer, stackQuantity, sameStackType } from './stack-capacity.js';

const freshOptions = () => ({ [`${MODULE_ID}.stackTransfer`]: true });
export async function receiveActorStacks(actor, data, position, config, createChunk) {
  const targetArea = position?.area === 'storage' ? 'storage' : 'inventory';
  const inventory = getInventoryState(actor, config);
  const matching = [...(actor.items ?? [])].filter(item => {
    const location = inventory.placements[item.id];
    return location?.area === targetArea &&
      (targetArea !== 'storage' || location.storageId === position.storageId) &&
      sameStackType(item, data, config);
  });
  // When a specific occupied stack was targeted, prefer filling that stack.
  matching.sort((a,b) => {
    const left = inventory.placements[a.id], right = inventory.placements[b.id];
    const prioritized = value => position?.index != null && value?.index === Number(position.index) ? 0 : 1;
    return prioritized(left)-prioritized(right) || Number(left?.index ?? 0)-Number(right?.index ?? 0);
  });
  const plan = planStackTransfer(data, stackQuantity(data), matching, config);
  // The planner reserves free capacity using today's quantities. Since
  // creating extra stacks awaits Foundry hooks, a remote GM could refill a
  // target before our merge. Never credit planned units atop newer counts.
  const plannedQuantities = new Map(plan.merges.map(({target})=>[target.id,stackQuantity(target)]));
  const added = [], modified = [], createdQuantities = new Map();
  const rollback = async () => {
    const errors = [];
    // Restore quantities before removing the new copies so a retry is safe.
    for (const { item, quantity, expected } of [...modified].reverse()) {
      const live = actor.items?.get?.(item.id);
      if (!live) { errors.push(Error('Merged source stack disappeared.')); continue; }
      const actual = stackQuantity(live);
      if (actual === quantity) continue; // A post-save hook already rolled back.
      // A different player or GM may have changed this stack after our merge.
      // Never overwrite their newer quantity with an outdated snapshot.
      if (actual !== expected) {
        errors.push(Error('Another action changed a merged stack; recovery needs GM review.'));
        continue;
      }
      try {await actor.updateEmbeddedDocuments('Item', [{_id:item.id,'system.quantity':quantity}], freshOptions());}
      catch(error) {
        if (stackQuantity(actor.items?.get?.(item.id)) !== quantity) errors.push(error);
      }
      if (stackQuantity(actor.items?.get?.(item.id)) !== quantity)
        errors.push(Error('Merged stack rollback was not confirmed.'));
    }
    const ids = added.filter(item => actor.items?.get?.(item.id))
      .filter(item => {
        // Only delete an imported chunk if it still has the quantity we
        // created. Otherwise it could now contain another legitimate merge.
        if (stackQuantity(actor.items.get(item.id)) !== createdQuantities.get(item.id)) {
          errors.push(Error('New imported stack changed before rollback.'));
          return false;
        }
        return true;
      }).map(item => item.id);
    if (ids.length) {
      try {await actor.deleteEmbeddedDocuments('Item', ids, freshOptions());}
      catch(error) {errors.push(error);}
    }
    if (errors.length) throw Error('Stack transfer rollback could not be completed. Ask the GM to reconcile quantities.', {cause:errors[0]});
  };
  try {
    for (const [index, amount] of plan.chunks.entries()) {
      const copy = structuredClone(data);
      copy.system ??= {};
      copy.system.quantity = amount;
      copy.flags ??= {};
      copy.flags[MODULE_ID] ??= {};
      copy.flags[MODULE_ID].itemInstance = {
        ...(copy.flags[MODULE_ID].itemInstance || {}),
        version: 1,
        instanceId: foundry.utils.randomID(20)
      };
      const occupied = position?.index != null && Object.values(getInventoryState(actor,config).placements)
        .some(placement => placement.area===targetArea && placement.index===Number(position.index) &&
          (targetArea!=='storage' || placement.storageId===position.storageId));
      const location = index === 0 && !occupied ? position :
        targetArea === 'storage' ? {area:'storage',storageId:position.storageId,auto:true} : null;
      const item = await createChunk(copy,location);
      if (!item?.id || !actor.items?.get?.(item.id)) throw Error('The new stack was not saved.');
      added.push(item);
      createdQuantities.set(item.id, amount);
    }
    for (const {target,amount} of plan.merges) {
      const live = actor.items?.get?.(target.id);
      if (!live || live !== target || stackQuantity(live)!==plannedQuantities.get(target.id))
        throw Error('Target stack quantity changed while importing. Please retry the transfer.');
      const quantity = plannedQuantities.get(target.id);
      modified.push({item:target,quantity,expected:quantity+amount});
      await actor.updateEmbeddedDocuments('Item',[{_id:target.id,'system.quantity':quantity+amount}],freshOptions());
      if (stackQuantity(actor.items?.get?.(target.id)) !== quantity+amount) throw Error('Stack merge was not confirmed.');
    }
  } catch (error) {
    try {await rollback();}
    catch (rollbackError) {throw Error('Stack import failed and recovery also failed. Ask the GM to check quantities.',{cause:rollbackError});}
    throw error;
  }
  const item = added[0] ?? plan.merges[0]?.target;
  return {item, created:added, merged:modified, rollback};
}
