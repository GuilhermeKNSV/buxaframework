import { HOOKS, MODULE_ID } from "./constants.js";
import { emitProgressHook } from "./progression-safety.js";
import { getSheetConfig } from "./config.js";
import { getAttributeModifier, getAttributeRebirths, getAttributeValue } from "./attributes.js";
import { getEffectiveItemValue, getItemIncreaseAggregate, removeItemIncrease } from "./item-effects.js";
import { applyNumberDisplay } from "./number-display.js";

const UPDATE_OPTION = `${MODULE_ID}.runtime`;

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nonNegativeInteger(value, fallback = 0) {
  return Math.max(0, Math.round(finiteNumber(value, fallback)));
}

export function getDamageReductionBase(actor) {
  return nonNegativeInteger(actor?.getFlag?.(MODULE_ID, "otherStats.damageReduction"), 0);
}

export function getDamageReduction(actor, config = getSheetConfig()) {
  const base = getDamageReductionBase(actor);
  return Math.max(0, applyNumberDisplay(getEffectiveItemValue(actor, "stat:damageReduction:value", base, config, { min: 0, numberMode: config.numberDisplay?.mode }), config.numberDisplay));
}

export async function setDamageReduction(actor, value) {
  if (!actor?.isOwner) return false;
  const config = getSheetConfig();
  const before = getDamageReductionBase(actor);
  const aggregate = getItemIncreaseAggregate(actor, "stat:damageReduction:value", config);
  const after = nonNegativeInteger(removeItemIncrease(value, aggregate, { min: 0, round: true }), before);
  if (before === after) return { before, after };

  await actor.update({
    [`flags.${MODULE_ID}.otherStats.damageReduction`]: after
  }, { [UPDATE_OPTION]: true });

  const result = { before, after };
  emitProgressHook(HOOKS.OTHER_STATS_UPDATED, actor, { stat: "damageReduction", ...result });
  return result;
}

export function getInitiativeAttribute(actor, config = getSheetConfig()) {
  const initiative = config?.otherStats?.initiative;
  if (!initiative?.enabled || !initiative.attributeId) return null;
  return config.attributes.entries.find((entry) => entry.id === initiative.attributeId) ?? null;
}

export function getInitiativeModifier(actor, config = getSheetConfig()) {
  const attribute = getInitiativeAttribute(actor, config);
  if (!attribute) return 0;

  const value = getAttributeValue(actor, attribute, config);
  const rebirths = getAttributeRebirths(actor, attribute.id);
  const modifier = getAttributeModifier(attribute, value, rebirths, actor, config);
  const base = Number.isFinite(Number(modifier)) ? Number(modifier) : 0;
  return getEffectiveItemValue(actor, "stat:initiative:value", base, config, { numberMode: config.numberDisplay?.mode });
}

export function reduceIncomingResourceLoss({ before, requested, damageReduction, max = Infinity } = {}) {
  const previous = finiteNumber(before, 0);
  const target = finiteNumber(requested, previous);
  const reduction = Math.max(0, finiteNumber(damageReduction, 0));
  const maximum = Number.isFinite(Number(max)) ? Math.max(0, Number(max)) : Infinity;

  if (target >= previous || reduction <= 0) {
    return Math.min(maximum, Math.max(0, target));
  }

  const incomingLoss = previous - target;
  const appliedLoss = Math.max(0, incomingLoss - reduction);
  return Math.min(maximum, Math.max(0, previous - appliedLoss));
}
