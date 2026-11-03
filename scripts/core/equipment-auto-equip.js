/** Pick an empty compatible equipment position without swapping or losing items.
 * The current active loadout is preferred; an alternate free position may be
 * activated only after the item has been placed successfully. */
import { getSheetConfig } from './config.js';
import { normalizeInventoryConfig } from './inventory-config.js';
import { getItemRules } from './item-config.js';
import { canEquipItem } from './item-runtime.js';
import { getActorStorage, getInventoryState, moveInventoryItem, setEquipmentActivePosition } from './inventory.js';

export function findAutoEquipDestination(actor, item, config = getSheetConfig()) {
  if (!actor?.isOwner || !item?.id || !actor.items?.get?.(item.id)) return null;
  const state = getInventoryState(actor, config);
  if (state.placements[item.id]?.area === 'equipment') return null;
  const layout = normalizeInventoryConfig(config.inventory).equipmentLayout;
  const grants = getActorStorage(actor, config);
  const rules = getItemRules(item, config);
  if (!rules.equip.enabled) return null;
  // Generic equippable backpacks should prefer the backpack slot rather than
  // taking a free weapon or armor slot merely because it occurs first.
  const isBackpack = Boolean(rules.storage?.slots?.external?.length);
  const preferred = Array.isArray(rules.equip.allowedTypes) ? rules.equip.allowedTypes : [];
  const slots = layout.slots.filter(slot => (!slot.hidden || grants.unlocked.has(slot.id)) &&
    canEquipItem(actor, item, slot, config).ok);
  slots.sort((a, b) => {
    const rank = slot => isBackpack && slot.type === 'backpack' ? -2 :
      preferred.includes(slot.type) ? preferred.indexOf(slot.type) : 100;
    return rank(a) - rank(b);
  });
  const occupied = new Set(Object.entries(state.placements).filter(([id, p]) => id !== item.id && p?.area === 'equipment')
    .map(([, p]) => `${p.slotId}:${Number(p.position ?? 0)}`));
  const available = [];
  for (const slot of slots) {
    const active = Number(state.equipmentActive?.[slot.id] ?? 0);
    const positions = [active, ...Array.from({length: slot.capacity}, (_, i) => i).filter(i => i !== active)];
    for (const position of positions) {
      if (!occupied.has(`${slot.id}:${position}`)) available.push({area:'equipment',slotId:slot.id,position,
        activate:position !== active});
    }
  }
  // Never displace an equipped item automatically. Prefer matching active
  // loadouts, then offer an empty alternate slot as a fallback.
  return available.find(candidate => !candidate.activate) || available[0] || null;
}

export async function autoEquipInventoryItem(actor, item, config = getSheetConfig()) {
  const destination = findAutoEquipDestination(actor, item, config);
  if (!destination) return null;
  const result = await moveInventoryItem(actor, item.id, {
    area:'equipment',slotId:destination.slotId,position:destination.position
  }, config);
  if (!result) return null;
  if (destination.activate) await setEquipmentActivePosition(actor, destination.slotId, destination.position, config);
  return destination;
}
