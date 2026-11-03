/** Per-NPC sheet display and GM-only combat-value overrides.
 * Overrides deliberately affect computed rolls without changing progression
 * investment, resource pools, equipment or inventory flags.
 */
import { MODULE_ID } from "./constants.js";
import { withProgressMutation } from "./progression-safety.js";
import { npcLevelUpdate } from "./npc-level-rewards.js";

export function isBuxaNpc(actor) {
  return actor?.type === "npc";
}

export function getNpcSheetMode(actor) {
  if (!isBuxaNpc(actor)) return "visual";
  return actor.getFlag?.(MODULE_ID, "npc.sheetMode") === "visual" ? "visual" : "quick";
}

export function isNpcQuick(actor) {
  return isBuxaNpc(actor) && getNpcSheetMode(actor) === "quick";
}

export function getNpcAttributeOverride(actor, attributeId, key) {
  if (!isBuxaNpc(actor) || !attributeId || !["value", "modifier", "dice"].includes(key)) return null;
  const raw = actor.getFlag?.(MODULE_ID, `npc.attributeOverrides.${attributeId}.${key}`);
  if (raw === undefined || raw === null || raw === "") return null;
  const number = Number(raw);
  if (!Number.isSafeInteger(number)) return null;
  if (key === "dice" && (number < 1 || number > 100)) return null;
  if (key === "value" && (number < 0 || number > 999999)) return null;
  if (key === "modifier" && Math.abs(number) > 99999) return null;
  return number;
}

export async function saveNpcSheetMode(actor, mode) {
  if (!isBuxaNpc(actor) || !globalThis.game?.user?.isGM || !actor.isOwner || !["quick", "visual"].includes(mode)) return false;
  if (getNpcSheetMode(actor) === mode) return true;
  await actor.update({ [`flags.${MODULE_ID}.npc.sheetMode`]: mode });
  return true;
}

/** Empty input clears an override; the calculated game value is restored. */
export async function saveNpcAttributeOverrides(actor, attributeId, fields) {
  if (!isBuxaNpc(actor) || !globalThis.game?.user?.isGM || !actor.isOwner || !attributeId) return false;
  if (!fields || typeof fields !== "object") return false;
  const updates = {};
  for (const [key, bounds] of Object.entries({ value: [0, 999999], modifier: [-99999, 99999], dice: [1, 100] })) {
    if (!Object.hasOwn(fields, key)) continue;
    const raw = fields[key];
    if (raw !== null && raw !== "" && raw !== undefined) {
      const number = Number(raw);
      if (!Number.isSafeInteger(number) || number < bounds[0] || number > bounds[1]) return false;
      updates[`flags.${MODULE_ID}.npc.attributeOverrides.${attributeId}.${key}`] = number;
    } else {
      updates[`flags.${MODULE_ID}.npc.attributeOverrides.${attributeId}.${key}`] = null;
    }
  }
  if (!Object.keys(updates).length) return false;
  await actor.update(updates);
  return true;
}

export async function setNpcProgressionNumber(actor, key, raw) {
  if (!isBuxaNpc(actor) || !globalThis.game?.user?.isGM || !actor.isOwner) return false;
  if (!["level", "attributePoints", "proficiencyPoints"].includes(key)) return false;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0 || value > 999999 || raw === "" || raw === null) return false;
  return withProgressMutation(actor, async () => {
    if (key === "level") {
      const update = npcLevelUpdate(actor, value);
      if (update === false) return false;
      if (update === null) return true;
      await actor.update(update, { [`${MODULE_ID}.npcDirectEdit`]: true });
      return true;
    }
    // Explicit GM edits of a point pool establish a new unspent balance.
    // Also clear its older level-reward debt, so direct edits stay authoritative.
    await actor.update({
      [`flags.${MODULE_ID}.${key}`]: value,
      [`flags.${MODULE_ID}.npc.levelPointDebt.${key}`]: 0
    }, { [`${MODULE_ID}.npcDirectEdit`]: true });
    return true;
  });
}
