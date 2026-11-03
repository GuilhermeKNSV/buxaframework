import { validStackQuantity } from './stack-quantity.js';
import { validateItemRuleCapacity } from './item-rule-capacity.js';
import {withActorStackMutation} from './actor-transactions.js';
import { MODULE_ID } from "./constants.js";
import { getSheetConfig } from "./config.js";
import { getActorLevel } from "./leveling.js";
import { getItemQuantity } from "./dnd5e.js";
import { getItemRules, getItemRarity, normalizeItemRules, rarityPresentation } from "./item-config.js";
import { sameStackType, stackRoom } from "./stack-capacity.js";

const ITEM_FLAG = "item";
const INSTANCE_FLAG = "itemInstance";
const INSTANCE_VERSION = 1;

function isActorDocument(document) {
  return document?.documentName === "Actor" || document?.constructor?.name === "Actor";
}

export function isEmbeddedActorItem(item) {
  return Boolean(item && isActorDocument(item.parent));
}

function rawItemRules(item) {
  return item?.getFlag?.(MODULE_ID, ITEM_FLAG);
}

function rawInstanceData(item) {
  const raw = item?.getFlag?.(MODULE_ID, INSTANCE_FLAG);
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
}

export function getItemOriginUuid(item) {
  const explicit = String(rawInstanceData(item).originUuid || "").trim();
  if (explicit) return explicit;
  const sourceId = String(item?.getFlag?.("core", "sourceId") || item?._stats?.compendiumSource || "").trim();
  return sourceId;
}

function createInstanceData(item, source = null, { freshIdentity = false } = {}) {
  const current = rawInstanceData(item);
  const sourceInstance = rawInstanceData(source);
  const originUuid = String(
    sourceInstance.originUuid
      || source?.uuid
      || getItemOriginUuid(source)
      || current.originUuid
      || getItemOriginUuid(item)
      || ""
  ).trim();
  return {
    version: INSTANCE_VERSION,
    instanceId: String(freshIdentity ? foundry.utils.randomID(20) : (current.instanceId || foundry.utils.randomID(20))),
    originUuid
  };
}

export function itemUnitWeight(item, config = getSheetConfig()) {
  const rules = getItemRules(item, config);
  return rules.weight.enabled ? Math.max(0, Number(rules.weight.value) || 0) : 0;
}

export function itemTotalWeight(item, config = getSheetConfig()) {
  return itemUnitWeight(item, config) * Math.max(0, getItemQuantity(item));
}

export function getItemVisual(item, config = getSheetConfig()) {
  const rarity = getItemRarity(item, config);
  const presentation = rarityPresentation(rarity, config?.items);
  return { rarity, ...presentation };
}

export function getItemRequirementState(item, actor = item?.parent, config = getSheetConfig()) {
  const rules = getItemRules(item, config);
  if (!rules.levelRequirement.enabled) return { enabled: false, met: true, required: 0, actorLevel: null };
  const actorLevel = isActorDocument(actor) ? getActorLevel(actor, config) : null;
  return {
    enabled: true,
    met: actorLevel !== null && actorLevel >= rules.levelRequirement.level,
    required: rules.levelRequirement.level,
    actorLevel
  };
}

export function canEquipItem(actor, item, slot, config = getSheetConfig()) {
  const rules = getItemRules(item, config);
  if (!rules.equip.enabled) return { ok: false, reason: `${item.name} is not configured as equippable.` };
  const requirement = getItemRequirementState(item, actor, config);
  if (!requirement.met) {
    return { ok: false, reason: `${item.name} requires level ${requirement.required}.` };
  }
  if (!rules.equip.any && !rules.equip.allowedTypes.includes(String(slot?.type || ""))) {
    return { ok: false, reason: `${item.name} cannot be equipped in ${slot?.label || slot?.type || "that slot"}.` };
  }
  return { ok: true, reason: "" };
}

export function canStackItems(source, target, config = getSheetConfig()) {
  if (!source || !target || source === target || (source.uuid && source.uuid === target.uuid)) return false;
  if (!validStackQuantity(source) || !validStackQuantity(target)) return false;
  return getItemQuantity(source) > 0 && sameStackType(source, target, config) && stackRoom(source, target, config) > 0;
}

async function stackActorItemsUnlocked(actor, source, target, { deleteSource = true, config = getSheetConfig() } = {}) {
  if (!actor?.isOwner || !canStackItems(source, target, config)) return null;
  const sourceQuantity = Math.max(1, getItemQuantity(source));
  const targetQuantity = Math.max(0, getItemQuantity(target));
  // Do not merge an embedded document into an unrelated Actor. A successful
  // quantity update followed by an unsuccessful deletion duplicates inventory.
  if (target.parent?.id !== actor.id || (deleteSource && source.parent?.id !== actor.id)) return null;
  // Foundry document methods may annotate operation options with an embedded
  // parent. Never reuse them for the next Item/Actor write or rollback.
  const freshOptions = () => ({ [`${MODULE_ID}.inventory`]: true });
  const accepted = Math.min(sourceQuantity, stackRoom(source, target, config));
  if (accepted <= 0) return null;
  try {
    await target.update({ "system.quantity": targetQuantity + accepted }, freshOptions());
  } catch (error) {
    // An onUpdate hook may throw after Foundry has already applied the write.
    // The original source still exists, so restore the target if necessary.
    if (getItemQuantity(target) !== targetQuantity) {
      try {
        await target.update({ "system.quantity": targetQuantity }, freshOptions());
      } catch (rollbackError) {
        console.error(`${MODULE_ID} | Stack update rollback failed. Check quantities before retrying.`, rollbackError);
        throw new Error("Stack update failed and quantity rollback could not complete. Check both stacks before retrying.", { cause: error });
      }
    }
    throw error;
  }
  if (deleteSource && source.id !== target.id) {
    try {
      if (accepted < sourceQuantity) {
        await source.update({ "system.quantity": sourceQuantity - accepted }, freshOptions());
        if (getItemQuantity(source) !== sourceQuantity - accepted) throw new Error("Source stack quantity was not saved.");
      } else {
        await actor.deleteEmbeddedDocuments("Item", [source.id], freshOptions());
        if (actor.items?.get?.(source.id)) throw new Error(`Could not remove the source stack ${source.name || source.id}.`);
      }
    } catch (error) {
      // Foundry hooks can throw AFTER a deletion succeeds. If the source is
      // already gone, rolling back the target would destroy its quantity.
      if (!actor.items?.get?.(source.id)) {
        console.warn(`${MODULE_ID} | Source stack removed, but a post-delete hook failed.`, error);
        return target;
      }
      try {
        if (getItemQuantity(source) !== sourceQuantity) await source.update({ "system.quantity": sourceQuantity }, freshOptions());
        await target.update({ "system.quantity": targetQuantity }, freshOptions());
      } catch (rollbackError) {
        console.error(`${MODULE_ID} | Stack merge rollback failed. Check quantities before retrying.`, rollbackError);
        throw new Error("Stack merge failed and quantity rollback could not complete. Check both stacks before retrying.", { cause: error });
      }
      throw error;
    }
  }
  return target;
}

async function stackExternalItemUnlocked(actor, source, target, config = getSheetConfig()) {
  if (!actor?.isOwner || !canStackItems(source, target, config)) return null;
  const sourceQuantity = Math.max(1, getItemQuantity(source));
  const targetQuantity = Math.max(0, getItemQuantity(target));
  const accepted = Math.min(sourceQuantity, stackRoom(source, target, config));
  if (!accepted || accepted !== sourceQuantity) return null; // Never lose the unmerged remainder of an external item.
  await target.update({ "system.quantity": targetQuantity + accepted }, { [`${MODULE_ID}.inventory`]: true });
  return target;
}

/**
 * Freeze the Buxa configuration of a source Item onto a newly-created embedded
 * Actor Item. Embedded Items are independent instances: later edits to the
 * world/compendium source never overwrite this snapshot.
 */
export async function snapshotEmbeddedItemFromSource(source, embedded, { config = getSheetConfig(), force = true } = {}) {
  if (!source || !isEmbeddedActorItem(embedded)) return embedded ?? null;
  const update = {};
  const sourceRaw = rawItemRules(source);
  const targetRaw = rawItemRules(embedded);
  if (sourceRaw !== undefined && (force || targetRaw === undefined)) {
    update[`flags.${MODULE_ID}.${ITEM_FLAG}`] = normalizeItemRules(foundry.utils.deepClone(sourceRaw), config.items);
  }
  const currentInstance = rawInstanceData(embedded);
  if (force || !currentInstance.instanceId || !currentInstance.originUuid || Number(currentInstance.version) !== INSTANCE_VERSION) {
    update[`flags.${MODULE_ID}.${INSTANCE_FLAG}`] = createInstanceData(embedded, source, { freshIdentity: force });
  }
  if (Object.keys(update).length) {
    await embedded.update(update, { [`${MODULE_ID}.itemSnapshot`]: true });
  }
  return embedded;
}

/**
 * Repair legacy embedded Items which were created before Buxa stored an
 * explicit per-instance snapshot. Existing instance rules are NEVER replaced.
 * Missing rules are restored only when Foundry provides a concrete source UUID.
 */
export async function hydrateActorItemSnapshots(actor, config = getSheetConfig()) {
  if (!actor?.isOwner) return 0;
  const updates = [];
  for (const item of actor.items ?? []) {
    if (item.getFlag?.(MODULE_ID, 'isCondition') === true) continue;
    const update = { _id: item.id };
    let changed = false;
    const currentRaw = rawItemRules(item);
    const currentInstance = rawInstanceData(item);
    const originUuid = getItemOriginUuid(item);

    if (currentRaw === undefined && originUuid) {
      try {
        const source = await fromUuid(originUuid);
        const sourceRaw = source?.documentName === "Item" ? rawItemRules(source) : undefined;
        if (sourceRaw !== undefined) {
          update[`flags.${MODULE_ID}.${ITEM_FLAG}`] = normalizeItemRules(foundry.utils.deepClone(sourceRaw), config.items);
          changed = true;
        }
      } catch (error) {
        console.warn(`${MODULE_ID} | Could not restore Buxa Item data for ${item.name}.`, error);
      }
    }

    if (!currentInstance.instanceId || Number(currentInstance.version) !== INSTANCE_VERSION || (!currentInstance.originUuid && originUuid)) {
      update[`flags.${MODULE_ID}.${INSTANCE_FLAG}`] = createInstanceData(item);
      changed = true;
    }
    if (changed) updates.push(update);
  }
  if (!updates.length) return 0;
  await actor.updateEmbeddedDocuments("Item", updates, { [`${MODULE_ID}.itemSnapshot`]: true });
  return updates.length;
}

export async function saveItemRules(item, data, config = getSheetConfig()) {
  if (!item || !game.user.isGM) return null;
  // A seemingly unrelated control/edit must not delete rules past the legacy
  // normalizers' hard limits, even if those rules were already on the Item.
  validateItemRuleCapacity(rawItemRules(item));
  validateItemRuleCapacity(data);
  const normalized = normalizeItemRules(data, config.items);
  if (normalized.multiple.enabled && !normalized.multiple.stackKey) {
    normalized.multiple.stackKey = foundry.utils.randomID(20);
  }
  const update = {
    name: String(data?.name ?? item.name).trim() || item.name,
    img: String(data?.img ?? item.img ?? "icons/svg/item-bag.svg").trim() || "icons/svg/item-bag.svg",
    [`flags.${MODULE_ID}.${ITEM_FLAG}`]: normalized
  };
  if (data?.usageUsed !== undefined && isEmbeddedActorItem(item)) {
    update[`flags.${MODULE_ID}.itemUsage`] = {used:Math.max(0,Math.min(999999,Math.round(Number(data.usageUsed)||0)))};
  }
  if (isEmbeddedActorItem(item)) {
    update[`flags.${MODULE_ID}.${INSTANCE_FLAG}`] = createInstanceData(item);
  }
  await item.update(update, { [`${MODULE_ID}.itemConfig`]: true });
  return normalized;
}

export async function stackActorItems(actor, source, target, options = {}) {
  return withActorStackMutation(actor, () => stackActorItemsUnlocked(actor, source, target, options));
}
export async function stackExternalItem(actor, source, target, config = getSheetConfig()) {
  return withActorStackMutation(actor, () => stackExternalItemUnlocked(actor, source, target, config));
}
