import { savedInteger } from "./stored-values.js";
import { getNpcAttributeOverride } from "./npc-sheet.js";
import { withProgressMutation, emitProgressHook} from "./progression-safety.js";
import { notifyWarning } from "./notifications.js";
import { HOOKS, MODULE_ID } from "./constants.js";
import { getSheetConfig } from "./config.js";
import { writeAbilityValueUpdate } from "./dnd5e.js";
import { applyItemIncrease, getEffectiveItemValue, getItemIncreaseAggregate, removeItemIncrease } from "./item-effects.js";
import {
  getAttributeBaseProgress,
  getAttributeBaseProgressState,
  getAttributeProgressState,
  getClaimedAttributeRebirths,
  getLegacyAttributeCycleValue,
  writeAttributeProgressUpdate
} from "./attribute-progress.js";

const UPDATE_OPTION = `${MODULE_ID}.runtime`;

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function integer(value, fallback = 0) {
  return Math.round(finiteNumber(value, fallback));
}

export function getAttributePoints(actor, config = getSheetConfig()) {
  const value = savedInteger(actor?.getFlag?.(MODULE_ID, "attributePoints"), config.attributes.points.startingPoints);
  return Math.max(0, value);
}

export function getAttributeBaseValue(actor, attribute) {
  if (attribute?.rebirth?.enabled) return getAttributeBaseProgressState(actor, attribute).value;
  return getLegacyAttributeCycleValue(actor, attribute);
}

export function getAttributeValue(actor, attribute, config = getSheetConfig()) {
  const manual = getNpcAttributeOverride(actor, attribute?.id, "value");
  if (manual !== null) return manual;
  if (attribute?.rebirth?.enabled) return getAttributeProgressState(actor, attribute, config).value;
  const base = getAttributeBaseValue(actor, attribute);
  if (!attribute?.id) return base;
  return getEffectiveItemValue(actor, `attribute:${attribute.id}:value`, base, config, { numberMode: config.numberDisplay?.mode });
}

export function getAttributeRebirths(actor, attributeId, config = getSheetConfig()) {
  const attribute = config?.attributes?.entries?.find?.((entry) => entry.id === attributeId);
  if (!attribute?.rebirth?.enabled) return getClaimedAttributeRebirths(actor, attributeId);
  return getAttributeProgressState(actor, attribute, config).activeRebirths;
}

export function getAttributeRebirthState(actor, attribute, config = getSheetConfig()) {
  if (!attribute?.rebirth?.enabled) {
    const rebirths = getClaimedAttributeRebirths(actor, attribute?.id);
    return {
      cap: 0,
      baseProgress: getAttributeBaseValue(actor, attribute),
      effectiveProgress: getAttributeValue(actor, attribute, config),
      claimedRebirths: rebirths,
      activeRebirths: rebirths,
      inactiveRebirths: 0,
      readyToRebirth: false,
      value: getAttributeValue(actor, attribute, config)
    };
  }
  return getAttributeProgressState(actor, attribute, config);
}

export function getAttributeModifier(attribute, value, rebirths, actor = null, config = getSheetConfig()) {
  const manual = getNpcAttributeOverride(actor, attribute?.id, "modifier");
  if (manual !== null) return manual;
  const directEffect = actor && attribute?.id
    ? getItemIncreaseAggregate(actor, `attribute:${attribute.id}:modifier`, config)
    : { count: 0 };
  if (!attribute?.modifier?.enabled && !directEffect.count) return null;

  const interval = Math.max(1, integer(attribute?.modifier?.everyPoints, 1));
  let modifier = attribute?.modifier?.enabled ? Math.floor(Math.max(0, finiteNumber(value)) / interval) : 0;

  if (attribute.rebirth?.enabled && attribute.rebirth.lockModifier) {
    const cap = Math.max(0, integer(attribute.rebirth.baseModifierCap))
      + (Math.max(0, integer(rebirths)) * Math.max(0, integer(attribute.rebirth.modifierCapPerRebirth)));
    modifier = Math.min(modifier, cap);
  }
  if (actor && attribute?.id) {
    modifier = getEffectiveItemValue(actor, `attribute:${attribute.id}:modifier`, modifier, config, { numberMode: config.numberDisplay?.mode });
  }
  return modifier;
}

export function getAttributeDice(attribute, rebirths, actor = null, config = getSheetConfig()) {
  const manual = getNpcAttributeOverride(actor, attribute?.id, "dice");
  if (manual !== null) return manual;
  let dice = 1;
  if (attribute?.rebirth?.enabled) {
    const every = Math.max(1, integer(attribute.rebirth.gainDieEveryRebirths, 1));
    dice += Math.floor(Math.max(0, integer(rebirths)) / every);
  }
  if (actor && attribute?.id) {
    dice = getEffectiveItemValue(actor, `attribute:${attribute.id}:dice`, dice, config, { min: 1, round: true });
  }
  return Math.max(1, integer(dice, 1));
}

export function getAttributeVisual(attribute, rebirths, config = getSheetConfig()) {
  const base = attribute?.appearance ?? {};
  const count = Math.max(0, integer(rebirths));
  const styles = Array.isArray(config?.rebirthStyles) ? config.rebirthStyles : [];
  const neutral = styles[0] ?? { color: "#151a24", decoration: "I" };

  if (attribute?.rebirth?.enabled && count <= 0) {
    return {
      color: String(neutral.color || "#151a24"),
      decoration: String(base.decoration || "◆")
    };
  }

  if (!attribute?.rebirth?.enabled) {
    return {
      color: String(base.color || "#151a24"),
      decoration: String(base.decoration || "◆")
    };
  }

  const exact = styles[count - 1];
  if (exact) {
    return {
      color: String(exact.color || neutral.color || "#151a24"),
      decoration: String(exact.decoration || `R${count}`)
    };
  }

  const last = styles.at(-1) ?? neutral;
  return {
    color: String(last.color || "#151a24"),
    decoration: `R${count}`
  };
}

export function canDecreaseAttribute(actor, config = getSheetConfig()) {
  return Boolean(game.user.isGM || (actor?.isOwner && config.attributes.points.playersCanDecrease));
}

function pointUpdate(actor, config, delta, { refundOnDecrease = true } = {}) {
  const pool = getAttributePoints(actor, config);
  const update = {};
  if (delta > 0) {
    if (pool < delta) {
      notifyWarning(`You need ${delta} point${delta === 1 ? "" : "s"}, but only have ${pool}.`);
      return null;
    }
    update[`flags.${MODULE_ID}.attributePoints`] = pool - delta;
  } else if (delta < 0) {
    if (!canDecreaseAttribute(actor, config)) {
      notifyWarning("Only the GM can remove spent attribute points.");
      return null;
    }
    if (refundOnDecrease) update[`flags.${MODULE_ID}.attributePoints`] = pool + Math.abs(delta);
  }
  return { pool, update };
}

async function setRebirthAttributeProgress(actor, attribute, targetProgress, { refundOnDecrease = true } = {}) {
  const config = getSheetConfig();
  if (!actor?.isOwner || !config.attributes.points.enabled) return false;

  const currentProgress = integer(getAttributeBaseProgress(actor, attribute));
  const beforeValue = getAttributeBaseValue(actor, attribute);
  let target = integer(targetProgress, currentProgress);
  // A rebirth is an investment counter, not a freely refundable negative stat.
  // Even with general allowBelowZero enabled, there can be no negative invested
  // progress: otherwise pressing minus repeatedly generates unlimited points.
  const rebirthState = getAttributeBaseProgressState(actor, attribute);
  // Claimed cycle points are permanently invested. A reborn attribute at
  // cycle value 0 cannot be refunded back through previously claimed cycles.
  // For legacy corrupted data already below the floor, stop at its existing
  // progress rather than spending points to 'repair' it via a minus click.
  const floor = Math.min(currentProgress, rebirthState.claimedRebirths * rebirthState.cap);
  target = Math.max(floor, target);
  // Do not charge points after the visible stat has reached its cycle cap.
  // Both the +/- control and bulk point entry must use the same boundary.
  const nextCap = (rebirthState.claimedRebirths + 1) * rebirthState.cap;
  if (target > currentProgress && getAttributeProgressState(actor, attribute, config).readyToRebirth) {
    notifyWarning(`${attribute.label} is ready to rebirth. Claim the tier before adding more points.`);
    return false;
  }
  target = Math.min(target, nextCap);
  if (target > currentProgress) {
    const bonus = getItemIncreaseAggregate(actor, `attribute:${attribute.id}:value`, config);
    const numberMode = config.numberDisplay?.mode;
    let maxBase = Math.min(nextCap, Math.floor(removeItemIncrease(nextCap, bonus, {
      numberMode
    })));
    // Integer investments may leap over the threshold with a percentage bonus.
    // Allow the single point which first reaches the visible cap, not the
    // larger number requested in bulk. Display rounding is respected.
    if (maxBase < nextCap && applyItemIncrease(maxBase, bonus, { numberMode }) < nextCap) maxBase += 1;
    // A bonus may take the visual to cap before permanent progress does.
    // Leave existing investments intact; only restrict *new* spending.
    target = Math.min(target, Math.max(currentProgress, maxBase));
  }

  const delta = target - currentProgress;
  const points = pointUpdate(actor, config, delta, { refundOnDecrease });
  if (!points) return false;
  if (!delta) {
    return { before: getAttributeBaseValue(actor, attribute), after: getAttributeBaseValue(actor, attribute), delta: 0, pointsBefore: points.pool, pointsAfter: points.pool };
  }

  writeAttributeProgressUpdate(actor, attribute, target, points.update);
  await actor.update(points.update, { [UPDATE_OPTION]: true });

  const afterValue = getAttributeBaseProgressState(actor, attribute).value;
  const result = {
    attribute,
    before: beforeValue,
    after: afterValue,
    delta,
    pointsBefore: points.pool,
    pointsAfter: delta > 0 ? points.pool - delta : (refundOnDecrease ? points.pool + Math.abs(delta) : points.pool)
  };
  emitProgressHook(HOOKS.ATTRIBUTE_UPDATED, actor, attribute, result);
  return result;
}

async function setAttributeValue(actor, attribute, targetValue, { refundOnDecrease = true } = {}) {
  const config = getSheetConfig();
  if (!actor?.isOwner || !config.attributes.points.enabled) return false;

  const current = getAttributeBaseValue(actor, attribute);
  let target = integer(targetValue, current);

  if (!config.attributes.points.allowBelowZero) target = Math.max(0, target);
  const delta = target - current;
  const points = pointUpdate(actor, config, delta, { refundOnDecrease });
  if (!points) return false;
  if (!delta) return { before: current, after: current, delta: 0, pointsBefore: points.pool, pointsAfter: points.pool };

  if (target < 0) {
    writeAbilityValueUpdate(actor, attribute.ability, 0, points.update);
    points.update[`flags.${MODULE_ID}.attributes.${attribute.id}.value`] = target;
  } else {
    writeAbilityValueUpdate(actor, attribute.ability, target, points.update);
    points.update[`flags.${MODULE_ID}.attributes.${attribute.id}.value`] = null;
  }

  await actor.update(points.update, { [UPDATE_OPTION]: true });
  const result = {
    attribute,
    before: current,
    after: target,
    delta,
    pointsBefore: points.pool,
    pointsAfter: delta > 0 ? points.pool - delta : (refundOnDecrease ? points.pool + Math.abs(delta) : points.pool)
  };
  emitProgressHook(HOOKS.ATTRIBUTE_UPDATED, actor, attribute, result);
  return result;
}

export async function changeAttribute(actor, attributeId, delta) {
 return withProgressMutation(actor, () => changeAttributeUnlocked(actor, attributeId, delta));
}
async function changeAttributeUnlocked(actor, attributeId, delta) {
  const config = getSheetConfig();
  const attribute = config.attributes.entries.find((entry) => entry.id === attributeId);
  if (!attribute || !config.attributes.points.enabled || !actor?.isOwner) return false;
  // The public API accepts a point delta; do not silently convert +10 to +1.
  // Reject non-integral/unbounded values instead of charging the wrong amount.
  const step = Number(delta);
  if (!Number.isSafeInteger(step) || Math.abs(step) > 100000 || step === 0) return false;

  if (attribute.rebirth.enabled) {
    const state = getAttributeProgressState(actor, attribute, config);
    if (step > 0 && state.readyToRebirth) {
      if (step !== 1) {
        notifyWarning('Claim this rebirth before applying a multi-point change. No points were spent.');
        return false;
      }
      return rebirthAttributeUnlocked(actor, attributeId, { ask: true });
    }
    if (step < 0 && getAttributeBaseProgress(actor, attribute)
      <= getClaimedAttributeRebirths(actor, attributeId) * attribute.rebirth.maxPoints) return false;
    return setRebirthAttributeProgress(actor, attribute, getAttributeBaseProgress(actor, attribute) + step);
  }

  const current = getAttributeBaseValue(actor, attribute);
  return setAttributeValue(actor, attribute, current + Math.sign(delta || 0));
}

/** The number popup deposits points rather than replacing the attribute. */
export async function addAttributePoints(actor, attributeId, amount) {
  return withProgressMutation(actor, async () => {
    const config = getSheetConfig();
    if (!config.attributes.points.enabled || !config.attributes.points.directValueEntry || !actor?.isOwner) return false;
    const attribute = config.attributes.entries.find((entry) => entry.id === attributeId);
    const quantity = Number(amount);
    if (!attribute || !Number.isSafeInteger(quantity) || quantity <= 0) return false;
    if (attribute.rebirth?.enabled) {
      return setRebirthAttributeProgress(actor, attribute,
        getAttributeBaseProgress(actor, attribute) + quantity);
    }
    return setAttributeValue(actor, attribute, getAttributeBaseValue(actor, attribute) + quantity);
  });
}

export async function setAttributeDirect(actor, attributeId, value) {
 return withProgressMutation(actor, () => setAttributeDirectUnlocked(actor, attributeId, value));
}
async function setAttributeDirectUnlocked(actor, attributeId, value) {
  const config = getSheetConfig();
  if (!config.attributes.points.directValueEntry) return false;
  const attribute = config.attributes.entries.find((entry) => entry.id === attributeId);
  if (!attribute) return false;

  if (attribute.rebirth.enabled) {
    const state = getAttributeBaseProgressState(actor, attribute);
    // Direct rebirth entry represents permanent invested cycle points, never
    // the boosted display value. Converting the target through item increases
    // made 100 display as 100 while only 80 were invested (+20 from gear),
    // leaving the bar falsely capped and allowing additional point spending.
    const targetValue = Math.min(state.cap, Math.max(0, integer(value)));
    const baseTarget = (state.claimedRebirths * state.cap) + targetValue;
    return setRebirthAttributeProgress(actor, attribute, baseTarget);
  }

  const aggregate = getItemIncreaseAggregate(actor, `attribute:${attribute.id}:value`, config);
  const baseTarget = removeItemIncrease(value, aggregate, { round: true });
  return setAttributeValue(actor, attribute, baseTarget);
}

export async function rebirthAttribute(actor, attributeId, options = {}) {
 return withProgressMutation(actor, () => rebirthAttributeUnlocked(actor, attributeId, options));
}
async function rebirthAttributeUnlocked(actor, attributeId, { ask = true } = {}) {
  const config = getSheetConfig();
  const attribute = config.attributes.entries.find((entry) => entry.id === attributeId);
  if (!actor?.isOwner || !attribute?.rebirth?.enabled) return false;

  const state = getAttributeProgressState(actor, attribute, config);
  if (!state.readyToRebirth) {
    notifyWarning(`${attribute.label} has not reached its rebirth cap yet.`);
    return false;
  }

  if (ask) {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: `Rebirth · ${attribute.label}` },
      content: `<p>Rebirth <strong>${foundry.utils.escapeHTML(attribute.label)}</strong>? Its displayed value will roll over while Buxa keeps the full invested progress behind the scenes.</p>`,
      yes: { label: "Rebirth", icon: "fa-solid fa-arrows-rotate" },
      no: { label: "Cancel" },
      modal: true
    });
    if (!confirmed) return false;
  }

  const claimedBefore = getClaimedAttributeRebirths(actor, attribute.id);
  const claimedAfter = claimedBefore + 1;
  const update = {
    [`flags.${MODULE_ID}.attributes.${attribute.id}.rebirths`]: claimedAfter
  };
  writeAttributeProgressUpdate(actor, attribute, getAttributeBaseProgress(actor, attribute), update, { claimedRebirths: claimedAfter });
  await actor.update(update, { [UPDATE_OPTION]: true });

  const afterState = getAttributeProgressState(actor, attribute, config);
  const result = {
    attribute,
    before: state.activeRebirths,
    after: afterState.activeRebirths,
    claimedBefore,
    claimedAfter,
    dice: getAttributeDice(attribute, afterState.activeRebirths, actor, config)
  };
  emitProgressHook(HOOKS.ATTRIBUTE_REBIRTH, actor, attribute, result);
  return result;
}
