// Compatibility barrel for existing imports and the public Buxa API.
// Domain logic lives in focused modules so this file never becomes a monolith.
export { ensureActorState } from "./actor-state.js";
export { getLinkedUserIds, setLinkedUsers } from "./permissions.js";
export { getActorLevel, canLevelUp, levelUpActor } from "./leveling.js";
export { updateResource, getEffectiveResourceState, synchronizeConfiguredResourceLabels } from "./resources.js";
export {
  getAttributePoints,
  getAttributeValue,
  getAttributeRebirths,
  getAttributeRebirthState,
  getAttributeModifier,
  getAttributeDice,
  getAttributeVisual,
  canDecreaseAttribute,
  changeAttribute,
  setAttributeDirect,
  addAttributePoints,
  rebirthAttribute
} from "./attributes.js";

export {
  getDamageReduction,
  setDamageReduction,
  getInitiativeAttribute,
  getInitiativeModifier,
  reduceIncomingResourceLoss
} from "./other-stats.js";

export {
  getProficiencyPoints,
  getProficiencyValue,
  getLinkedProficiencyAttribute,
  getLinkedProficiencyModifier,
  getProficiencyBaseModifier,
  getProficiencyModifier,
  canDecreaseProficiency,
  changeProficiency
} from "./proficiencies.js";


export {
  getInventoryState,
  getTrackedInventoryItemIds,
  moveInventoryItem,
  setInventoryAutoSort,
  setInventorySortMode,
  setEquipmentActivePosition,
  cycleEquipmentSlot,
  reconcileInventoryState
} from "./inventory.js";

export { getEquippedItemIncreaseEntries, getActiveItemIncreaseEntries, getItemIncreaseAggregate, getEffectiveItemValue } from "./item-effects.js";
export { getItemDiceEntry, resolveItemDice, rollItemDice } from "./item-dice.js";
