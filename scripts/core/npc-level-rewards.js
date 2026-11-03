/** Level-range point rewards for GM-edited NPC levels.
 * Calculate crossed reward milestones in constant time rather than replaying
 * hundreds of level-up hooks. Unspent awards can be removed on level-down;
 * already-invested awards become a small debt repaid by later level gains.
 * This prevents farming points by repeatedly lowering/raising NPC level.
 */
import { MODULE_ID } from "./constants.js";
import { getSheetConfig } from "./config.js";
import { getActorLevel } from "./leveling.js";
import { getAttributePoints } from "./attributes.js";
import { getProficiencyPoints } from "./proficiencies.js";

const MAX_EDITABLE_POINTS = 999999;

function nonNegativeInteger(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : fallback;
}

/** Number of configured reward levels between oldLevel (exclusive) and nextLevel (inclusive). */
export function npcRewardDelta(oldLevel, nextLevel, rule, enabled = true) {
  if (!enabled || rule?.enabled === false) return 0;
  const amount = nonNegativeInteger(rule?.grantAmount);
  const every = Math.max(1, nonNegativeInteger(rule?.grantEveryLevels, 1));
  if (!amount) return 0;
  return (Math.floor(nextLevel / every) - Math.floor(oldLevel / every)) * amount;
}

/** Keep earned-but-spent points out of the unspent pool when reversing levels. */
export function npcApplyReward(balance, debt, delta) {
  const initial = nonNegativeInteger(balance);
  const owed = nonNegativeInteger(debt);
  if (delta < 0) {
    const removed = -delta;
    return { points: Math.max(0, initial - removed), debt: owed + Math.max(0, removed - initial) };
  }
  const repaid = Math.min(delta, owed);
  return { points: initial + delta - repaid, debt: owed - repaid };
}

/** Returns one atomic Foundry Actor update, or false for invalid/unchanged levels. */
export function npcLevelUpdate(actor, targetLevel, config = getSheetConfig()) {
  const oldLevel = getActorLevel(actor, config);
  if (targetLevel === oldLevel) return null;
  const points = [
    { key: "attributePoints", debtKey: "attributePoints", current: getAttributePoints(actor, config),
      delta: npcRewardDelta(oldLevel, targetLevel, config.attributes?.points, config.attributes?.points?.enabled === true) },
    { key: "proficiencyPoints", debtKey: "proficiencyPoints", current: getProficiencyPoints(actor, config),
      delta: npcRewardDelta(oldLevel, targetLevel, config.proficiencies?.points,
        config.proficiencies?.enabled === true && config.proficiencies?.points?.enabled === true) }
  ];
  const update = { [`flags.${MODULE_ID}.level`]: targetLevel };
  for (const entry of points) {
    if (!entry.delta) continue;
    const debt = nonNegativeInteger(actor.getFlag?.(MODULE_ID, `npc.levelPointDebt.${entry.debtKey}`));
    const next = npcApplyReward(entry.current, debt, entry.delta);
    if (!Number.isSafeInteger(next.points) || next.points > MAX_EDITABLE_POINTS || !Number.isSafeInteger(next.debt)) return false;
    if (next.points !== entry.current) update[`flags.${MODULE_ID}.${entry.key}`] = next.points;
    if (next.debt !== debt) update[`flags.${MODULE_ID}.npc.levelPointDebt.${entry.debtKey}`] = next.debt;
  }
  return update;
}
