import { MODULE_ID } from "./constants.js";
import { getSheetConfig, isTargetActorType } from "./config.js";
import { getResourceState, writeResourceLabelUpdate, writeResourceUpdate } from "./dnd5e.js";
import { getLinkedUserIds } from "./permissions.js";
import { getAttributeBaseProgress, writeAttributeProgressUpdate } from "./attribute-progress.js";

const UPDATE_OPTION = `${MODULE_ID}.runtime`;
const RUNTIME_VERSION = 10;

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export async function ensureActorState(actor, { isNew = false } = {}) {
  if (!actor || !actor.isOwner || !isTargetActorType(actor)) return false;

  const config = getSheetConfig();
  const update = {};

  if (game.user.isGM && actor.getFlag(MODULE_ID, "accessInitialized") !== true) {
    // Initialize independent Buxa links empty when none were explicitly selected.
    // Foundry document ownership is preserved; GM implicit access is not a loot link.
    update[`flags.${MODULE_ID}.linkedUsers`] = getLinkedUserIds(actor);
    update[`flags.${MODULE_ID}.accessInitialized`] = true;
  }

  if (actor.getFlag(MODULE_ID, "level") === undefined) {
    update[`flags.${MODULE_ID}.level`] = config.level.startingLevel;
  }

  if (actor.getFlag(MODULE_ID, "attributePoints") === undefined) {
    update[`flags.${MODULE_ID}.attributePoints`] = config.attributes.points.startingPoints;
  }

  if (actor.getFlag(MODULE_ID, "proficiencyPoints") === undefined) {
    update[`flags.${MODULE_ID}.proficiencyPoints`] = config.proficiencies.points.startingPoints;
  }

  if (actor.getFlag(MODULE_ID, "otherStats.damageReduction") === undefined) {
    update[`flags.${MODULE_ID}.otherStats.damageReduction`] = 0;
  }

  // v0.9.2+: rebirth-enabled attributes keep cumulative base progress.
  // This repairs the old temporary-item edge case where R1 with -10 should
  // really mean 90 total progress once the borrowed +10 is removed.
  for (const attribute of config.attributes?.entries ?? []) {
    if (!attribute?.rebirth?.enabled) continue;
    if (actor.getFlag(MODULE_ID, `attributes.${attribute.id}.progress`) !== undefined) continue;
    writeAttributeProgressUpdate(actor, attribute, getAttributeBaseProgress(actor, attribute), update);
  }

  const storedInitialized = actor.getFlag(MODULE_ID, "initializedResources");
  const previousInitialized = Array.isArray(storedInitialized) ? storedInitialized : [];
  const configuredResourceIds = new Set(config.resources.map((resource) => resource.id));
  const initialized = new Set(previousInitialized.filter((id) => configuredResourceIds.has(id)));
  let initializedChanged = initialized.size !== previousInitialized.length;

  for (const resource of config.resources) {
    writeResourceLabelUpdate(actor, resource, update);
    if (initialized.has(resource.id)) continue;

    const state = getResourceState(actor, resource);
    // System resources may already contain meaningful D&D 5e values before Buxa sees them.
    // Buxa-only resources should only receive startMax when their own flag has never existed.
    const shouldInitialize = state.systemLinked
      ? (state.current === 0 && state.max === 0)
      : (isNew || !state.hasStoredData);
    if (shouldInitialize) {
      const start = Math.max(0, finiteNumber(resource.startMax));
      writeResourceUpdate(actor, resource, { current: start, max: start }, update);
    }
    initialized.add(resource.id);
    initializedChanged = true;
  }

  if (initializedChanged || previousInitialized.length !== initialized.size) {
    update[`flags.${MODULE_ID}.initializedResources`] = [...initialized];
  }
  if (actor.getFlag(MODULE_ID, "runtimeVersion") !== RUNTIME_VERSION) {
    update[`flags.${MODULE_ID}.runtimeVersion`] = RUNTIME_VERSION;
  }

  if (!Object.keys(update).length) return false;
  await actor.update(update, { [UPDATE_OPTION]: true });
  return true;
}
