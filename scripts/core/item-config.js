import { rarityVisualPresentation } from './rarity-visuals.js';
import { normalizeItemResourceEffects, normalizeItemLimits } from "./item-use-config.js";
import { normalizeItemBoardImage } from "./item-board-image.js";
import { normalizeItemEquipArtwork } from "./item-equip-artwork.js";
import { normalizeStackImages } from "./item-stack-artwork.js";
import { MODULE_ID } from "./constants.js";
import { booleanField, numericField } from "./numeric-field.js";
import { normalizeItemStorage } from "./item-storage.js";
import { normalizeItemShape } from "./inventory-shapes.js";
import { normalizeItemIncreases } from "./item-increase-config.js";
import { normalizeItemDice, normalizeTooltipDecorations } from "./item-dice-config.js";
import { normalizeDescriptionParts } from "./item-discovery.js";

export const DEFAULT_ITEM_RARITIES = Object.freeze([
  { id: "junk", label: "JUNK", color: "#59616d", nameColor: false, animated: false, ornament: false, spectrum: false, glint: false, backgroundMode: "glint" },
  { id: "common", label: "COMMON", color: "#9098a6", nameColor: true, animated: false, ornament: false, spectrum: false, glint: false, backgroundMode: "glint" },
  { id: "uncommon", label: "UNCOMMON", color: "#55c86a", nameColor: true, animated: false, ornament: false, spectrum: false, glint: false, backgroundMode: "glint" },
  { id: "rare", label: "RARE", color: "#4d98f0", nameColor: true, animated: false, ornament: false, spectrum: false, glint: false, backgroundMode: "glint" },
  { id: "epic", label: "EPIC", color: "#9a68e8", nameColor: true, animated: false, ornament: false, spectrum: false, glint: false, backgroundMode: "glint" },
  { id: "legendary", label: "LEGENDARY", color: "#f2ca43", nameColor: true, animated: false, ornament: false, spectrum: false, glint: true, backgroundMode: "glint" },
  { id: "mythical", label: "MYTHICAL", color: "#ffca43", nameColor: true, animated: true, ornament: true, spectrum: true, glint: true, backgroundMode: "glint" },
  { id: "relic", label: "RELIC", color: "#f060b8", nameColor: true, animated: true, ornament: true, spectrum: false, glint: true, backgroundMode: "glint" },
  { id: "masterwork", label: "MASTERWORK", color: "#df4e56", nameColor: true, animated: true, ornament: true, spectrum: false, glint: true, backgroundMode: "glint" },
  { id: "secret", label: "SECRET", color: "#08090c", nameColor: true, animated: true, ornament: true, spectrum: false, glint: true, backgroundMode: "glint" },
  { id: "divine", label: "DIVINE", color: "#78ddff", nameColor: true, animated: true, ornament: true, spectrum: false, glint: true, backgroundMode: "glint" },
  { id: "special", label: "SPECIAL", color: "#ff202c", nameColor: true, animated: true, ornament: true, spectrum: false, glint: true, backgroundMode: "glint" }
]);

function slugify(value, fallback = "rarity") {
  const clean = String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  // Saved rarity IDs must be stable. A random fallback silently breaks Item
  // rarity references whenever a unicode-only label is normalized again.
  return clean || String(fallback).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'rarity';
}

function color(value, fallback = "#9098a6") {
  const clean = String(value ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(clean) ? clean.toLowerCase() : fallback;
}

function uniqueId(candidate, used, fallback = "rarity") {
  const base = slugify(candidate, fallback);
  let id = base;
  let suffix = 2;
  while (used.has(id)) id = `${base}-${suffix++}`;
  used.add(id);
  return id;
}

export function normalizeItemSystemConfig(input) {
  const raw = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const backgroundRaw = raw.background && typeof raw.background === "object" ? raw.background : {};
  const incoming = Array.isArray(raw.rarities) && raw.rarities.length ? raw.rarities : DEFAULT_ITEM_RARITIES;
  const used = new Set();
  const rarities = incoming.slice(0, 50).map((entry, index) => {
    const source = entry && typeof entry === "object" ? entry : {};
    const fallback = DEFAULT_ITEM_RARITIES.find((rarity) => rarity.id === source.id)
      ?? DEFAULT_ITEM_RARITIES[index]
      ?? DEFAULT_ITEM_RARITIES.at(-1);
    const id = uniqueId(source.id || source.label || fallback?.id, used, fallback?.id || "rarity");
    return {
      id,
      label: String(source.label || fallback?.label || id).trim().slice(0, 32) || id.toUpperCase(),
      color: color(source.color, fallback?.color),
      nameColor: booleanField(source.nameColor, booleanField(fallback?.nameColor)),
      animated: booleanField(source.animated, booleanField(fallback?.animated)),
      ornament: booleanField(source.ornament, booleanField(fallback?.ornament)),
      spectrum: booleanField(source.spectrum, booleanField(fallback?.spectrum)),
      glint: booleanField(source.glint, booleanField(fallback?.glint)),
      beamOpacity: number(source.beamOpacity, 100, 0, 100),
      backgroundMode: source.backgroundMode === "full" ? "full" : (source.backgroundMode === "glint" ? "glint" : (fallback?.backgroundMode || "glint"))
    };
  });
  const opacity = number(backgroundRaw.opacity, 100, 0, 100);
  const brightness = number(backgroundRaw.brightness, 100, 25, 250);
  return {
    background: { opacity, brightness },
    rarities: rarities.length ? rarities : DEFAULT_ITEM_RARITIES.map((entry) => ({ ...entry }))
  };
}

export function createItemRarity(existing = [], label = "NEW RARITY") {
  const used = new Set((existing ?? []).map((entry) => String(entry?.id || "")).filter(Boolean));
  const id = uniqueId(label, used, "rarity");
  return { id, label, color: "#9aa4b2", nameColor: true, animated: false, ornament: false, spectrum: false, glint: false, beamOpacity: 100, backgroundMode: "glint" };
}

function bool(value, fallback = false) {
  return booleanField(value, fallback);
}

function number(value, fallback = 0, min = 0, max = Number.POSITIVE_INFINITY) {
  return numericField(value, fallback, min, max);
}

export function normalizeItemRules(input, itemSystemConfig = normalizeItemSystemConfig()) {
  const raw = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const description = raw.description && typeof raw.description === "object" ? raw.description : {};
  const level = raw.levelRequirement && typeof raw.levelRequirement === "object" ? raw.levelRequirement : {};
  const equip = raw.equip && typeof raw.equip === "object" ? raw.equip : {};
  const weight = raw.weight && typeof raw.weight === "object" ? raw.weight : {};
  const multiple = raw.multiple && typeof raw.multiple === "object" ? raw.multiple : {};
  const typeLabel = raw.typeLabel && typeof raw.typeLabel === "object" ? raw.typeLabel : {};
  const rarityIds = new Set(itemSystemConfig.rarities.map((entry) => entry.id));
  const rarityId = rarityIds.has(raw.rarityId) ? raw.rarityId : (rarityIds.has("common") ? "common" : itemSystemConfig.rarities[0]?.id || "common");
  const allowedTypes = Array.isArray(equip.allowedTypes)
    ? [...new Set(equip.allowedTypes.map(String).filter(Boolean))].slice(0, 100)
    : [];
  return {
    version: 6,
    disableLooting: booleanField(raw.disableLooting),
    boardImage: normalizeItemBoardImage(raw.boardImage),
    equipArtwork: normalizeItemEquipArtwork(raw.equipArtwork),
    description: {
      enabled: bool(description.enabled),
      mode: description.mode === "standard" ? "standard" : description.mode === "modular" ? "modular" : (Array.isArray(description.parts) && description.parts.length ? "modular" : "standard"),
      text: String(description.text || "").slice(0, 10000),
      parts: normalizeDescriptionParts(description.parts, description.text)
    },
    levelRequirement: {
      enabled: bool(level.enabled),
      level: Math.round(number(level.level, 1, 0, 9999))
    },
    equip: {
      enabled: bool(equip.enabled, false),
      any: booleanField(equip.any, true),
      allowedTypes
    },
    weight: {
      enabled: bool(weight.enabled),
      value: number(weight.value, 0, 0, 1000000)
    },
    multiple: {
      enabled: bool(multiple.enabled),
      stackKey: String(multiple.stackKey || "").trim().slice(0, 120),
      maxStack: Math.round(number(multiple.maxStack, 99, 1, 999999)),
      stackImages: normalizeStackImages(multiple.stackImages)
    },
    typeLabel: {
      enabled: bool(typeLabel.enabled, true),
      label: String(typeLabel.label || "").trim().slice(0, 48)
    },
    increases: normalizeItemIncreases(raw.increases),
    dice: normalizeItemDice(raw.dice),
    resourceEffects: normalizeItemResourceEffects(raw.resourceEffects),
    limits: normalizeItemLimits(raw.limits),
    decorations: normalizeTooltipDecorations(raw.decorations),
    shape: normalizeItemShape(raw.shape),
    storage: normalizeItemStorage(raw.storage),
    rarityId
  };
}

export function getItemRules(item, config) {
  const system = normalizeItemSystemConfig(config?.items);
  return normalizeItemRules(item?.getFlag?.(MODULE_ID, "item"), system);
}

export function getItemRarity(item, config) {
  const system = normalizeItemSystemConfig(config?.items);
  const rules = normalizeItemRules(item?.getFlag?.(MODULE_ID, "item"), system);
  return system.rarities.find((entry) => entry.id === rules.rarityId) ?? system.rarities[0];
}


export function readableAccent(hex) {
  const clean = String(hex || "#9098a6").replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return "#d6dbe4";
  const rgb = [0, 2, 4].map((offset) => Number.parseInt(clean.slice(offset, offset + 2), 16));
  const luminance = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
  if (luminance >= 0.34) return `#${clean.toLowerCase()}`;
  const mix = 0.72;
  const lifted = rgb.map((channel) => Math.round(channel + (238 - channel) * mix));
  return `#${lifted.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

export function rarityPresentation(rarity, itemSystemConfig = null) {
  const safe = rarity ?? DEFAULT_ITEM_RARITIES[1];
  const visual = normalizeItemSystemConfig(itemSystemConfig);
  const backgroundOpacity = Math.max(0, Math.min(100, Number(visual.background?.opacity) || 0)) / 100;
  const backgroundBrightness = Math.max(25, Math.min(250, Number(visual.background?.brightness) || 100)) / 100;
  return {
    className: [
      rarityVisualPresentation(safe).className,
      `buxa-rarity-${String(safe.id || "common").replace(/[^a-z0-9_-]/gi, "-")}`,
      safe.nameColor ? "has-rarity-name-color" : "",
      safe.animated ? "is-rarity-animated" : "",
      safe.ornament ? "has-rarity-ornament" : "",
      safe.spectrum ? "is-rarity-spectrum" : "",
      safe.glint ? "has-rarity-glint" : "",
      safe.backgroundMode === "full" ? "buxa-rarity-bg-full" : "buxa-rarity-bg-glint"
    ].filter(Boolean).join(" "),
    style: `--buxa-rarity-color:${safe.color};--buxa-rarity-accent:${readableAccent(safe.color)};--buxa-rarity-name:${safe.nameColor ? readableAccent(safe.color) : "#e6e2da"};--buxa-rarity-bg-opacity:${backgroundOpacity};--buxa-rarity-bg-brightness:${backgroundBrightness};${rarityVisualPresentation(safe).style}`
  };
}

export function itemRarityOptions(config, selectedId) {
  return normalizeItemSystemConfig(config?.items).rarities.map((entry) => ({ ...entry, selected: entry.id === selectedId }));
}
