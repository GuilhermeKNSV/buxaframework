import { savedNumber } from "./stored-values.js";
import { MODULE_ID, RESOURCE_LINKS } from "./constants.js";

const RESOURCE_PATHS = Object.freeze({
  [RESOURCE_LINKS.HP]: {
    value: "system.attributes.hp.value",
    max: "system.attributes.hp.max",
    label: null
  },
  [RESOURCE_LINKS.PRIMARY]: {
    value: "system.resources.primary.value",
    max: "system.resources.primary.max",
    label: "system.resources.primary.label"
  },
  [RESOURCE_LINKS.SECONDARY]: {
    value: "system.resources.secondary.value",
    max: "system.resources.secondary.max",
    label: "system.resources.secondary.label"
  },
  [RESOURCE_LINKS.TERTIARY]: {
    value: "system.resources.tertiary.value",
    max: "system.resources.tertiary.max",
    label: "system.resources.tertiary.label"
  }
});

function isDnd5e() {
  return game.system?.id === "dnd5e";
}

function getDndResourcePaths(link) {
  return RESOURCE_PATHS[link] ?? null;
}

function canUseDndResource(actor, link) {
  if (!actor || !isDnd5e()) return false;
  if (link === RESOURCE_LINKS.HP) return foundry.utils.hasProperty(actor, "system.attributes.hp");
  if (![RESOURCE_LINKS.PRIMARY, RESOURCE_LINKS.SECONDARY, RESOURCE_LINKS.TERTIARY].includes(link)) return false;
  return foundry.utils.hasProperty(actor, `system.resources.${link}`);
}


export function getResourceDocumentPaths(actor, resource) {
  const link = resource?.link ?? RESOURCE_LINKS.BUXA;
  const paths = getDndResourcePaths(link);
  if (paths && canUseDndResource(actor, link)) {
    return { current: paths.value, max: paths.max, label: paths.label, systemLinked: true };
  }
  return {
    current: `flags.${MODULE_ID}.resources.${resource?.id}.value`,
    max: `flags.${MODULE_ID}.resources.${resource?.id}.max`,
    label: null,
    systemLinked: false
  };
}

export function readDocumentUpdateValue(changed, path) {
  if (!changed || !path) return { present: false, value: undefined, shape: null };
  if (Object.hasOwn(changed, path)) return { present: true, value: changed[path], shape: "flat" };
  if (foundry.utils.hasProperty(changed, path)) {
    return { present: true, value: foundry.utils.getProperty(changed, path), shape: "nested" };
  }
  return { present: false, value: undefined, shape: null };
}

export function writeDocumentUpdateValue(changed, path, value, shape = null) {
  if (!changed || !path) return changed;
  if (shape === "flat" || Object.hasOwn(changed, path)) changed[path] = value;
  else foundry.utils.setProperty(changed, path, value);
  return changed;
}

export function getResourceState(actor, resource) {
  const start = Number(resource?.startMax ?? 0) || 0;
  const link = resource?.link ?? RESOURCE_LINKS.BUXA;
  const paths = getDndResourcePaths(link);

  if (paths && canUseDndResource(actor, link)) {
    const current = savedNumber(foundry.utils.getProperty(actor, paths.value), NaN);
    const max = savedNumber(foundry.utils.getProperty(actor, paths.max), NaN);
    return {
      current: Number.isFinite(current) ? current : start,
      max: Number.isFinite(max) ? max : start,
      systemLinked: true,
      hasStoredData: Number.isFinite(current) || Number.isFinite(max),
      link
    };
  }

  const stored = actor?.getFlag?.(MODULE_ID, `resources.${resource.id}`) ?? {};
  const current = savedNumber(stored.value, NaN);
  const max = savedNumber(stored.max, NaN);
  return {
    current: Number.isFinite(current) ? current : start,
    max: Number.isFinite(max) ? max : start,
    systemLinked: false,
    hasStoredData: Number.isFinite(current) || Number.isFinite(max),
    link: RESOURCE_LINKS.BUXA
  };
}

export function writeResourceUpdate(actor, resource, { current, max }, update = {}) {
  const link = resource?.link ?? RESOURCE_LINKS.BUXA;
  const paths = getDndResourcePaths(link);
  const systemLinked = Boolean(paths && canUseDndResource(actor, link));

  if (systemLinked) {
    if (current !== undefined) update[paths.value] = current;
    if (max !== undefined) update[paths.max] = max;
    if (paths.label) update[paths.label] = resource.label;
    return update;
  }

  if (current !== undefined) update[`flags.${MODULE_ID}.resources.${resource.id}.value`] = current;
  if (max !== undefined) update[`flags.${MODULE_ID}.resources.${resource.id}.max`] = max;
  return update;
}

export function writeResourceLabelUpdate(actor, resource, update = {}) {
  const paths = getDndResourcePaths(resource?.link);
  if (paths?.label && canUseDndResource(actor, resource.link)) {
    const current = String(foundry.utils.getProperty(actor, paths.label) ?? "");
    if (current !== String(resource.label ?? "")) update[paths.label] = resource.label;
  }
  return update;
}

export function getAbilityValue(actor, ability) {
  const value = Number(foundry.utils.getProperty(actor, `system.abilities.${ability}.value`));
  return Number.isFinite(value) ? value : 0;
}

export function writeAbilityValueUpdate(actor, ability, value, update = {}) {
  if (!actor || !isDnd5e() || !foundry.utils.hasProperty(actor, `system.abilities.${ability}`)) return update;
  // D&D 5e v6's schema requires ability scores to be >= 0.
  update[`system.abilities.${ability}.value`] = Math.max(0, Math.round(Number(value) || 0));
  return update;
}

export function getAbilityOptions() {
  const configured = CONFIG.DND5E?.abilities ?? {};
  const ids = ["str", "dex", "con", "int", "wis", "cha"];
  return ids.map((id) => ({
    id,
    label: configured[id]?.label ? game.i18n.localize(configured[id].label) : id.toUpperCase()
  }));
}

export function getItemQuantity(item) {
  const quantity = savedNumber(foundry.utils.getProperty(item, "system.quantity"), 1);
  return Math.max(0, quantity);
}

export async function synchronizeInventoryEquippedStates(actor, changes = []) {
  if (!actor || !isDnd5e() || !Array.isArray(changes) || !changes.length) return [];
  const updates = [];
  for (const change of changes) {
    const item = actor.items?.get?.(change.itemId);
    if (!item || !foundry.utils.hasProperty(item, "system.equipped")) continue;
    const equipped = Boolean(change.equipped);
    if (Boolean(foundry.utils.getProperty(item, "system.equipped")) === equipped) continue;
    updates.push({ _id: item.id, "system.equipped": equipped });
  }
  if (!updates.length) return [];
  return actor.updateEmbeddedDocuments("Item", updates, { [`${MODULE_ID}.inventory`]: true });
}
