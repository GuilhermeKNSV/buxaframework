import { savedBoolean } from "./stored-values.js";
import { normalizeNpcDropping } from "./npc-dropping.js";
import { emitProgressHook } from "./progression-safety.js";
import {
  DEFAULT_REBIRTH_STYLES,
  DEFAULT_RESOURCE_LEVEL_UP,
  DEFAULT_SHEET_CONFIG,
  HOOKS,
  MODULE_ID,
  RESOURCE_LINKS,
  SETTINGS
} from "./constants.js";
import { normalizeProficiencies } from "./proficiency-config.js";
import { normalizeInventoryConfig } from "./inventory-config.js";
import { normalizeItemSystemConfig } from "./item-config.js";
import { normalizeNumberDisplay } from "./number-display.js";
import { normalizeUiSettings } from "./notification-settings.js";

function clone(value) {
  return foundry.utils.deepClone(value);
}

function slugify(value, fallback = "item") {
  const slug = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `${fallback}-${foundry.utils.randomID(6).toLowerCase()}`;
}

function uniqueId(candidate, used, fallback) {
  let id = slugify(candidate, fallback);
  let suffix = 2;
  const base = id;
  while (used.has(id)) id = `${base}-${suffix++}`;
  used.add(id);
  return id;
}

function asInt(value, fallback = 0, { min = -Infinity, max = Infinity } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function asNumber(value, fallback = 0, { min = -Infinity, max = Infinity } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function normalizeColor(value, fallback = "#4f7fdb") {
  const color = String(value ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : fallback;
}


function romanNumeral(value) {
  const n = Math.max(1, Math.min(3999, asInt(value, 1, { min: 1 })));
  const table = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
    [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]
  ];
  let remaining = n;
  let output = "";
  for (const [amount, symbol] of table) {
    while (remaining >= amount) {
      output += symbol;
      remaining -= amount;
    }
  }
  return output;
}

function defaultRebirthStyles(count = 20) {
  const wanted = Math.max(1, asInt(count, 20, { min: 1, max: 100 }));
  return Array.from({ length: wanted }, (_, index) => {
    const fallback = DEFAULT_REBIRTH_STYLES[index] ?? DEFAULT_REBIRTH_STYLES.at(-1);
    const level = index + 1;
    return {
      color: fallback?.color || "#f1f4ff",
      decoration: fallback?.decoration || romanNumeral(level)
    };
  });
}


function legacyDefaultRebirthColor(level) {
  if (level >= 20) return "#d35b72";
  if (level >= 15) return "#9b73d9";
  if (level >= 10) return "#d5a814";
  if (level >= 5) return "#6fa7cf";
  return "#a9824c";
}

function isLegacyDefaultRebirthStyles(input) {
  if (!Array.isArray(input) || input.length !== 20) return false;
  return input.every((style, index) => {
    const level = index + 1;
    return String(style?.color || "").toLowerCase() === legacyDefaultRebirthColor(level)
      && String(style?.decoration || "") === romanNumeral(level);
  });
}
function normalizeDecoration(value, fallback = "◆") {
  const text = String(value ?? fallback).trim();
  return (text || fallback).slice(0, 10);
}

// Earlier builds saved an almost-black R1 as the default. Upgrade ONLY that
// untouched historical palette; keep every user-edited rarity color intact.
const LEGACY_REBIRTH_PALETTE = [
  "#151a24", "#8b93a1", "#55b86a", "#4d8fe6", "#9b6de3",
  "#d6a832", "#e58638", "#df5b67", "#e85aa5", "#50c8ce",
  "#69d7ff", "#7e7dff", "#b46bff", "#ff66d1", "#ff6b7a",
  "#ff9350", "#ffd95a", "#c7ff67", "#78f0b8", "#f1f4ff"
];

function normalizeRebirthStyles(input) {
  const hasIncoming = Array.isArray(input) && input.length > 0;
  const incoming = hasIncoming ? input : [];
  const count = hasIncoming ? Math.min(100, incoming.length) : 20;
  const defaults = defaultRebirthStyles(count);
  const isOldUneditedPalette = count === 20 && incoming.length === 20
    && incoming.every((style, index) =>
      String(style?.color ?? "").toLowerCase() === LEGACY_REBIRTH_PALETTE[index]
      && String(style?.decoration ?? "") === romanNumeral(index + 1));
  return defaults.map((fallback, index) => {
    const raw = incoming[index] && typeof incoming[index] === "object" ? incoming[index] : {};
    return {
      color: isOldUneditedPalette ? fallback.color : normalizeColor(raw.color, fallback.color),
      decoration: normalizeDecoration(raw.decoration, fallback.decoration)
    };
  });
}


function normalizeIcon(input) {
  const raw = input && typeof input === "object" ? input : {};
  return {
    enabled: savedBoolean(raw.enabled),
    path: String(raw.path || "").trim().slice(0, 500)
  };
}

function normalizeLevelUp(input) {
  const raw = input && typeof input === "object" ? input : {};
  const validModes = new Set(["none", "flat", "percent", "full"]);
  const restoreMode = validModes.has(raw.restoreMode) ? raw.restoreMode : "none";
  return {
    maxGain: asNumber(raw.maxGain, DEFAULT_RESOURCE_LEVEL_UP.maxGain, { min: 0 }),
    maxEveryLevels: asInt(raw.maxEveryLevels, 1, { min: 1 }),
    restoreMode,
    restoreAmount: asNumber(raw.restoreAmount, 0, { min: 0 }),
    restoreEveryLevels: asInt(raw.restoreEveryLevels, 1, { min: 1 })
  };
}

function normalizeResource(input, fallback, { locked = false, forceLink = null } = {}) {
  const raw = input && typeof input === "object" ? input : {};
  const allowedLinks = new Set(Object.values(RESOURCE_LINKS));
  const link = forceLink ?? (allowedLinks.has(raw.link) ? raw.link : fallback.link);
  return {
    id: fallback.id,
    label: String(raw.label || fallback.label).trim() || fallback.label,
    color: normalizeColor(raw.color, fallback.color),
    startMax: asNumber(raw.startMax, fallback.startMax, { min: 0 }),
    syncCurrentOnMax: savedBoolean(raw.syncCurrentOnMax,true),
    link,
    locked,
    icon: normalizeIcon(raw.icon),
    levelUp: normalizeLevelUp(raw.levelUp)
  };
}

function normalizeCustomResource(input, used, occupiedSystemLinks = new Set()) {
  const raw = input && typeof input === "object" ? input : {};
  const id = uniqueId(raw.id || raw.label || "resource", used, "resource");
  const allowedLinks = new Set([
    RESOURCE_LINKS.BUXA,
    RESOURCE_LINKS.PRIMARY,
    RESOURCE_LINKS.SECONDARY,
    RESOURCE_LINKS.TERTIARY
  ]);
  let link = allowedLinks.has(raw.link) ? raw.link : RESOURCE_LINKS.BUXA;
  if (link !== RESOURCE_LINKS.BUXA) {
    if (occupiedSystemLinks.has(link)) link = RESOURCE_LINKS.BUXA;
    else occupiedSystemLinks.add(link);
  }
  return {
    id,
    label: String(raw.label || "RESOURCE").trim() || "RESOURCE",
    color: normalizeColor(raw.color, "#8c65c6"),
    startMax: asNumber(raw.startMax, 0, { min: 0 }),
    syncCurrentOnMax: savedBoolean(raw.syncCurrentOnMax,true),
    link,
    locked: false,
    icon: normalizeIcon(raw.icon),
    levelUp: normalizeLevelUp(raw.levelUp)
  };
}

function normalizePoints(input) {
  const raw = input && typeof input === "object" ? input : {};
  return {
    enabled: savedBoolean(raw.enabled),
    label: String(raw.label || "PONTOS").trim() || "PONTOS",
    startingPoints: asInt(raw.startingPoints, 0, { min: 0 }),
    grantAmount: asInt(raw.grantAmount, 1, { min: 0 }),
    grantEveryLevels: asInt(raw.grantEveryLevels, 1, { min: 1 }),
    playersCanDecrease: savedBoolean(raw.playersCanDecrease),
    directValueEntry: raw.directValueEntry !== undefined ? savedBoolean(raw.directValueEntry) : savedBoolean(raw.rightClickEdit, true),
    allowBelowZero: savedBoolean(raw.allowBelowZero)
  };
}

function normalizeAttribute(input, used, { migrateLegacyYellow = false } = {}) {
  const raw = input && typeof input === "object" ? input : {};
  const id = uniqueId(raw.id || raw.label || "attribute", used, "attribute");
  const ability = ["str", "dex", "con", "int", "wis", "cha"].includes(raw.ability) ? raw.ability : "str";
  const modifierRaw = raw.modifier && typeof raw.modifier === "object" ? raw.modifier : {};
  const appearanceRaw = raw.appearance && typeof raw.appearance === "object" ? raw.appearance : {};
  const rebirthRaw = raw.rebirth && typeof raw.rebirth === "object" ? raw.rebirth : {};

  // v0.2.x compatibility: old dice settings are migrated to a simple d20-count rule.
  const oldDiceEnabled = rebirthRaw.diceEnabled === true;
  const migratedDiceEvery = oldDiceEnabled ? asInt(rebirthRaw.diceEveryRebirths, 1, { min: 1 }) : 1;

  return {
    id,
    label: String(raw.label || "ATTRIBUTE").trim() || "ATTRIBUTE",
    ability,
    icon: normalizeIcon(raw.icon),
    appearance: {
      color: migrateLegacyYellow && String(appearanceRaw.color || "").toLowerCase() === "#d5a814"
        ? "#151a24"
        : normalizeColor(appearanceRaw.color, "#151a24"),
      decoration: normalizeDecoration(appearanceRaw.decoration, "◆")
    },
    modifier: {
      enabled: savedBoolean(modifierRaw.enabled),
      everyPoints: asInt(modifierRaw.everyPoints, 5, { min: 1 })
    },
    rebirth: {
      enabled: savedBoolean(rebirthRaw.enabled),
      maxPoints: asInt(rebirthRaw.maxPoints, 20, { min: 1 }),
      gainDieEveryRebirths: asInt(rebirthRaw.gainDieEveryRebirths ?? migratedDiceEvery, 1, { min: 1 }),
      lockModifier: savedBoolean(rebirthRaw.lockModifier),
      baseModifierCap: asInt(rebirthRaw.baseModifierCap, 2, { min: 0 }),
      modifierCapPerRebirth: asInt(rebirthRaw.modifierCapPerRebirth, 1, { min: 0 })
    }
  };
}


function normalizeAddons(input) {
  const raw = input && typeof input === "object" ? input : {};
  const svgRaw = raw.svgIcons && typeof raw.svgIcons === "object" ? raw.svgIcons : {};
  const carouselRaw = raw.carouselTracker && typeof raw.carouselTracker === "object" ? raw.carouselTracker : {};
  const sequencerRaw = raw.sequencer && typeof raw.sequencer === "object" ? raw.sequencer : {};
  const iconSourceRaw = raw.iconSource && typeof raw.iconSource === "object" ? raw.iconSource : {};
  const iconSourceType = ["data", "public"].includes(iconSourceRaw.source) ? iconSourceRaw.source : "data";
  return {
    svgIcons: { enabled: savedBoolean(svgRaw.enabled) },
    iconSource: {
      source: iconSourceType,
      path: String(iconSourceRaw.path || "").trim().replace(/^\/+/, "").replace(/\\/g, "/").slice(0, 500)
    },
    carouselTracker: { enabled: savedBoolean(carouselRaw.enabled,true) },
    sequencer: {
      enabled: savedBoolean(sequencerRaw.enabled),
      effectFile: String(sequencerRaw.effectFile ?? "").trim().slice(0,500)
    }
  };
}

function normalizeOtherStats(input, resources, attributes) {
  const raw = input && typeof input === "object" ? input : {};
  const damageRaw = raw.damageReduction && typeof raw.damageReduction === "object" ? raw.damageReduction : {};
  const initiativeRaw = raw.initiative && typeof raw.initiative === "object" ? raw.initiative : {};

  const resourceIds = new Set(resources.map((resource) => resource.id));
  const attributeIds = new Set(attributes.map((attribute) => attribute.id));
  const requestedResource = String(damageRaw.resourceId || "hp");
  const requestedAttribute = String(initiativeRaw.attributeId || "");

  return {
    damageReduction: {
      enabled: savedBoolean(damageRaw.enabled),
      resourceId: resourceIds.has(requestedResource) ? requestedResource : (resources[0]?.id || "hp")
    },
    initiative: {
      enabled: savedBoolean(initiativeRaw.enabled),
      attributeId: attributeIds.has(requestedAttribute) ? requestedAttribute : ""
    }
  };
}

export function normalizeSheetConfig(input) {
  const raw = input && typeof input === "object" ? input : {};
  const output = clone(DEFAULT_SHEET_CONFIG);

  output.version = 19;
  output.ui = normalizeUiSettings(raw.ui);
  output.basicTabLabel = String(raw.basicTabLabel || output.basicTabLabel).trim() || "BÁSICO";
  output.numberDisplay = normalizeNumberDisplay(raw.numberDisplay);
  output.makeDefault = savedBoolean(raw.makeDefault,true);
  output.actorTypes = Array.isArray(raw.actorTypes)
    ? [...new Set(raw.actorTypes.map((type) => String(type).trim()).filter(Boolean))]
    : [];

  const incomingFields = Array.isArray(raw.fields) ? raw.fields : [];
  const fields = [];
  const usedFields = new Set();
  const incomingName = incomingFields.find((field) => field?.id === "name" || field?.binding === "name");
  fields.push({
    id: "name",
    label: String(incomingName?.label || "NOME").trim() || "NOME",
    width: clampWidth(incomingName?.width ?? 12),
    binding: "name",
    locked: true
  });
  usedFields.add("name");

  for (const field of incomingFields) {
    if (!field || field === incomingName || field.id === "name" || field.binding === "name") continue;
    const id = uniqueId(field.id || field.label, usedFields, "field");
    fields.push({
      id,
      label: String(field.label || id).trim() || id,
      width: clampWidth(field.width ?? 6),
      binding: "flag",
      locked: false
    });
  }
  output.fields = fields;

  const incomingResources = Array.isArray(raw.resources) ? raw.resources : [];
  const hpDefault = DEFAULT_SHEET_CONFIG.resources[0];
  const mpDefault = DEFAULT_SHEET_CONFIG.resources[1];
  const incomingHp = incomingResources.find((resource) => resource?.id === "hp");
  const incomingMp = incomingResources.find((resource) => resource?.id === "mp");
  const usedResources = new Set(["hp", "mp"]);
  const occupiedSystemLinks = new Set([RESOURCE_LINKS.PRIMARY]);
  output.resources = [
    normalizeResource(incomingHp, hpDefault, { locked: true, forceLink: RESOURCE_LINKS.HP }),
    normalizeResource(incomingMp, mpDefault, { locked: true, forceLink: RESOURCE_LINKS.PRIMARY })
  ];
  for (const resource of incomingResources) {
    if (!resource || resource === incomingHp || resource === incomingMp || resource.id === "hp" || resource.id === "mp") continue;
    output.resources.push(normalizeCustomResource(resource, usedResources, occupiedSystemLinks));
  }

  const levelRaw = raw.level && typeof raw.level === "object" ? raw.level : {};
  output.level = {
    enabled: savedBoolean(levelRaw.enabled),
    label: String(levelRaw.label || "NÍVEL").trim() || "NÍVEL",
    startingLevel: asInt(levelRaw.startingLevel, 1, { min: 0 }),
    levelUpPermission: levelRaw.levelUpPermission === "owner" ? "owner" : "gm"
  };

  const attributesRaw = raw.attributes && typeof raw.attributes === "object" ? raw.attributes : {};
  const legacyStyles = Array.isArray(attributesRaw.entries)
    ? attributesRaw.entries.find((entry) => Array.isArray(entry?.rebirth?.styles) && entry.rebirth.styles.length)?.rebirth?.styles
    : null;
  const globalRebirthStyles = Array.isArray(raw.rebirthStyles) && raw.rebirthStyles.length
    ? raw.rebirthStyles
    : (isLegacyDefaultRebirthStyles(legacyStyles) ? null : legacyStyles);
  output.rebirthStyles = normalizeRebirthStyles(globalRebirthStyles);

  output.attributes = {
    allowCollapse: savedBoolean(attributesRaw.allowCollapse,true),
    points: normalizePoints(attributesRaw.points),
    entries: []
  };
  const usedAttributes = new Set();
  const migrateLegacyYellow = Number(raw.version ?? 0) < 4;
  for (const attribute of Array.isArray(attributesRaw.entries) ? attributesRaw.entries : []) {
    if (!attribute) continue;
    output.attributes.entries.push(normalizeAttribute(attribute, usedAttributes, { migrateLegacyYellow }));
  }

  output.otherStats = normalizeOtherStats(raw.otherStats, output.resources, output.attributes.entries);
  output.addons = normalizeAddons(raw.addons);
  output.inventory = normalizeInventoryConfig(raw.inventory);
  output.npc = {dropping:normalizeNpcDropping(raw.npc?.dropping)};
  output.items = normalizeItemSystemConfig(raw.items);
  output.proficiencies = normalizeProficiencies(raw.proficiencies, output.attributes.entries);

  return output;
}

export function clampWidth(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 6;
  return Math.min(12, Math.max(2, Math.round(n)));
}

// A normalized world config is expensive (rarities, inventory, attributes,
// proficiencies, IDs). Foundry's settings cache normally returns the same
// source object until it changes. Reuse the normalized result for that source
// without retaining stale settings across world changes.
let cachedConfigSource = null;
let cachedConfigValue = null;
export function invalidateSheetConfigCache() {
  cachedConfigSource = null;
  cachedConfigValue = null;
}

export function getSheetConfig() {
  try {
    const raw = game.settings.get(MODULE_ID, SETTINGS.SHEET_CONFIG);
    if (cachedConfigValue && raw === cachedConfigSource) return cachedConfigValue;
    const normalized = normalizeSheetConfig(raw);
    cachedConfigSource = raw;
    cachedConfigValue = normalized;
    return normalized;
  } catch (_error) {
    // No game/settings in standalone tests or while Foundry starts up.
    // Don't cache the fallback: a subsequent call may have real settings.
    return normalizeSheetConfig(DEFAULT_SHEET_CONFIG);
  }
}

export async function setSheetConfig(config) {
  const normalized = normalizeSheetConfig(config);
  invalidateSheetConfigCache();
  const result = await game.settings.set(MODULE_ID, SETTINGS.SHEET_CONFIG, normalized);
  emitProgressHook(HOOKS.CONFIG_UPDATED, normalized);
  return result;
}

export function createField(label = "NOVO CAMPO", width = 6) {
  return {
    id: `${slugify(label, "field")}-${foundry.utils.randomID(5).toLowerCase()}`,
    label,
    width: clampWidth(width),
    binding: "flag",
    locked: false
  };
}

export function createCustomResource(label = "NOVO RECURSO") {
  return normalizeCustomResource({
    id: `${slugify(label, "resource")}-${foundry.utils.randomID(5).toLowerCase()}`,
    label,
    color: "#8c65c6",
    startMax: 0,
    syncCurrentOnMax: true,
    link: RESOURCE_LINKS.BUXA,
    icon: { enabled: false, path: "" },
    levelUp: DEFAULT_RESOURCE_LEVEL_UP
  }, new Set(["hp", "mp"]));
}

export function createAttribute(label = "NOVO ATRIBUTO") {
  return normalizeAttribute({
    id: `${slugify(label, "attribute")}-${foundry.utils.randomID(5).toLowerCase()}`,
    label,
    ability: "str",
    icon: { enabled: false, path: "" },
    appearance: { color: "#151a24", decoration: "◆" },
    modifier: { enabled: false, everyPoints: 5 },
    rebirth: {
      enabled: false,
      maxPoints: 20,
      gainDieEveryRebirths: 1,
      lockModifier: false,
      baseModifierCap: 2,
      modifierCapPerRebirth: 1
    }
  }, new Set());
}

export function isTargetActorType(actorOrType, config = getSheetConfig()) {
  const type = typeof actorOrType === "string" ? actorOrType : actorOrType?.type;
  if (!type) return false;
  const availableActorTypes = Object.keys(CONFIG.Actor?.dataModels ?? {});
  // NPCs have their own Buxa sheet in V14. Keep their stats, resource rules and
  // state initialization active even in worlds whose old selection was only
  // "character"; do not change the user's other actor-type choices.
  if (type === "npc" && availableActorTypes.includes("npc")) return true;
  const selected = config.actorTypes.filter((entry) => availableActorTypes.includes(entry));
  if (selected.length) return selected.includes(type);
  if (availableActorTypes.includes("character")) return type === "character";
  if (availableActorTypes.length === 1) return type === availableActorTypes[0];
  return true;
}
