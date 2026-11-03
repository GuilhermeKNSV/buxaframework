import { notifyWarning } from "./notifications.js";
import { emitProgressHook } from "./progression-safety.js";
import { HOOKS, MODULE_ID, IS_CONDITION_FLAG } from "./constants.js";
import { getSheetConfig } from "./config.js";
import { normalizeInventoryConfig } from "./inventory-config.js";
import { safeGridIndex } from "./numeric-field.js";
import { normalizeItemShape, canPlaceShape, firstFitShape, packShapes, gridDimensions, createPlacementScanner, firstFitAdditionalShape } from "./inventory-shapes.js";
import { getItemQuantity, synchronizeInventoryEquippedStates } from "./dnd5e.js";
import { getItemRarity, getItemRules } from "./item-config.js";
import { buildStorageGrants, fitsExternalStorage, storageProviderId } from "./item-storage.js";
import { resolveAutomaticStorageDrop } from "./external-storage-placement.js";
import { canEquipItem } from "./item-runtime.js";
import { reconcileResourceItemIncreaseBounds } from "./resources.js";

const FLAG_PATH = "inventory";
const UPDATE_OPTION = `${MODULE_ID}.inventory`;
/* Re-read inside the queue, not before it: two concurrent inventory actions
 * must not save independently modified snapshots of the same Actor flag. */
const inventoryWrites = new Map();
const inventoryPending = new Map();
const MAX_PENDING_INVENTORY_MUTATIONS = 128;
export function withInventoryMutation(actor, work) {
  const id = String(actor?.uuid || actor?.id || '');
  if (!id) return Promise.reject(Error('Cannot mutate inventory without an Actor ID.'));
  const count = inventoryPending.get(id) || 0;
  if (count >= MAX_PENDING_INVENTORY_MUTATIONS)
    return Promise.reject(Error('Too many pending inventory actions. Wait for earlier operations to finish.'));
  inventoryPending.set(id, count + 1);
  const prior = inventoryWrites.get(id) || Promise.resolve();
  const run = prior.catch(() => {}).then(work);
  const done = run.catch(() => {});
  inventoryWrites.set(id, done);
  void done.finally(() => {
    if (inventoryWrites.get(id) === done) inventoryWrites.delete(id);
    const left = (inventoryPending.get(id) || 1) - 1;
    if (left > 0) inventoryPending.set(id, left);
    else inventoryPending.delete(id);
  });
  return run;
}

function shapeMap(actor) {
  return Object.fromEntries([...(actor?.items ?? [])].map(item => [item.id,
    normalizeItemShape(item.getFlag?.(MODULE_ID,"item")?.shape)]));
}
function isComplex(config) { return config.mode === "complex"; }
/** Derive storage capacity from the equipped loadout, without mutating world config. */
export function getActorStorage(actor, config = getSheetConfig(), saved = null, equipmentSlots = null) {
  const raw = saved || actor?.getFlag?.(MODULE_ID, FLAG_PATH) || {};
  const slotsById = new Map((equipmentSlots || normalizeInventoryConfig(config.inventory).equipmentLayout.slots)
    .map(slot => [slot.id, slot]));
  const grants=buildStorageGrants(actor, raw.placements || {}, raw.equipmentActive || {},
    item => getItemRules(item, config), (_item, placement) => {
      const slot = slotsById.get(String(placement.slotId || ""));
      const position = Number(placement.position ?? 0);
      return Boolean(slot && Number.isInteger(position) && position >= 0 && position < slot.capacity);
    });
  // Each compartment may override item occupancy independently of its shape.
  // Older saved pouches inherit the Actor mode without a data migration.
  const inheritedMode=config?.inventory?.mode==='complex'?'complex':'simple';
  return {...grants,compartments:grants.compartments.map(bag=>({
    ...bag,itemMode:bag.itemMode==='simple'||bag.itemMode==='complex'?bag.itemMode:inheritedMode
  }))};
}
function actorInventoryConfig(actor, config, saved = null) {
  const inventory = normalizeInventoryConfig(config.inventory);
  const grants = getActorStorage(actor, config, saved, inventory.equipmentLayout.slots);
  if (inventory.mode === 'simple') inventory.slots = Math.min(1000, inventory.slots + grants.additional);
  else {
    const originalCells=inventory.complex.rows*inventory.complex.columns;
    inventory.complex.rows=Math.min(80,inventory.complex.rows+Math.ceil(grants.additional/inventory.complex.columns));
    inventory.complex.activeCells=Math.min(inventory.complex.rows*inventory.complex.columns,originalCells+grants.additional);
  }
  return { inventory, grants };
}
export function getEffectiveInventoryConfig(actor, config = getSheetConfig()) {
  return actorInventoryConfig(actor,config).inventory;
}

function actorItemIds(actor) {
  return new Set([...(actor?.items ?? [])].filter(item=>item?.getFlag?.(MODULE_ID,IS_CONDITION_FLAG)!==true).map((item) => item.id));
}

/** Refuse an equipment/loadout switch that would leave *other* items beyond
 * the smaller inventory granted by the old backpack. No read-time relocation
 * and no silent overflow: the user can move those items first. */
function preservesInventoryCapacity(actor, beforeState, nextState, config) {
  const prior = actorInventoryConfig(actor, config, beforeState).inventory;
  const current = actorInventoryConfig(actor, config, nextState).inventory;
  const oldCells = isComplex(prior) ? prior.complex.activeCells : prior.slots;
  const newCells = isComplex(current) ? current.complex.activeCells : current.slots;
  if (newCells >= oldCells) return true;
  const placements = Object.entries(nextState.placements)
    .filter(([, location]) => location?.area === 'inventory');
  if (!isComplex(current)) {
    return placements.every(([, location]) => Number.isSafeInteger(location.index) &&
      location.index >= 0 && location.index < current.slots);
  }
  const scan = createPlacementScanner(shapeMap(actor), current.complex);
  for (const [itemId, location] of placements) {
    if (!scan.fits(itemId, location.index, location.rotation || 0)) return false;
    scan.occupy(itemId, location.index, location.rotation || 0);
  }
  return true;
}

function equipmentSlotMap(inventoryConfig) {
  return new Map(inventoryConfig.equipmentLayout.slots.map((slot) => [slot.id, slot]));
}

function asPosition(value, fallback = 0) {
  const number = Number(value);
  return Number.isInteger(number) ? number : fallback;
}

function locationKey(location) {
  if (location?.area === "inventory") return `inventory:${location.index}`;
  if (location?.area === "equipment") return `equipment:${location.slotId}:${location.position ?? 0}`;
  if (location?.area === "storage") return `storage:${location.storageId}:${location.index}`;
  return "";
}

function cloneLocation(location) {
  if (location?.area === "inventory") {
    const index = safeGridIndex(location.index);
    return index === null ? null : { area: "inventory", index,
      ...(location.rotation ? { rotation: ((Math.trunc(Number(location.rotation) || 0) % 4) + 4) % 4 } : {}) };
  }
  if (location?.area === "storage") {
    const index = safeGridIndex(location.index);
    return index === null ? null : {area:"storage",storageId:String(location.storageId||""),index,
      rotation:((Math.trunc(Number(location.rotation)||0)%4)+4)%4};
  }
  if (location?.area === "equipment") {
    const supplied=location.position;
    const value=supplied === undefined || supplied === null ? 0 :
      (typeof supplied === 'number' || (typeof supplied === 'string' && supplied.trim()) ? Number(supplied) : NaN);
    if (!Number.isSafeInteger(value) || value < 0) return null;
    return {
      area: "equipment",
      slotId: String(location.slotId || ""),
      position: value
    };
  }
  return null;
}

function validLocation(location, inventoryConfig, slotsById, grants = null) {
  if (location?.area === "storage") {
    const bag=grants?.compartments.find(e=>e.storageId===location.storageId);
    // The saved index is the bounding-box origin, not necessarily an occupied
    // cell. An irregular footprint can have an empty top-left corner (for
    // example a rotated L), which may lie outside a shaped pouch's mask.
    // Check only index bounds here: fitsExternalStorage below validates ALL
    // actually occupied cells against the mask and other items. Requiring
    // the origin in bag.cells disagrees with the ground chest grid and makes
    // valid closed-container pickups fail or send items to Overflow.
    return Boolean(bag && Number.isInteger(location.index) && location.index>=0 && location.index<bag.columns*bag.rows);
  }
  if (location?.area === "inventory") {
    const index = Number(location.index);
    return Number.isInteger(index) && index >= 0 && index < (isComplex(inventoryConfig) ? (inventoryConfig.complex.activeCells??inventoryConfig.complex.columns*inventoryConfig.complex.rows) : inventoryConfig.slots);
  }
  if (location?.area !== "equipment") return false;
  const slot = slotsById.get(String(location.slotId || ""));
  if (!slot) return false;
  const position = asPosition(location.position, 0);
  return position >= 0 && position < slot.capacity;
}

function normalizeEquipmentActive(raw, slotsById) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const active = {};
  for (const [slotId, slot] of slotsById) {
    const requested = asPosition(source[slotId], 0);
    active[slotId] = Math.min(slot.capacity - 1, Math.max(0, requested));
  }
  return active;
}

function compactInventoryState(state, inventoryConfig) {
  const inventoryIds = state.tracked
    .filter((itemId) => state.placements[itemId]?.area === "inventory")
    .sort((a, b) => Number(state.placements[a]?.index ?? 0) - Number(state.placements[b]?.index ?? 0));
  const overflowIds = state.tracked.filter((itemId) => !state.placements[itemId]);
  const ordered = [...inventoryIds, ...overflowIds];
  ordered.forEach((itemId, index) => {
    if (index < inventoryConfig.slots) state.placements[itemId] = { area: "inventory", index };
    else delete state.placements[itemId];
  });
  return state;
}

export function getInventoryState(actor, config = getSheetConfig()) {
  const raw = actor?.getFlag?.(MODULE_ID, FLAG_PATH);
  const {inventory:inventoryConfig,grants} = actorInventoryConfig(actor, config, raw);
  const stored = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const existingIds = actorItemIds(actor);
  const slotsById = equipmentSlotMap(inventoryConfig);
  const storedPlacements = stored.placements && typeof stored.placements === "object" &&
    !Array.isArray(stored.placements) ? stored.placements : {};
  const requestedTracked = Array.isArray(stored.tracked) ? stored.tracked.map(String) : [];
  const tracked = [...new Set([...requestedTracked, ...Object.keys(storedPlacements)])].filter((id) => existingIds.has(id));
  const placements = {};
  const occupied = new Set();
  const shapes = isComplex(inventoryConfig) ? shapeMap(actor) : null;
  // A Complex compartment may exist in a Simple Actor inventory. Its items
  // still require their real shape to validate all occupied cells.
  const externalShapes=shapes || (grants.compartments.some(bag=>bag.itemMode==='complex') ? shapeMap(actor) : {});
  const shapeScanner = shapes ? createPlacementScanner(shapes, inventoryConfig.complex) : null;

  for (const itemId of tracked) {
    const location = cloneLocation(storedPlacements[itemId]);
    if (!validLocation(location, inventoryConfig, slotsById, grants)) continue;
    if (location.area==='equipment' && slotsById.get(location.slotId)?.hidden && !grants.unlocked.has(location.slotId)) continue;
    if (location.area === "storage") {
      const bag=grants.compartments.find(e=>e.storageId===location.storageId);
      if (!fitsExternalStorage(bag, placements, externalShapes, itemId, location.index, location.rotation||0)) continue;
    }
    const key = locationKey(location);
    if (!key) continue;
    // In Complex grids, the saved index is the *bounding-box origin*, which
    // need not be an occupied cell (an L-shape can have an empty top-left).
    // Two non-overlapping shapes may therefore legitimately share an origin.
    // Storage is already checked above by fitsExternalStorage against every
    // occupied cell; the main Complex grid uses shapeScanner for the same job.
    // Only equipment and Simple inventory require a one-item-per-origin key.
    const originIsExclusive = location.area === "equipment" ||
      (location.area === "inventory" && !shapeScanner);
    if (originIsExclusive && occupied.has(key)) continue;
    if (shapeScanner && location.area === "inventory") {
      if (!shapeScanner.fits(itemId, location.index, location.rotation || 0)) continue;
      shapeScanner.occupy(itemId, location.index, location.rotation || 0);
    }
    if (originIsExclusive) occupied.add(key);
    placements[itemId] = location;
  }

  // Assign first-fit locations only to newly introduced or legacy items.
  // When a v4+ saved Complex placement conflicts with a shape edited later,
  // do NOT teleport an existing item to a different square during a read.
  // Leave it in Overflow until explicitly placed. This prevents a nearby
  // glove/chest from moving unexpectedly while fitting another footprint.
  if (shapes) for (const itemId of tracked) {
    if (placements[itemId] || ["equipment","storage"].includes(storedPlacements[itemId]?.area)) continue;
    if (storedPlacements[itemId] && Number(stored.version) >= 4) continue;
    const rotation=Number(storedPlacements[itemId]?.rotation)||0;
    const index=shapeScanner.firstFit(itemId, rotation);
    if(index!==null){
      placements[itemId]={area:"inventory",index,rotation};
      shapeScanner.occupy(itemId,index,rotation);
    }
  }
    const allowedSortModes = new Set(["quantity", "alphabetic", "rarity"]);
  const state = {
    version: 4,
    autoSort: (!isComplex(inventoryConfig) || inventoryConfig.complex.autoSort) && (stored.autoSort === true || (stored.autoSort == null && isComplex(inventoryConfig) && inventoryConfig.complex.autoSort)),
    sortMode: allowedSortModes.has(stored.sortMode) ? stored.sortMode : "alphabetic",
    tracked,
    placements,
    equipmentActive: normalizeEquipmentActive(stored.equipmentActive, slotsById)
  };
  return state.autoSort ? sortInventoryState(actor, state, state.sortMode, config, inventoryConfig) : state;
}

async function persistState(actor, state) {
  // Foundry re-renders every open Actor sheet after an Actor flag write.
  // Skip writes that would only reproduce the same inventory state.
  const current = actor.getFlag?.(MODULE_ID, FLAG_PATH);
  if (current && typeof foundry.utils.equals === 'function' && foundry.utils.equals(current, state)) return state;
  await actor.update({ [`flags.${MODULE_ID}.${FLAG_PATH}`]: state }, { [UPDATE_OPTION]: true });
  emitProgressHook(HOOKS.INVENTORY_UPDATED, actor, state);
  return state;
}

function occupantAt(state, destination, exceptItemId = null) {
  const wanted = locationKey(destination);
  if (!wanted) return null;
  return state.tracked.find((itemId) => itemId !== exceptItemId && locationKey(state.placements[itemId]) === wanted) ?? null;
}

function firstFreeInventoryIndex(state, inventoryConfig, ignoredItemIds = new Set(), actor = null, movingId = null) {
  if (isComplex(inventoryConfig) && actor && movingId) return firstFitShape(state.placements,shapeMap(actor),movingId,0,inventoryConfig.complex);
  const occupied = new Set();
  for (const itemId of state.tracked) {
    if (ignoredItemIds.has(itemId)) continue;
    const placement = state.placements[itemId];
    if (placement?.area === "inventory") occupied.add(Number(placement.index));
  }
  for (let index = 0; index < (isComplex(inventoryConfig) ? (inventoryConfig.complex.activeCells??inventoryConfig.complex.columns*inventoryConfig.complex.rows) : inventoryConfig.slots); index += 1) {
    if (!occupied.has(index)) return index;
  }
  return null;
}

function ensureTracked(state, itemId) {
  if (!state.tracked.includes(itemId)) state.tracked.push(itemId);
}

function isEffectivelyEquipped(state, itemId) {
  const placement = state.placements[itemId];
  if (placement?.area !== "equipment") return false;
  return Number(placement.position ?? 0) === Number(state.equipmentActive?.[placement.slotId] ?? 0);
}

async function syncChangedEquippedStates(actor, beforeState, afterState, itemIds) {
  const changes = [];
  for (const itemId of itemIds) {
    const wasEquipped = isEffectivelyEquipped(beforeState, itemId);
    const isEquipped = isEffectivelyEquipped(afterState, itemId);
    if (wasEquipped !== isEquipped) changes.push({ itemId, equipped: isEquipped });
  }
  if (changes.length) await synchronizeInventoryEquippedStates(actor, changes);
}

/** Compensate a failed equipped-state sync while we still hold the Actor
 * queue. This handles local rejected hooks; an unexpected process crash still
 * needs a journal/GM reconciliation. */
async function persistEquippedMutation(actor, beforeState, afterState, changedIds, config) {
  try {
    await persistState(actor, afterState);
    await syncChangedEquippedStates(actor, beforeState, afterState, changedIds);
    await reconcileResourceItemIncreaseBounds(actor, config);
  } catch (error) {
    try {
      const live = actor.getFlag?.(MODULE_ID, FLAG_PATH);
      // Don't overwrite a third-party edit that appeared after the failed write.
      if (!foundry.utils.equals?.(live, afterState)) throw Error('Inventory changed during rollback.');
      await persistState(actor, beforeState);
      await syncChangedEquippedStates(actor, afterState, beforeState, changedIds);
      await reconcileResourceItemIncreaseBounds(actor, config);
    } catch (rollbackError) {
      console.error(`${MODULE_ID} | Inventory/equipped state needs manual reconciliation`, rollbackError);
      throw new Error('Inventory update failed and rollback needs review. Check equipped Items and resources.', {cause:error});
    }
    throw error;
  }
  return afterState;
}

function resolvedDestination(destination, state, inventoryConfig, slotsById, grants) {
  const next = cloneLocation(destination);
  if (next?.area === "equipment") {
    next.position = destination?.position === undefined
      ? Number(state.equipmentActive?.[next.slotId] ?? 0)
      : asPosition(destination.position, 0);
  }
  return validLocation(next, inventoryConfig, slotsById, grants) ? next : null;
}

/** Prevent dropping a container into one of its own nested compartments. */
export function wouldNestBackpackInItself(placements,itemId,destination) {
  if(destination?.area!=='storage')return false;
  let provider=storageProviderId(destination.storageId);
  const visited=new Set();
  while(provider && !visited.has(provider)) {
    if(provider===itemId)return true;
    visited.add(provider);
    const location=placements?.[provider];
    provider=location?.area==='storage'?storageProviderId(location.storageId):null;
  }
  return false;
}

async function moveInventoryItemUnlocked(actor, itemId, destination, config = getSheetConfig()) {
  if (!actor?.isOwner || !actor.items?.get?.(itemId)) return null;
  const {inventory: inventoryConfig, grants} = actorInventoryConfig(actor, config);
  const slotsById = equipmentSlotMap(inventoryConfig);
  const state = getInventoryState(actor, config);
  // Only Complex-occupancy storage requires the item's complete shape map.
  // In particular, a Simple Actor can carry a Complex pouch; passing no
  // shapes here used to pick a free *single* cell and reject the real item.
  const autoBag = destination?.area === "storage" && destination.auto === true
    ? grants.compartments.find(bag => bag.storageId === destination.storageId) : null;
  const requestedDestination = resolveAutomaticStorageDrop(destination, {
    compartments: grants.compartments, placements: state.placements,
    shapes: autoBag?.itemMode === "complex" ? shapeMap(actor) : {}, itemId
  });
  const nextDestination = resolvedDestination(requestedDestination, state, inventoryConfig, slotsById, grants);
  if (!nextDestination || wouldNestBackpackInItself(state.placements,itemId,nextDestination)) return null;
  if (isComplex(inventoryConfig) && nextDestination.area === "inventory") {
    const rotation=((Number(destination.rotation ?? state.placements[itemId]?.rotation ?? 0) || 0)%4+4)%4;
    nextDestination.rotation=rotation;
    if (!canPlaceShape(state.placements, shapeMap(actor), itemId, nextDestination.index, rotation, inventoryConfig.complex)) return null;
  }

  if (nextDestination.area === "storage") {
    const compartment=grants.compartments.find(b=>b.storageId===nextDestination.storageId);
    if (!fitsExternalStorage(compartment,state.placements,shapeMap(actor),itemId,nextDestination.index,nextDestination.rotation||0)) return null;
  }
  if (nextDestination.area === "equipment") {
    if (slotsById.get(nextDestination.slotId)?.hidden && !grants.unlocked.has(nextDestination.slotId)) return null;
    const item = actor.items.get(itemId);
    const slot = slotsById.get(nextDestination.slotId);
    const allowed = canEquipItem(actor, item, slot, config);
    if (!allowed.ok) {
      notifyWarning(allowed.reason);
      return null;
    }
  }

  const beforeState = foundry.utils.deepClone(state);
  ensureTracked(state, itemId);
  const source = cloneLocation(state.placements[itemId]);
  if (source && locationKey(source) === locationKey(nextDestination) && Number(source.rotation||0) === Number(nextDestination.rotation||0)) return state;
  const displacedId = (isComplex(inventoryConfig) && nextDestination.area === "inventory") || nextDestination.area === "storage" ? null : occupantAt(state, nextDestination, itemId);
  state.placements[itemId] = nextDestination;

  if (displacedId) {
    let canUseSource = Boolean(source && validLocation(source, inventoryConfig, slotsById, grants));
    if (canUseSource && source.area === "equipment") {
      const displacedItem = actor.items.get(displacedId);
      const sourceSlot = slotsById.get(source.slotId);
      canUseSource = Boolean(displacedItem && sourceSlot && canEquipItem(actor, displacedItem, sourceSlot, config).ok);
    }
    if (canUseSource && source?.area === "storage") {
      const bag = grants.compartments.find(compartment => compartment.storageId === source.storageId);
      const withoutDisplaced = {...state.placements};
      delete withoutDisplaced[displacedId];
      canUseSource = fitsExternalStorage(bag, withoutDisplaced, shapeMap(actor), displacedId,
        source.index, source.rotation || 0);
    }
    if (canUseSource && isComplex(inventoryConfig) && source?.area === "inventory") {
      const withoutDisplaced={...state.placements};delete withoutDisplaced[displacedId];
      canUseSource=canPlaceShape(withoutDisplaced,shapeMap(actor),displacedId,source.index,source.rotation||0,inventoryConfig.complex);
    }
    if (canUseSource) {
      state.placements[displacedId] = source;
    } else {
      const freeIndex = firstFreeInventoryIndex(state, inventoryConfig, new Set([displacedId]), actor, displacedId);
      if (freeIndex === null) delete state.placements[displacedId];
      else state.placements[displacedId] = { area: "inventory", index: freeIndex };
    }
  }

  // Removing a bag from equipment can reduce the main grid immediately.
  // Never persist the backpack in a now-inaccessible bonus cell: relocate it
  // into the remaining grid or reject the move, leaving its equipped state and
  // contained item placements untouched.
  if(source?.area==='equipment' && nextDestination.area==='inventory') {
    const remaining=actorInventoryConfig(actor,config,state).inventory;
    const rotated=Number(state.placements[itemId]?.rotation||0);
    const valid=validLocation(state.placements[itemId],remaining,slotsById) &&
      (!isComplex(remaining) || canPlaceShape(
        Object.fromEntries(Object.entries(state.placements).filter(([id])=>id!==itemId)),
        shapeMap(actor),itemId,state.placements[itemId].index,rotated,remaining.complex));
    if(!valid) {
      const free=firstFreeInventoryIndex(state,remaining,new Set([itemId]),actor,itemId);
      if(free===null)return null;
      state.placements[itemId]={area:'inventory',index:free,...(rotated?{rotation:rotated}:{})};
    }
  }

  // A deliberate Complex placement must be authoritative. Auto-packing here (or
  // on the next state read) silently relocates the dropped item after its valid
  // preview was shown. Turn off automatic packing until the user re-enables it.
  if (isComplex(inventoryConfig) && nextDestination.area === "inventory") state.autoSort = false;
  // External storage has a different grid and should never modify the Actor's
  // unrelated main-inventory auto-sort preference.
  else if (state.autoSort) sortInventoryState(actor, state, state.sortMode, config, inventoryConfig);
  if (!preservesInventoryCapacity(actor, beforeState, state, config)) {
    notifyWarning('Move items out of bonus backpack cells before removing the equipped storage.');
    return null;
  }
  await persistEquippedMutation(actor, beforeState, state, new Set([itemId, displacedId].filter(Boolean)), config);
  if (displacedId && !state.placements[displacedId])
    notifyWarning('An equipped item did not fit and was moved into Inventory Overflow.');
  return state;
}


/**
 * A split stack needs a real free inventory cell. Overflow is not a substitute
 * for a second visible stack, and equipped slots cannot be used for the copy.
 */
export function getFreeInventorySlotIndex(actor, config = getSheetConfig(), itemId = null) {
  const inventoryConfig = actorInventoryConfig(actor, config).inventory;
  const state = getInventoryState(actor, config);
  // This API finds space for a NEW stack. Unlike moving an existing item,
  // the source item MUST continue occupying every one of its cells.
  if (isComplex(inventoryConfig)) {
    const shapes = shapeMap(actor);
    // Without an item template, find a genuinely vacant 1×1 cell; every
    // existing shaped item's full footprint still blocks its occupied cells.
    const templateId = itemId && shapes[itemId] ? itemId : "__buxa_new_single_cell__";
    return firstFitAdditionalShape(state.placements, shapes, templateId, inventoryConfig.complex);
  }
  return firstFreeInventoryIndex(state, inventoryConfig);
}

async function trackInventoryItemUnlocked(actor, itemId, config = getSheetConfig()) {
  if (!actor?.isOwner || !actor.items?.get?.(itemId) ||
      actor.items.get(itemId)?.getFlag?.(MODULE_ID,IS_CONDITION_FLAG)===true) return null;
  const inventoryConfig = actorInventoryConfig(actor, config).inventory;
  const state = getInventoryState(actor, config);
  ensureTracked(state, itemId);
  if (!state.placements[itemId]) {
    const freeIndex = firstFreeInventoryIndex(state, inventoryConfig, new Set([itemId]), actor, itemId);
    if (freeIndex !== null) state.placements[itemId] = { area: "inventory", index: freeIndex };
  }
  if (state.autoSort) sortInventoryState(actor, state, state.sortMode, config, inventoryConfig);
  await persistState(actor, state);
  return state;
}

async function setEquipmentActivePositionUnlocked(actor, slotId, position, config = getSheetConfig()) {
  if (!actor?.isOwner) return null;
  const inventoryConfig = actorInventoryConfig(actor, config).inventory;
  const slotsById = equipmentSlotMap(inventoryConfig);
  const slot = slotsById.get(String(slotId || ""));
  if (!slot) return null;

  const state = getInventoryState(actor, config);
  const beforeState = foundry.utils.deepClone(state);
  const next = Math.min(slot.capacity - 1, Math.max(0, asPosition(position, 0)));
  if (Number(state.equipmentActive?.[slot.id] ?? 0) === next) return state;
  state.equipmentActive[slot.id] = next;
  if (!preservesInventoryCapacity(actor, beforeState, state, config)) {
    notifyWarning('This equipment position removes backpack space still used by other Items. Clear those cells first.');
    return null;
  }

  const affected = new Set(state.tracked.filter((itemId) => state.placements[itemId]?.slotId === slot.id));
  await persistEquippedMutation(actor, beforeState, state, affected, config);
  return state;
}

export async function cycleEquipmentSlot(actor, slotId, direction = 1, config = getSheetConfig()) {
  return withInventoryMutation(actor, async () => {
    const inventoryConfig = normalizeInventoryConfig(config.inventory);
    const slot = inventoryConfig.equipmentLayout.slots.find((entry) => entry.id === slotId);
    if (!slot || slot.capacity <= 1) return null;
    // Read the latest committed active position *inside* the Actor mutation
    // queue, otherwise rapid click cycles all advance the same old position.
    const state = getInventoryState(actor, config);
    const current = Number(state.equipmentActive?.[slotId] ?? 0);
    const delta = Number(direction) < 0 ? -1 : 1;
    const next = (current + delta + slot.capacity) % slot.capacity;
    return setEquipmentActivePositionUnlocked(actor, slotId, next, config);
  });
}


function inventorySortComparator(actor, mode, config) {
  const rarityOrder = new Map((config?.items?.rarities ?? []).map((rarity, index) => [String(rarity?.id || ""), index]));
  const itemFor = (itemId) => actor.items?.get?.(itemId);
  const byName = (aId, bId) => {
    const a = String(itemFor(aId)?.name || "");
    const b = String(itemFor(bId)?.name || "");
    return a.localeCompare(b, game?.i18n?.lang || undefined, { sensitivity: "base", numeric: true });
  };
  if (mode === "quantity") {
    return (aId, bId) => {
      const quantityDiff = getItemQuantity(itemFor(bId)) - getItemQuantity(itemFor(aId));
      return quantityDiff || byName(aId, bId) || String(aId).localeCompare(String(bId));
    };
  }
  if (mode === "rarity") {
    return (aId, bId) => {
      const aRarity = getItemRarity(itemFor(aId), config);
      const bRarity = getItemRarity(itemFor(bId), config);
      const aRank = rarityOrder.get(String(aRarity?.id || "")) ?? -1;
      const bRank = rarityOrder.get(String(bRarity?.id || "")) ?? -1;
      return (bRank - aRank) || byName(aId, bId) || String(aId).localeCompare(String(bId));
    };
  }
  return (aId, bId) => byName(aId, bId) || String(aId).localeCompare(String(bId));
}

function sortInventoryState(actor, state, mode, config, inventoryConfig = normalizeInventoryConfig(config.inventory)) {
  const allowedModes = new Set(["quantity", "alphabetic", "rarity"]);
  const sortMode = allowedModes.has(mode) ? mode : "alphabetic";
  const bagItemIds = state.tracked.filter((itemId) => !["equipment","storage"].includes(state.placements[itemId]?.area));
  bagItemIds.sort(inventorySortComparator(actor, sortMode, config));
  if (isComplex(inventoryConfig)) {
    const rotations=Object.fromEntries(bagItemIds.map(id=>[id,state.placements[id]?.rotation||0]));
    for(const id of bagItemIds)delete state.placements[id];
    Object.assign(state.placements,packShapes(bagItemIds,shapeMap(actor),inventoryConfig.complex,rotations));
    state.sortMode=sortMode;
    return state;
  }
  for (const itemId of bagItemIds) delete state.placements[itemId];
  bagItemIds.forEach((itemId, index) => {
    if (index < inventoryConfig.slots) state.placements[itemId] = { area: "inventory", index };
  });
  state.sortMode = sortMode;
  return state;
}

async function setInventoryAutoSortUnlocked(actor, enabled, config = getSheetConfig()) {
  if (!actor?.isOwner) return null;
  const inventoryConfig = actorInventoryConfig(actor, config).inventory;
  const state = getInventoryState(actor, config);
  const requested = Boolean(enabled) && (!isComplex(inventoryConfig) || inventoryConfig.complex.autoSort);
  if (state.autoSort === requested) return state;
  state.autoSort = requested;
  if (state.autoSort) sortInventoryState(actor, state, state.sortMode, config, inventoryConfig);
  return persistState(actor, state);
}

async function setInventorySortModeUnlocked(actor, mode = "alphabetic", config = getSheetConfig()) {
  if (!actor?.isOwner) return null;
  const allowedModes = new Set(["quantity", "alphabetic", "rarity"]);
  const sortMode = allowedModes.has(mode) ? mode : "alphabetic";
  const inventoryConfig = actorInventoryConfig(actor, config).inventory;
  const state = getInventoryState(actor, config);
  if (state.sortMode === sortMode) return state;
  state.sortMode = sortMode;
  if (state.autoSort && (!isComplex(inventoryConfig) || inventoryConfig.complex.autoSort)) sortInventoryState(actor, state, sortMode, config, inventoryConfig);
  return persistState(actor, state);
}

export async function sortInventoryItems(actor, mode = "alphabetic", config = getSheetConfig()) {
  return setInventorySortMode(actor, mode, config);
}

async function reconcileInventoryStateUnlocked(actor, config = getSheetConfig()) {
  if (!actor?.isOwner) return null;
  const raw = actor.getFlag?.(MODULE_ID, FLAG_PATH);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    // Resource bounds also depend on passive bonuses from items which were
    // never placed in the custom inventory grid.
    await reconcileResourceItemIncreaseBounds(actor, config);
    return null;
  }
  const inventoryConfig = actorInventoryConfig(actor, config).inventory;
  const complex = isComplex(inventoryConfig);
  const beforeState = {
    version: Number(raw.version) || 0,
    autoSort: (!complex || inventoryConfig.complex.autoSort) &&
      (raw.autoSort === true || (raw.autoSort == null && complex && inventoryConfig.complex.autoSort)),
    sortMode: ["quantity", "alphabetic", "rarity"].includes(raw.sortMode) ? raw.sortMode : "alphabetic",
    tracked: Array.isArray(raw.tracked) ? [...raw.tracked] : [],
    placements: raw.placements && typeof raw.placements === "object" ? foundry.utils.deepClone(raw.placements) : {},
    equipmentActive: raw.equipmentActive && typeof raw.equipmentActive === "object"
      ? foundry.utils.deepClone(raw.equipmentActive)
      : {}
  };
  const state = getInventoryState(actor, config);
  const slotsById = equipmentSlotMap(inventoryConfig);
  for (const itemId of state.tracked) {
    const placement = state.placements[itemId];
    if (placement?.area !== "equipment") continue;
    const item = actor.items?.get?.(itemId);
    const slot = slotsById.get(placement.slotId);
    if (item && slot && canEquipItem(actor, item, slot, config).ok) continue;
    const freeIndex = firstFreeInventoryIndex(state, inventoryConfig, new Set([itemId]), actor, itemId);
    if (freeIndex === null) delete state.placements[itemId];
    else state.placements[itemId] = { area: "inventory", index: freeIndex };
  }
  // getInventoryState already sorted (and packed complex shapes) when
  // autoSort is active. Packing twice doubles CPU for every reconciliation.
  // In particular, don't issue an Actor update for every Actor on every GM
  // login when its inventory is already consistent.
  if (!foundry.utils.equals(beforeState, state)) {
    const changedIds = new Set([...Object.keys(beforeState.placements), ...state.tracked]);
    await persistEquippedMutation(actor, beforeState, state, changedIds, config);
  } else await reconcileResourceItemIncreaseBounds(actor, config);
  return state;
}

export function getTrackedInventoryItemIds(actor, config = getSheetConfig()) {
  return getInventoryState(actor, config).tracked;
}

/* The public entry points share one Actor-scoped queue; internal state is always
 * fetched when the action reaches the front of the queue. */
export async function moveInventoryItem(actor, ...args) { return withInventoryMutation(actor, () => moveInventoryItemUnlocked(actor, ...args)); }
export async function trackInventoryItem(actor, ...args) { return withInventoryMutation(actor, () => trackInventoryItemUnlocked(actor, ...args)); }
export async function setEquipmentActivePosition(actor, ...args) { return withInventoryMutation(actor, () => setEquipmentActivePositionUnlocked(actor, ...args)); }
export async function setInventoryAutoSort(actor, ...args) { return withInventoryMutation(actor, () => setInventoryAutoSortUnlocked(actor, ...args)); }
export async function setInventorySortMode(actor, ...args) { return withInventoryMutation(actor, () => setInventorySortModeUnlocked(actor, ...args)); }
export async function reconcileInventoryState(actor, ...args) { return withInventoryMutation(actor, () => reconcileInventoryStateUnlocked(actor, ...args)); }
