/** Shared "how impressive is this rarity" score (0-4) used by loot beams,
 * pickup nameplates and rarity effects. Pure: no DOM, no Foundry globals.
 * Base comes from well-known ids; every rarity flag the GM enables on a custom
 * rarity (ornament, glint, animated, spectrum) pushes the tier up one step. */
const BASE = {
  junk: 0, trash: 0, common: 0, normal: 0,
  uncommon: 1, magic: 1, rare: 1,
  epic: 2, unique: 2, special: 2, secret: 2,
  legendary: 3, mythic: 3, relic: 3, masterwork: 3, ancestral: 3,
  divine: 4, godly: 4, transcendent: 4
};
export const MAX_RARITY_TIER = 4;

// Imported settings can contain string-valued booleans. Do not promote an
// item's rarity for a disabled effect in an older world or module export.
export const rarityFlagEnabled = value => value === true || value === 1 ||
  (typeof value === 'string' && ['true', '1', 'yes', 'on', 'enabled'].includes(value.trim().toLowerCase()));

export function rarityTier(rarity) {
  const id = String(rarity?.id ?? '').trim().toLowerCase();
  const base = Object.hasOwn(BASE, id) ? BASE[id] : 1;
  const flags = ['ornament', 'glint', 'animated', 'spectrum'].reduce((n, key) => n + (rarityFlagEnabled(rarity?.[key]) ? 1 : 0), 0);
  return Math.max(0, Math.min(MAX_RARITY_TIER, base + flags));
}
