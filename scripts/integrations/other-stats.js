import { MODULE_ID } from "../core/constants.js";
import { getSheetConfig, isTargetActorType } from "../core/config.js";
import {
  getResourceDocumentPaths,
  readDocumentUpdateValue,
  writeDocumentUpdateValue
} from "../core/dnd5e.js";
import { getEffectiveResourceState } from "../core/resources.js";
import {
  getDamageReduction,
  getInitiativeModifier,
  reduceIncomingResourceLoss
} from "../core/other-stats.js";

const DR_BYPASS_OPTION = `${MODULE_ID}.bypassDamageReduction`;

function configuredDamageResource(config) {
  const rule = config?.otherStats?.damageReduction;
  if (!rule?.enabled || !rule.resourceId) return null;
  return config.resources.find((resource) => resource.id === rule.resourceId) ?? null;
}

function applyDamageReduction(actor, changed, options) {
  if (options?.[DR_BYPASS_OPTION]) return;

  const config = getSheetConfig();
  if (!isTargetActorType(actor, config)) return;

  const resource = configuredDamageResource(config);
  if (!resource) return;

  const paths = getResourceDocumentPaths(actor, resource);
  const pendingCurrent = readDocumentUpdateValue(changed, paths.current);
  if (!pendingCurrent.present) return;

  const requested = Number(pendingCurrent.value);
  if (!Number.isFinite(requested)) return;

  const state = getEffectiveResourceState(actor, resource, config);
  const before = Number(state.current);
  if (!Number.isFinite(before) || requested >= before) return;

  const dr = getDamageReduction(actor);
  if (dr <= 0) return;

  const pendingMax = readDocumentUpdateValue(changed, paths.max);
  const max = pendingMax.present && Number.isFinite(Number(pendingMax.value)) && !state.itemIncrease?.count
    ? Number(pendingMax.value)
    : Number(state.max);

  const reducedCurrent = reduceIncomingResourceLoss({
    before,
    requested,
    damageReduction: dr,
    max
  });

  if (reducedCurrent === requested) return;
  writeDocumentUpdateValue(changed, paths.current, reducedCurrent, pendingCurrent.shape);
}

function addInitiativeModifier(actor, rollConfig) {
  const config = getSheetConfig();
  if (!isTargetActorType(actor, config) || !config.otherStats?.initiative?.enabled) return;

  const modifier = getInitiativeModifier(actor, config);
  if (!modifier) return;

  rollConfig.data ??= {};
  rollConfig.data.buxa ??= {};
  rollConfig.data.buxa.initiative = modifier;

  if (rollConfig.options?.fixed !== undefined) {
    const fixed = Number(rollConfig.options.fixed);
    if (Number.isFinite(fixed)) rollConfig.options.fixed = fixed + modifier;
    return;
  }

  rollConfig.parts ??= [];
  if (!rollConfig.parts.includes("@buxa.initiative")) rollConfig.parts.push("@buxa.initiative");
}

export function registerOtherStatsIntegration() {
  Hooks.on("preUpdateActor", applyDamageReduction);
  Hooks.on("dnd5e.preConfigureInitiative", addInitiativeModifier);
}

export const OTHER_STATS_UPDATE_OPTIONS = Object.freeze({
  BYPASS_DAMAGE_REDUCTION: DR_BYPASS_OPTION
});
