import {withActorStackMutation} from './actor-transactions.js';
import { MODULE_ID } from "./constants.js";
import { getSheetConfig } from "./config.js";
import { getItemQuantity } from "./dnd5e.js";
import { getItemRules } from "./item-config.js";
import { maxStackOf } from "./stack-capacity.js";
import { validStackQuantity } from "./stack-quantity.js";
import { getFreeInventorySlotIndex, getInventoryState, reconcileInventoryState, trackInventoryItem } from "./inventory.js";

const SPLITTING_OPTION = `${MODULE_ID}.splitting`;

export function getStackSplitAvailability(actor, item, config = getSheetConfig()) {
  if (!actor?.isOwner || !item || item.parent !== actor || actor.items?.get?.(item.id) !== item) {
    return { allowed: false, reason: "This item is not in an inventory you can edit." };
  }
  if (!getItemRules(item, config).multiple.enabled) {
    return { allowed: false, reason: "This item isn't configured as stackable." };
  }
  const quantity = getItemQuantity(item);
  if (!validStackQuantity(item) || quantity < 2) {
    return { allowed: false, reason: "At least two items are needed to split a stack." };
  }
  if (!foundry.utils.hasProperty(item, "system.quantity")) {
    return { allowed: false, reason: "This item does not support a quantity." };
  }
  const freeIndex = getFreeInventorySlotIndex(actor, config, item.id);
  if (freeIndex === null) {
    return { allowed: false, reason: "A free inventory slot is required to unstack this item." };
  }
  return { allowed: true, quantity, max: Math.min(quantity - 1,maxStackOf(item,config)), freeIndex };
}

/**
 * Split an embedded stack, keeping its custom Buxa item rules, appearance,
 * lore and origin, but issuing a NEW instance identity for the new document.
 * The original is reduced only after the new embedded Item has been created.
 * If reducing the original fails, the created copy is removed as rollback.
 */
async function splitItemStackUnlocked(actor, item, requestedAmount, config = getSheetConfig()) {
  const available = getStackSplitAvailability(actor, item, config);
  if (!available.allowed) throw new Error(available.reason);
  const amount = Number(requestedAmount);
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > available.max) {
    throw new RangeError(`Choose a whole number from 1 to ${available.max}.`);
  }

  const data = foundry.utils.deepClone(item.toObject());
  delete data._id;
  delete data._stats;
  // A split of equipped items becomes an unequipped inventory stack.
  foundry.utils.setProperty(data, "system.quantity", amount);
  if (foundry.utils.hasProperty(data, "system.equipped")) {
    foundry.utils.setProperty(data, "system.equipped", false);
  }
  const instancePath = `flags.${MODULE_ID}.itemInstance`;
  const instance = foundry.utils.getProperty(data, instancePath) ?? {};
  foundry.utils.setProperty(data, instancePath, {
    ...instance,
    version: 1,
    instanceId: foundry.utils.randomID(20)
  });

  // An embedded create can persist the Item before a later Foundry hook
  // throws. Match only a new document with this split's unique instance ID.
  const beforeIds = new Set([...(actor.items ?? [])].map(entry => entry.id));
  const newIdentity = foundry.utils.getProperty(data, `${instancePath}.instanceId`);
  const createdByThisSplit = () => [...(actor.items ?? [])].filter(entry =>
    !beforeIds.has(entry.id) &&
    (entry.getFlag?.(MODULE_ID, "itemInstance")?.instanceId ??
      entry.flags?.[MODULE_ID]?.itemInstance?.instanceId) === newIdentity);
  let created;
  try {
    created = await actor.createEmbeddedDocuments("Item", [data], { [SPLITTING_OPTION]: true });
  } catch (error) {
    const leaked = createdByThisSplit().map(entry => entry.id);
    if (leaked.length) {
      try { await actor.deleteEmbeddedDocuments("Item", leaked, { [SPLITTING_OPTION]: true }); }
      catch (rollback) {
        if (leaked.some(id => actor.items?.get?.(id)))
          throw new Error("Unstack creation failed and the new Item could not be removed. Ask the GM to reconcile inventory.", {cause: rollback});
      }
      if (leaked.some(id => actor.items?.get?.(id)))
        throw new Error("Unstack creation failed and a duplicate remains. Ask the GM to reconcile inventory.", {cause: error});
    }
    throw error;
  }
  const newItem = created?.[0];
  if (!newItem || actor.items?.get?.(newItem.id) !== newItem) {
    const leaked = createdByThisSplit().map(entry => entry.id);
    if (leaked.length) {
      try { await actor.deleteEmbeddedDocuments("Item", leaked, { [SPLITTING_OPTION]: true }); }
      catch (rollback) {
        if (leaked.some(id => actor.items?.get?.(id)))
          throw new Error("Unconfirmed split Item cleanup failed. Ask the GM to inspect inventory.", {cause: rollback});
      }
      if (leaked.some(id => actor.items?.get?.(id)))
        throw new Error("Unconfirmed split Item remains. Ask the GM to inspect inventory.");
    }
    throw new Error("Foundry could not confirm the new item stack.");
  }

  try {
    await item.update({ "system.quantity": available.quantity - amount }, { [SPLITTING_OPTION]: true });
    if (getItemQuantity(item) !== available.quantity - amount) throw new Error("Source stack reduction was not confirmed.");
    await trackInventoryItem(actor, newItem.id, config);
    // Another edit might have filled the last slot between the preview and
    // the create call. Never report success for an invisible overflow stack.
    if (getInventoryState(actor, config).placements[newItem.id]?.area !== "inventory") {
      throw new Error("No room for the new stack. Split cancelled.");
    }
    await reconcileInventoryState(actor, config);
    return { item: newItem, amount, remaining: available.quantity - amount };
  } catch (error) {
    // Roll back creation, reduction, and any partially persisted placement so
    // a failed save never silently manufactures duplicates or loses units.
    let rollbackFailed = false;
    try {
      // Inspect actual document state, not a boolean set after an awaited
      // update. A post-update hook may throw after quantity has changed.
      if (getItemQuantity(item) !== available.quantity) {
        try { await item.update({ "system.quantity": available.quantity }, { [SPLITTING_OPTION]: true }); }
        catch (restoreError) {
          if (getItemQuantity(item) !== available.quantity) throw restoreError;
        }
      }
      if (actor.items?.get?.(newItem.id)) {
        try { await actor.deleteEmbeddedDocuments("Item", [newItem.id], { [SPLITTING_OPTION]: true }); }
        catch (deleteError) {
          if (actor.items?.get?.(newItem.id)) throw deleteError;
        }
        if (actor.items?.get?.(newItem.id)) throw new Error("Split copy still exists after rollback.");
      }
    } catch (rollbackError) {
      rollbackFailed = true;
      console.error(`${MODULE_ID} | Stack split rollback failed. Check both stacks before retrying.`, rollbackError);
    }
    if (rollbackFailed) {
      throw new Error("Unstack failed and rollback could not complete. Check your inventory before retrying.", { cause: error });
    }
    // Reconciliation is best-effort during rollback: for example, an Actor
    // unable to persist placements will also reject an immediate repair.
    try { await reconcileInventoryState(actor, config); }
    catch (reconcileError) {
      console.warn(`${MODULE_ID} | Split rolled back but inventory reconciliation was deferred.`, reconcileError);
    }
    throw error;
  }
}

export async function splitItemStack(actor, item, requestedAmount, config = getSheetConfig()) {
  return withActorStackMutation(actor, () => splitItemStackUnlocked(actor, item, requestedAmount, config));
}
