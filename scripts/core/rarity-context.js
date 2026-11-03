/** Presentation context only. Equipment is read using the same normalized
 * active-slot state as inventory; nothing is persisted or synchronized here. */
import { getInventoryState } from './inventory.js';
import { getItemRarity, normalizeItemSystemConfig } from './item-config.js';
import { resolveRarityVisual, visualColor } from './rarity-visuals.js';

export function actorRarityContext(actor, config = {}) {
  const rarities = normalizeItemSystemConfig(config.items).rarities;
  const fallback = rarities.find(r => r.id === 'common') ?? rarities[0];
  if (!actor?.items?.[Symbol.iterator]) return fallback;
  const state = getInventoryState(actor, config);
  let highest = null, rank = -1;
  for (const item of actor.items) {
    const p = state.placements[item.id];
    if (p?.area !== 'equipment' || Number(p.position ?? 0) !== Number(state.equipmentActive[p.slotId] ?? 0)) continue;
    const rarity = getItemRarity(item, config);
    // Unknown rarities follow their configured order; default IDs retain their
    // established identity even if a GM has reordered the configuration list.
    const theme = resolveRarityVisual(rarity);
    const value = theme.rank === 1 && rarity.id !== 'common' ? rarities.findIndex(r => r.id === rarity.id) : theme.rank;
    if (value > rank) { highest = rarity; rank = value; }
  }
  return highest ?? fallback;
}

export function rebirthRarityContext(attribute, tier, config = {}, color) {
  const rarities = normalizeItemSystemConfig(config.items).rarities;
  const styles = Array.isArray(config.rebirthStyles) ? config.rebirthStyles : [];
  const style = styles[Math.max(0, Math.floor(Number(tier) || 1) - 1)] ?? styles.at(-1) ?? {};
  const id = style.rarityId || attribute?.appearance?.rarityId;
  const exact = rarities.find(r => r.id === id)
    ?? rarities.find(r => r.color?.toLowerCase() === String(color).toLowerCase());
  // Existing worlds store rebirth colors rather than rarity IDs. Pick the
  // nearest configured palette, keeping their exact authored color intact.
  const rgb = c => [1, 3, 5].map(n => parseInt(visualColor(c).slice(n, n + 2), 16));
  const target = rgb(color);
  const nearest = [...rarities].sort((a, b) => {
    const distance = r => rgb(r.color).reduce((sum, c, i) => sum + (c - target[i]) ** 2, 0);
    return distance(a) - distance(b);
  })[0];
  return { ...(exact ?? nearest), color: visualColor(color, exact?.color ?? nearest.color) };
}
