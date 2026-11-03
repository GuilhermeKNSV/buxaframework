import { withProgressMutation, emitProgressHook } from "./progression-safety.js";
import { HOOKS, MODULE_ID } from "./constants.js";
import { getSheetConfig, isTargetActorType } from "./config.js";
import { getResourceState, writeResourceLabelUpdate, writeResourceUpdate } from "./dnd5e.js";
import { applyItemIncrease, getItemIncreaseAggregate, removeItemIncrease } from "./item-effects.js";
import { applyNumberDisplay } from "./number-display.js";

const UPDATE_OPTION = `${MODULE_ID}.runtime`;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function getEffectiveResourceState(actor, resource, config = getSheetConfig()) {
  const base = getResourceState(actor, resource);
  const aggregate = getItemIncreaseAggregate(actor, `resource:${resource?.id}:max`, config);
  const mode = config?.numberDisplay?.mode || "truncate";
  const max = Math.max(0, applyItemIncrease(base.max, aggregate, { min: 0, numberMode: mode }));
  return {
    ...base,
    baseMax: base.max,
    max,
    current: Math.min(max, Math.max(0, applyNumberDisplay(base.current, mode))),
    itemIncrease: aggregate
  };
}

export async function updateResource(actor, resourceId, changes = {}) {
 return withProgressMutation(actor, () => updateResourceUnlocked(actor, resourceId, changes));
}
async function updateResourceUnlocked(actor, resourceId, { current, max } = {}) {
  if (!actor?.isOwner) return false;

  const config = getSheetConfig();
  const resource = config.resources.find((entry) => entry.id === resourceId);
  if (!resource) return false;

  const state = getEffectiveResourceState(actor, resource, config);
  const requestedEffectiveMax = max === undefined ? state.max : Math.max(0, finiteNumber(max, state.max));
  const nextBaseMax = max === undefined
    ? state.baseMax
    : Math.max(0, removeItemIncrease(requestedEffectiveMax, state.itemIncrease, { min: 0 }));
  const nextEffectiveMax = Math.max(0, applyItemIncrease(nextBaseMax, state.itemIncrease, { min: 0, numberMode: config.numberDisplay?.mode }));
  let nextCurrent = current === undefined ? state.current : finiteNumber(current, state.current);

  if (max !== undefined && resource.syncCurrentOnMax) nextCurrent = nextEffectiveMax;
  nextCurrent = clamp(nextCurrent, 0, nextEffectiveMax);

  // Typing the existing value and blurring an input is not a gameplay update.
  // Avoid a redundant Actor database write and a full sheet redraw. Compare
  // actual stored values, not the effective UI state: an over-cap resource
  // still needs to be clamped even if its displayed value was unchanged.
  const rawState = getResourceState(actor, resource);
  if (rawState.current === nextCurrent && rawState.max === nextBaseMax) {
    return {
      resource,
      before: { current: finiteNumber(state.current), max: finiteNumber(state.max) },
      after: { current: finiteNumber(state.current), max: finiteNumber(state.max) },
      currentDelta: 0,
      maxDelta: 0
    };
  }

  const update = {};
  writeResourceUpdate(actor, resource, { current: nextCurrent, max: nextBaseMax }, update);
  await actor.update(update, { [UPDATE_OPTION]: true });

  const applied = getEffectiveResourceState(actor, resource, config);
  const result = {
    resource,
    before: { current: finiteNumber(state.current), max: finiteNumber(state.max) },
    after: { current: finiteNumber(applied.current), max: finiteNumber(applied.max) },
    currentDelta: finiteNumber(applied.current) - finiteNumber(state.current),
    maxDelta: finiteNumber(applied.max) - finiteNumber(state.max)
  };
  emitProgressHook(HOOKS.RESOURCE_UPDATED, actor, resource, result.after);
  return result;
}


export async function reconcileResourceItemIncreaseBounds(actor, config = getSheetConfig()) {
  if (!actor?.isOwner) return false;
  const update = {};
  for (const resource of config.resources ?? []) {
    const base = getResourceState(actor, resource);
    const effective = getEffectiveResourceState(actor, resource, config);
    const current = Math.max(0, finiteNumber(base.current, 0));
    if (current <= effective.max) continue;
    writeResourceUpdate(actor, resource, { current: effective.max }, update);
  }
  if (!Object.keys(update).length) return false;
  await actor.update(update, { [UPDATE_OPTION]: true });
  return true;
}

export async function synchronizeConfiguredResourceLabels(config = getSheetConfig()) {
  if (!game.user.isGM) return;

  for (const actor of game.actors ?? []) {
    if (!isTargetActorType(actor, config)) continue;
    const update = {};
    for (const resource of config.resources) writeResourceLabelUpdate(actor, resource, update);
    if (!Object.keys(update).length) continue;

    try {
      await actor.update(update, { [UPDATE_OPTION]: true });
    } catch (error) {
      console.warn(`${MODULE_ID} | Could not synchronize D&D resource labels for ${actor.name}.`, error);
    }
  }
}
