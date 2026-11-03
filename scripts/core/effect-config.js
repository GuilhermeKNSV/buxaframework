/** Effects are ordinary Foundry Item documents with their own Buxa rules. */
import { MODULE_ID, EFFECT_FLAG, ITEM_KINDS } from './constants.js';
import { normalizeItemSystemConfig } from './item-config.js';
import { normalizeItemResourceEffects } from './item-use-config.js';
import { normalizeItemIncreases } from './item-increase-config.js';
import { normalizeItemDice } from './item-dice-config.js';
import { normalizeDescriptionParts } from './item-discovery.js';
import { booleanField } from './numeric-field.js';

const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const integer = (value, fallback, min, max) => Number.isFinite(Number(value)) && String(value).trim() !== ''
  ? Math.max(min, Math.min(max, Math.round(Number(value)))) : fallback;
const choice = (value, options, fallback) => options.includes(value) ? value : fallback;
const text = (value, max) => String(value ?? '').slice(0, max);

export function getItemKind(item) {
  return choice(item?.getFlag?.(MODULE_ID, 'itemKind') ?? item?.flags?.[MODULE_ID]?.itemKind, Object.values(ITEM_KINDS), ITEM_KINDS.ITEM);
}

export function normalizeEffectRules(input, itemSystemConfig = normalizeItemSystemConfig()) {
  const raw = object(input);
  const rarities = normalizeItemSystemConfig(itemSystemConfig).rarities;
  const id = rarities.some(r => r.id === raw.rarityId) ? raw.rarityId
    : (rarities.find(r => r.id === 'common') ?? rarities[0])?.id ?? 'common';
  const desc = object(raw.description);
  const triggers = object(raw.triggers);
  const duration = object(raw.duration);
  return {
    version: 1,
    rarityId: id,
    behavior: choice(raw.behavior, ['timed', 'passive'], 'timed'),
    description: {
      enabled: booleanField(desc.enabled),
      mode: choice(desc.mode, ['standard', 'modular'], Array.isArray(desc.parts) && desc.parts.length ? 'modular' : 'standard'),
      text: text(desc.text, 10000),
      parts: normalizeDescriptionParts(desc.parts, desc.text)
    },
    triggers: {
      onApply: booleanField(triggers.onApply),
      onRemove: booleanField(triggers.onRemove),
      onCombatTurnStart: booleanField(triggers.onCombatTurnStart),
      onCombatTurnEnd: booleanField(triggers.onCombatTurnEnd)
    },
    duration: {mode: choice(duration.mode, ['turns', 'permanent'], 'turns'), value: integer(duration.value, 1, 1, 100000)},
    stackBehavior: choice(raw.stackBehavior, ['replace', 'stack', 'refresh'], 'refresh'),
    tickLabel: text(raw.tickLabel, 80),
    resourceEffects: normalizeItemResourceEffects(raw.resourceEffects),
    increases: normalizeItemIncreases(raw.increases),
    dice: normalizeItemDice(raw.dice),
    visibility: choice(raw.visibility, ['revealed', 'hidden', 'dmOnly'], 'revealed')
  };
}
export function getEffectRules(item, config) {
  return normalizeEffectRules(item?.getFlag?.(MODULE_ID, EFFECT_FLAG), normalizeItemSystemConfig(config?.items));
}
export function getEffectRarity(item, config) {
  const rarities = normalizeItemSystemConfig(config?.items).rarities;
  return rarities.find(r => r.id === getEffectRules(item, config).rarityId) ?? rarities[0];
}
export function normalizeActiveEffect(value) {
  const raw = object(value), applied = object(raw.appliedAt), expires = object(raw.expiresAt);
  return {
    instanceId: text(raw.instanceId, 80), effectItemId: text(raw.effectItemId, 128),
    sourceItemId: text(raw.sourceItemId, 128),
    behavior: choice(raw.behavior, ['timed', 'passive'], 'timed'),
    appliedAt: { round: integer(applied.round, 0, 0, 10000000), turn: integer(applied.turn, 0, 0, 100000) },
    expiresAt: raw.expiresAt == null ? null : {round:integer(expires.round, 0, 0, 10000000),turn:integer(expires.turn, 0, 0, 100000)},
    stackCount: integer(raw.stackCount, 1, 1, 9999), progress: integer(raw.progress, 0, 0, 10000000),
    rarityId: text(raw.rarityId, 100)
  };
}
export async function saveEffectRules(item, data, config) {
  if (!globalThis.game?.user?.isGM || !item?.update) return null;
  const normalized = normalizeEffectRules(data, normalizeItemSystemConfig(config?.items));
  await item.update({
    name: String(data?.name ?? item.name).trim() || item.name,
    img: String(data?.img ?? item.img ?? 'icons/svg/aura.svg') || 'icons/svg/aura.svg',
    [`flags.${MODULE_ID}.${EFFECT_FLAG}`]: normalized,
    [`flags.${MODULE_ID}.itemKind`]: ITEM_KINDS.EFFECT
  }, { [`${MODULE_ID}.effectConfig`]: true });
  return normalized;
}
