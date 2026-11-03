import { MODULE_ID } from "./constants.js";
import { getItemRules } from "./item-config.js";
import { getItemKind, getEffectRules } from "./effect-config.js";
import { getItemQuantity } from "./dnd5e.js";
import { isRevealed } from "./item-discovery.js";
import { applyNumberDisplay, cleanFloatingNumber } from "./number-display.js";

// One sheet context queries many independent stats. Without a render-scoped
// index every stat scanned (and normalized) every item in the actor again.
// The cache is deliberately scoped to a single context build: a changed item,
// discovery state, or equipment slot can never survive into the next render.
const activeBatches = new WeakMap();
const NO_INCREASE = Object.freeze({ flat: 0, percent: 0, count: 0 });

export function beginItemIncreaseBatch(actor, config) {
  if (!actor || typeof actor !== "object") return () => {};
  const previous = activeBatches.get(actor);
  const entries = collectActiveItemIncreaseEntries(actor, config);
  const byTarget = new Map();
  for (const { increase } of entries) {
    const target = increase.target;
    if (!target) continue;
    let total = byTarget.get(target);
    if (!total) { total = { flat: 0, percent: 0, count: 0 }; byTarget.set(target, total); }
    const value = finite(increase.value, 0);
    if (increase.mode === "percent") total.percent += value;
    else total.flat += value;
    total.count += 1;
  }
  const batch = { config, entries, byTarget };
  activeBatches.set(actor, batch);
  return () => {
    if (activeBatches.get(actor) !== batch) return;
    if (previous) activeBatches.set(actor, previous);
    else activeBatches.delete(actor);
  };
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function inventoryState(actor) {
  const raw = actor?.getFlag?.(MODULE_ID, "inventory");
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
}

function equippedItemIds(actor) {
  const state = inventoryState(actor);
  const placements = state.placements && typeof state.placements === "object" ? state.placements : {};
  const active = state.equipmentActive && typeof state.equipmentActive === "object" ? state.equipmentActive : {};
  const ids = [];
  for (const [itemId, placement] of Object.entries(placements)) {
    if (placement?.area !== "equipment") continue;
    const selected = Number(active[placement.slotId] ?? 0);
    if (Number(placement.position ?? 0) !== selected) continue;
    if (actor?.items?.get?.(itemId)) ids.push(itemId);
  }
  return ids;
}

export function getEquippedBuxaItems(actor) {
  return equippedItemIds(actor).map((id) => actor.items.get(id))
    .filter((item) => item && getItemQuantity(item) > 0);
}

export function getEquippedItemIncreaseEntries(actor, config) {
  const entries = [];
  for (const item of getEquippedBuxaItems(actor)) {
    const rules = getItemRules(item, config);
    for (const increase of rules.increases ?? []) {
      if (!isRevealed(increase) || increase.activation === "passive") continue;
      entries.push({ item, increase });
    }
  }
  return entries;
}

function collectActiveItemIncreaseEntries(actor, config) {
  const activeEquipped = new Set(equippedItemIds(actor));
  const entries = [];
  // A passive increase belongs to the Actor's actual inventory, not to the
  // optional Buxa grid's tracking flag. Items added via core Foundry sheets,
  // macros or imports must grant their passive bonuses as well.
  for (const item of actor?.items ?? []) {
    if (!item || getItemQuantity(item) <= 0) continue;
    if (getItemKind(item) === 'effect') continue;
    const rules = getItemRules(item, config);
    for (const increase of rules.increases ?? []) {
      if (!isRevealed(increase)) continue;
      const passive = increase.activation === "passive";
      if (!passive && !activeEquipped.has(item.id)) continue;
      entries.push({ item, increase });
    }
  }
  // Active Effect items grant bonuses independent of equipment or grid
  // placement. Ordinary (inactive) Effect templates never grant bonuses.
  const applied = actor?.getFlag?.(MODULE_ID, 'activeEffects');
  if (Array.isArray(applied)) for (const instance of applied.slice(0,256)) {
    const item = actor?.items?.get?.(instance?.effectItemId) ?? globalThis.game?.items?.get?.(instance?.effectItemId);
    if (!item || getItemKind(item) !== 'effect') continue;
    const rules = getEffectRules(item, config);
    for (const increase of rules.increases) if (isRevealed(increase)) {
      entries.push({item, increase:{...increase,value:increase.value*Math.max(1,Math.min(9999,Number(instance.stackCount)||1))}});
    }
  }
  return entries;
}

export function getActiveItemIncreaseEntries(actor, config) {
  const batch = actor && activeBatches.get(actor);
  return batch?.config === config ? batch.entries : collectActiveItemIncreaseEntries(actor, config);
}

export function getItemIncreaseAggregate(actor, target, config) {
  const batch = actor && activeBatches.get(actor);
  if (batch?.config === config) return batch.byTarget.get(target) ?? NO_INCREASE;
  let flat = 0;
  let percent = 0;
  let count = 0;
  for (const { increase } of getActiveItemIncreaseEntries(actor, config)) {
    if (increase.target !== target) continue;
    const value = finite(increase.value, 0);
    if (increase.mode === "percent") percent += value;
    else flat += value;
    count += 1;
  }
  return { flat, percent, count };
}

export function applyItemIncrease(baseValue, aggregate, { min = -Infinity, max = Infinity, round = false, numberMode = null } = {}) {
  const base = finite(baseValue, 0);
  const flat = finite(aggregate?.flat, 0);
  const percent = finite(aggregate?.percent, 0);
  const factor = Math.max(0, 1 + (percent / 100));
  let value = (base + flat) * factor;
  value = Math.min(max, Math.max(min, value));
  if (numberMode) return applyNumberDisplay(value, numberMode);
  return round ? Math.round(value) : cleanFloatingNumber(value);
}

export function getEffectiveItemValue(actor, target, baseValue, config, options = {}) {
  return applyItemIncrease(baseValue, getItemIncreaseAggregate(actor, target, config), options);
}

export function removeItemIncrease(effectiveValue, aggregate, { min = -Infinity, max = Infinity, round = false, numberMode = null } = {}) {
  const target = finite(effectiveValue, 0);
  const flat = finite(aggregate?.flat, 0);
  const percent = finite(aggregate?.percent, 0);
  const factor = Math.max(0, 1 + (percent / 100));
  // An effective value at -100% (or lower) does not uniquely identify its
  // underlying base. Guessing target-flat can overwrite the permanent stat.
  if (factor < 0.000001) {
    throw new RangeError('Cannot edit a value while item bonuses reduce it by 100% or more. Unequip that effect first.');
  }
  let value = (target / factor) - flat;
  value = Math.min(max, Math.max(min, value));
  if (numberMode) return applyNumberDisplay(value, numberMode);
  return round ? Math.round(value) : cleanFloatingNumber(value);
}
