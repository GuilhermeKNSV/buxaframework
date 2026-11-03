import { MODULE_ID } from "./constants.js";
import { getActorUiState, patchActorUiState } from "./ui-state.js";

function validUiConfig(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

export function getAttributeUiConfig(actor) {
  const clientStored = validUiConfig(getActorUiState(actor)?.attributeUi);
  if (clientStored) return foundry.utils.deepClone(clientStored);

  // v0.5.13 and earlier stored presentation state on the Actor. Read it as a
  // migration fallback, but all future changes are client-local.
  const legacyStored = validUiConfig(actor?.getFlag?.(MODULE_ID, "attributeUi"));
  return legacyStored ? foundry.utils.deepClone(legacyStored) : {};
}

export async function migrateLegacyAttributeUi(actor) {
  if (validUiConfig(getActorUiState(actor)?.attributeUi)) return false;
  const legacyStored = validUiConfig(actor?.getFlag?.(MODULE_ID, "attributeUi"));
  if (!legacyStored) return false;
  await patchActorUiState(actor, { attributeUi: foundry.utils.deepClone(legacyStored) });
  return true;
}

async function setAttributeUiConfig(actor, uiConfig) {
  if (!actor?.isOwner) return false;
  await patchActorUiState(actor, { attributeUi: foundry.utils.deepClone(uiConfig) });
  return true;
}

async function patchAttributeUi(actor, attributeId, patch = {}) {
  if (!attributeId) return false;
  const uiConfig = getAttributeUiConfig(actor);
  uiConfig[attributeId] = foundry.utils.mergeObject(
    uiConfig[attributeId] || {},
    patch,
    { inplace: false, insertKeys: true, overwrite: true }
  );
  return setAttributeUiConfig(actor, uiConfig);
}

export async function toggleAttributeLock(actor, attributeId) {
  const current = getAttributeUiConfig(actor)?.[attributeId]?.locked === true;
  return patchAttributeUi(actor, attributeId, { locked: !current });
}

export async function toggleAttributeCollapse(actor, attributeId) {
  const uiConfig = getAttributeUiConfig(actor);
  const current = uiConfig?.[attributeId]?.collapsed === true;
  const locked = uiConfig?.[attributeId]?.locked === true;
  if (locked) return false;
  return patchAttributeUi(actor, attributeId, { collapsed: !current });
}

export async function setAttributeOrder(actor, idOrder = []) {
  if (!actor?.isOwner) return false;
  const uiConfig = getAttributeUiConfig(actor);
  idOrder.forEach((id, index) => {
    if (!id) return;
    uiConfig[id] = foundry.utils.mergeObject(
      uiConfig[id] || {},
      { order: index },
      { inplace: false, insertKeys: true, overwrite: true }
    );
  });
  return setAttributeUiConfig(actor, uiConfig);
}
