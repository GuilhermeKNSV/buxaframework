import { savedInteger } from "./stored-values.js";
import { withProgressMutation, emitProgressHook} from "./progression-safety.js";
import { notifyWarning } from "./notifications.js";
import { HOOKS, MODULE_ID } from "./constants.js";
import { getSheetConfig } from "./config.js";
import { getResourceState, writeResourceUpdate } from "./dnd5e.js";
import { getAttributePoints } from "./attributes.js";
import { getProficiencyPoints } from "./proficiencies.js";

const UPDATE_OPTION = `${MODULE_ID}.runtime`;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function integer(value, fallback = 0) {
  return Math.round(finiteNumber(value, fallback));
}

function shouldTriggerEvery(newLevel, every) {
  const interval = Math.max(1, integer(every, 1));
  return newLevel > 0 && newLevel % interval === 0;
}

function restoreAmountFor(resource, newMax) {
  const rule = resource.levelUp;
  switch (rule.restoreMode) {
    case "flat": return Math.max(0, finiteNumber(rule.restoreAmount));
    case "percent": return Math.ceil(newMax * (Math.max(0, finiteNumber(rule.restoreAmount)) / 100));
    case "full": return Infinity;
    default: return 0;
  }
}

export function getActorLevel(actor, config = getSheetConfig()) {
  const value = savedInteger(actor?.getFlag?.(MODULE_ID, "level"), config.level.startingLevel);
  return Math.max(0, value);
}

export function canLevelUp(actor, config = getSheetConfig()) {
  if (!actor || !config.level.enabled) return false;
  if (game.user.isGM) return true;
  return config.level.levelUpPermission === "owner" && actor.isOwner;
}

export async function levelUpActor(actor) {
 return withProgressMutation(actor, () => levelUpActorUnlocked(actor));
}
async function levelUpActorUnlocked(actor) {
  const config = getSheetConfig();
  if (!canLevelUp(actor, config)) {
    notifyWarning("You cannot level up this actor.");
    return false;
  }

  const oldLevel = getActorLevel(actor, config);
  const newLevel = oldLevel + 1;
  const update = { [`flags.${MODULE_ID}.level`]: newLevel };
  const resourceChanges = [];

  let pointsGained = 0;
  const points = config.attributes.points;
  if (points.enabled && points.grantAmount > 0 && shouldTriggerEvery(newLevel, points.grantEveryLevels)) {
    pointsGained = points.grantAmount;
    update[`flags.${MODULE_ID}.attributePoints`] = getAttributePoints(actor, config) + pointsGained;
  }

  let proficiencyPointsGained = 0;
  const proficiencyPoints = config.proficiencies.points;
  if (config.proficiencies.enabled && proficiencyPoints.enabled && proficiencyPoints.grantAmount > 0
    && shouldTriggerEvery(newLevel, proficiencyPoints.grantEveryLevels)) {
    proficiencyPointsGained = proficiencyPoints.grantAmount;
    update[`flags.${MODULE_ID}.proficiencyPoints`] = getProficiencyPoints(actor, config) + proficiencyPointsGained;
  }

  for (const resource of config.resources) {
    const state = getResourceState(actor, resource);
    let nextMax = Math.max(0, finiteNumber(state.max));
    let nextCurrent = clamp(finiteNumber(state.current), 0, nextMax || 0);
    let touched = false;

    if (resource.levelUp.maxGain > 0 && shouldTriggerEvery(newLevel, resource.levelUp.maxEveryLevels)) {
      nextMax += resource.levelUp.maxGain;
      touched = true;
    }

    if (resource.levelUp.restoreMode !== "none" && shouldTriggerEvery(newLevel, resource.levelUp.restoreEveryLevels)) {
      const recovery = restoreAmountFor(resource, nextMax);
      nextCurrent = recovery === Infinity ? nextMax : Math.min(nextMax, nextCurrent + recovery);
      touched = true;
    }

    if (!touched) continue;
    writeResourceUpdate(actor, resource, { current: nextCurrent, max: nextMax }, update);
    resourceChanges.push({ id: resource.id, before: state, current: nextCurrent, max: nextMax });
  }

  await actor.update(update, { [UPDATE_OPTION]: true });
  const result = { oldLevel, newLevel, pointsGained, proficiencyPointsGained, resourceChanges };
  emitProgressHook(HOOKS.LEVEL_UP, actor, result);
  return result;
}
