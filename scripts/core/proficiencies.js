import { savedInteger } from "./stored-values.js";
import { withProgressMutation, emitProgressHook} from "./progression-safety.js";
import { notifyWarning } from "./notifications.js";
import { HOOKS, MODULE_ID } from "./constants.js";
import { getSheetConfig } from "./config.js";
import { getAttributeModifier, getAttributeRebirths, getAttributeValue } from "./attributes.js";
import { getEffectiveItemValue } from "./item-effects.js";

const UPDATE_OPTION = `${MODULE_ID}.runtime`;

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function integer(value, fallback = 0) {
  return Math.round(finiteNumber(value, fallback));
}

export function getProficiencyPoints(actor, config = getSheetConfig()) {
  const fallback = config?.proficiencies?.points?.startingPoints ?? 0;
  return Math.max(0, savedInteger(actor?.getFlag?.(MODULE_ID, "proficiencyPoints"), fallback));
}

export function getProficiencyBaseValue(actor, proficiency) {
  return integer(actor?.getFlag?.(MODULE_ID, `proficiencies.${proficiency?.id}.value`), 0);
}

export function getProficiencyValue(actor, proficiency, config = getSheetConfig()) {
  const base = getProficiencyBaseValue(actor, proficiency);
  if (!proficiency?.id) return base;
  return getEffectiveItemValue(actor, `proficiency:${proficiency.id}:value`, base, config, { numberMode: config.numberDisplay?.mode });
}

export function getLinkedProficiencyAttribute(proficiency, config = getSheetConfig()) {
  if (!proficiency?.attributeId) return null;
  return config.attributes.entries.find((entry) => entry.id === proficiency.attributeId) ?? null;
}

export function getLinkedProficiencyModifier(actor, proficiency, config = getSheetConfig()) {
  const attribute = getLinkedProficiencyAttribute(proficiency, config);
  if (!attribute) return 0;
  const value = getAttributeValue(actor, attribute, config);
  const rebirths = getAttributeRebirths(actor, attribute.id);
  return Number(getAttributeModifier(attribute, value, rebirths, actor, config) ?? 0) || 0;
}

export function getProficiencyBaseModifier(actor, proficiency, config = getSheetConfig()) {
  const value = getProficiencyValue(actor, proficiency, config);
  if (config.proficiencies.mode !== "attribute") return value;
  if (proficiency?.features?.modifier === false) return 0;
  const interval = Math.max(1, integer(proficiency?.modifierEveryPoints, 1));
  const magnitude = Math.floor(Math.abs(value) / interval);
  return value < 0 ? -magnitude : magnitude;
}

export function getProficiencyModifier(actor, proficiency, config = getSheetConfig()) {
  const base = getProficiencyBaseModifier(actor, proficiency, config)
    + getLinkedProficiencyModifier(actor, proficiency, config);
  if (!proficiency?.id) return base;
  return getEffectiveItemValue(actor, `proficiency:${proficiency.id}:modifier`, base, config, { numberMode: config.numberDisplay?.mode });
}

export function canDecreaseProficiency(actor, config = getSheetConfig()) {
  return Boolean(game.user.isGM || (actor?.isOwner && config.proficiencies.points.playersCanDecrease));
}

async function setProficiencyValue(actor, proficiency, targetValue) {
  const config = getSheetConfig();
  if (!actor?.isOwner || !config.proficiencies.enabled || !config.proficiencies.points.enabled || !proficiency?.enabled) return false;

  const current = getProficiencyBaseValue(actor, proficiency);
  let target = integer(targetValue, current);
  if (!config.proficiencies.points.allowBelowZero) target = Math.max(0, target);

  const delta = target - current;
  const pool = getProficiencyPoints(actor, config);
  if (!delta) return { proficiency, before: current, after: current, delta: 0, pointsBefore: pool, pointsAfter: pool };

  const spentBefore = Math.max(0, current);
  const spentAfter = Math.max(0, target);
  const spentDelta = spentAfter - spentBefore;
  let pointsAfter = pool;
  const update = {};
  if (spentDelta > 0) {
    if (pool < spentDelta) {
      notifyWarning(`You need ${spentDelta} proficiency point${spentDelta === 1 ? "" : "s"}, but only have ${pool}.`);
      return false;
    }
    pointsAfter = pool - spentDelta;
    update[`flags.${MODULE_ID}.proficiencyPoints`] = pointsAfter;
  } else if (spentDelta < 0) {
    if (!canDecreaseProficiency(actor, config)) {
      notifyWarning("Only the GM can refund spent proficiency points.");
      return false;
    }
    pointsAfter = pool + Math.abs(spentDelta);
    update[`flags.${MODULE_ID}.proficiencyPoints`] = pointsAfter;
  } else if (delta < 0 && !canDecreaseProficiency(actor, config)) {
    notifyWarning("Only the GM can decrease proficiency values.");
    return false;
  }

  update[`flags.${MODULE_ID}.proficiencies.${proficiency.id}.value`] = target;
  await actor.update(update, { [UPDATE_OPTION]: true });

  const result = {
    proficiency,
    before: current,
    after: target,
    delta,
    pointsBefore: pool,
    pointsAfter
  };
  emitProgressHook(HOOKS.PROFICIENCY_UPDATED, actor, proficiency, result);
  return result;
}

export async function changeProficiency(actor, proficiencyId, delta) {
 return withProgressMutation(actor, () => changeProficiencyUnlocked(actor, proficiencyId, delta));
}
async function changeProficiencyUnlocked(actor, proficiencyId, delta) {
  const config = getSheetConfig();
  const proficiency = config.proficiencies.entries.find((entry) => entry.id === proficiencyId);
  if (!proficiency || !proficiency.enabled) return false;
  const step = Number(delta);
  if (!Number.isSafeInteger(step) || Math.abs(step) > 100000 || step === 0) return false;
  const current = getProficiencyBaseValue(actor, proficiency);
  return setProficiencyValue(actor, proficiency, current + step);
}
