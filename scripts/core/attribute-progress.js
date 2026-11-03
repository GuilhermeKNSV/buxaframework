import { MODULE_ID } from "./constants.js";
import { getAbilityValue, writeAbilityValueUpdate } from "./dnd5e.js";
import { applyItemIncrease, getItemIncreaseAggregate, removeItemIncrease } from "./item-effects.js";

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function integer(value, fallback = 0) {
  return Math.round(finite(value, fallback));
}

function capFor(attribute) {
  return Math.max(1, integer(attribute?.rebirth?.maxPoints, 1));
}

export function getClaimedAttributeRebirths(actor, attributeId) {
  return Math.max(0, integer(actor?.getFlag?.(MODULE_ID, `attributes.${attributeId}.rebirths`), 0));
}

export function getLegacyAttributeCycleValue(actor, attribute) {
  const systemValue = getAbilityValue(actor, attribute?.ability);
  const stored = Number(actor?.getFlag?.(MODULE_ID, `attributes.${attribute?.id}.value`));
  if (systemValue === 0 && Number.isFinite(stored) && stored < 0) return stored;
  return systemValue;
}

/**
 * Cumulative attribute progress before temporary item effects.
 *
 * Legacy actors are reconstructed from rebirths * cap + the old cycle value.
 * This deliberately preserves old negative-cycle bugs as their correct total:
 * R1 with -10 at a 100 cap becomes 90 total progress, not a permanent -10.
 */
export function getAttributeBaseProgress(actor, attribute) {
  const rawProgress = actor?.getFlag?.(MODULE_ID, `attributes.${attribute?.id}.progress`);
  // Null means the progress flag was not initialized (Number(null) is 0).
  // Never turn a legacy 100-point character into a zero-progress character.
  if (rawProgress !== undefined && rawProgress !== null && rawProgress !== "") {
    const stored = Number(rawProgress);
    if (Number.isFinite(stored)) return stored;
  }
  if (!attribute?.rebirth?.enabled) return getLegacyAttributeCycleValue(actor, attribute);
  const claimed = getClaimedAttributeRebirths(actor, attribute.id);
  return (claimed * capFor(attribute)) + getLegacyAttributeCycleValue(actor, attribute);
}

function supportedRebirths(progress, cap) {
  if (progress < 0) return 0;
  return Math.max(0, Math.floor(progress / cap));
}

function cycleValue(progress, activeRebirths, cap) {
  const remainder = progress - (activeRebirths * cap);
  return Math.min(cap, remainder);
}

function stateFromProgress(progress, claimed, cap) {
  const potential = supportedRebirths(progress, cap);
  const active = Math.min(claimed, potential);
  const value = cycleValue(progress, active, cap);
  return {
    progress,
    claimedRebirths: claimed,
    potentialRebirths: potential,
    activeRebirths: active,
    inactiveRebirths: Math.max(0, claimed - active),
    value,
    readyToRebirth: progress >= ((claimed + 1) * cap)
  };
}

export function getAttributeBaseProgressState(actor, attribute) {
  const cap = capFor(attribute);
  const claimed = getClaimedAttributeRebirths(actor, attribute?.id);
  return {
    cap,
    ...stateFromProgress(getAttributeBaseProgress(actor, attribute), claimed, cap)
  };
}

export function getAttributeProgressState(actor, attribute, config) {
  const baseState = getAttributeBaseProgressState(actor, attribute);
  if (!attribute?.rebirth?.enabled || !attribute?.id) {
    return { ...baseState, effectiveProgress: baseState.progress, aggregate: { flat: 0, percent: 0, count: 0 } };
  }
  const aggregate = getItemIncreaseAggregate(actor, `attribute:${attribute.id}:value`, config);
  const effectiveProgress = applyItemIncrease(baseState.progress, aggregate, {
    numberMode: config?.numberDisplay?.mode
  });
  return {
    cap: baseState.cap,
    baseProgress: baseState.progress,
    effectiveProgress,
    aggregate,
    ...stateFromProgress(effectiveProgress, baseState.claimedRebirths, baseState.cap),
    // Rebirth readiness must agree with the number visible on the sheet.
    // Item-assisted tiers are provisional: their invested progress remains
    // unchanged, and losing the contributing items can deactivate the tier.
    value: Math.max(0, Math.min(baseState.cap,
      effectiveProgress - (Math.min(baseState.claimedRebirths,
        Math.max(0, Math.floor(effectiveProgress / baseState.cap))) * baseState.cap)))
  };
}

export function effectiveCycleTargetToBaseProgress(actor, attribute, effectiveCycleValue, config) {
  const state = getAttributeProgressState(actor, attribute, config);
  const targetCycle = finite(effectiveCycleValue, state.value);
  const desiredEffectiveProgress = (state.activeRebirths * state.cap) + targetCycle;
  return removeItemIncrease(desiredEffectiveProgress, state.aggregate, {
    numberMode: config?.numberDisplay?.mode
  });
}

/**
 * Persist cumulative progress and mirror a safe base-cycle value into D&D 5e.
 * The D&D ability never receives a negative value and temporary item progress is
 * never baked into the document.
 */
export function writeAttributeProgressUpdate(actor, attribute, progress, update = {}, { claimedRebirths = null } = {}) {
  const nextProgress = finite(progress, 0);
  const claimed = claimedRebirths === null
    ? getClaimedAttributeRebirths(actor, attribute?.id)
    : Math.max(0, integer(claimedRebirths, 0));
  const cap = capFor(attribute);
  const baseState = stateFromProgress(nextProgress, claimed, cap);

  update[`flags.${MODULE_ID}.attributes.${attribute.id}.progress`] = nextProgress;
  update[`flags.${MODULE_ID}.attributes.${attribute.id}.value`] = null;
  writeAbilityValueUpdate(actor, attribute.ability, Math.max(0, baseState.value), update);
  return update;
}
