import { visibilityOf, normalizeReveal } from "./item-discovery.js";
import { numericField, booleanField } from "./numeric-field.js";

function finite(value, fallback = 0, min = -1000000, max = 1000000) {
  return numericField(value, fallback, min, max);
}

function integer(value, fallback = 0, min = 0, max = 1000) {
  return Math.round(finite(value, fallback, min, max));
}

function cleanColor(value, fallback = "#b8c3d2") {
  const text = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(text) ? text.toLowerCase() : fallback;
}

function makeId(value, used, fallback = "dice") {
  const base = String(value || fallback).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || fallback;
  let id = base;
  let suffix = 2;
  while (used.has(id)) id = `${base}-${suffix++}`;
  used.add(id);
  return id;
}

function normalizeTooltip(raw = {}) {
  const tooltip = raw && typeof raw === "object" ? raw : {};
  const style = ["item", "neutral", "rarity", "custom"].includes(tooltip.style) ? tooltip.style : "neutral";
  return {
    enabled: booleanField(tooltip.enabled,true),
    style,
    rarityId: String(tooltip.rarityId || "").trim().slice(0, 80),
    color: cleanColor(tooltip.color),
    label: String(tooltip.label || "").trim().slice(0, 100),
    icon: String(tooltip.icon || "").trim().slice(0, 500)
  };
}

export function normalizeItemDice(input) {
  const source = Array.isArray(input) ? input : [];
  const used = new Set();
  return source.slice(0, 40).map((entry, index) => {
    const raw = entry && typeof entry === "object" ? entry : {};
    const attributeDice = raw.attributeDice && typeof raw.attributeDice === "object" ? raw.attributeDice : {};
    const modifier = raw.modifier && typeof raw.modifier === "object" ? raw.modifier : {};
    const modifierSource = ["none", "attribute", "proficiency"].includes(modifier.source) ? modifier.source : "none";
    const rollMode = ["normal", "advantage", "disadvantage"].includes(raw.rollMode) ? raw.rollMode : "normal";
    return {
      id: makeId(raw.id || `dice-${index + 1}`, used),
      label: String(raw.label || `Roll ${index + 1}`).trim().slice(0, 80) || `Roll ${index + 1}`,
      count: integer(raw.count, 1, 0, 100),
      faces: integer(raw.faces, 20, 2, 1000),
      attributeDice: {
        enabled: booleanField(attributeDice.enabled),
        attributeId: String(attributeDice.attributeId || "").trim().slice(0, 100),
        faces: integer(attributeDice.faces, 20, 2, 1000)
      },
      modifier: {
        source: modifierSource,
        id: String(modifier.id || "").trim().slice(0, 100)
      },
      flat: finite(raw.flat, 0, -1000000, 1000000),
      rollMode,
      visibility: visibilityOf(raw),
      reveal: normalizeReveal(raw.reveal),
      showRange: booleanField(raw.showRange),
      chatRoll: booleanField(raw.chatRoll,true),
      tooltip: normalizeTooltip(raw.tooltip)
    };
  });
}

export function createItemDice(index = 0) {
  return {
    id: `dice-${globalThis.foundry?.utils?.randomID?.(12) ?? globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`,
    label: "Damage",
    count: 1,
    faces: 20,
    attributeDice: { enabled: false, attributeId: "", faces: 20 },
    modifier: { source: "none", id: "" },
    flat: 0,
    rollMode: "normal",
    visibility: "revealed",
    reveal: normalizeReveal(),
    showRange: false,
    chatRoll: true,
    tooltip: { enabled: true, style: "neutral", rarityId: "", color: "#b8c3d2", label: "", icon: "" }
  };
}

export function buildDiceAttributeOptions(config) {
  return (config?.attributes?.entries ?? []).map((entry) => ({ id: entry.id, label: entry.label }));
}

export function buildDiceModifierOptions(config) {
  const options = [{ value: "none:", label: "NO MODIFIER", group: "NONE" }];
  for (const attribute of config?.attributes?.entries ?? []) {
    options.push({ value: `attribute:${attribute.id}`, label: `${attribute.label} · Modifier`, group: "ATTRIBUTES" });
  }
  for (const proficiency of config?.proficiencies?.entries ?? []) {
    if (proficiency?.enabled === false) continue;
    options.push({ value: `proficiency:${proficiency.id}`, label: `${proficiency.label} · Modifier`, group: "PROFICIENCIES" });
  }
  return options;
}

export function modifierSelectionValue(modifier) {
  const source = ["attribute", "proficiency"].includes(modifier?.source) ? modifier.source : "none";
  return `${source}:${String(modifier?.id || "")}`;
}

export function parseModifierSelection(value) {
  const [source = "none", id = ""] = String(value || "none:").split(":");
  if (!["attribute", "proficiency"].includes(source)) return { source: "none", id: "" };
  return { source, id };
}

export function normalizeTooltipDecorations(input) {
  const source = Array.isArray(input) ? input : [];
  const used = new Set();
  return source.slice(0, 40).map((entry, index) => {
    const raw = entry && typeof entry === "object" ? entry : {};
    const type = ["divider", "symbols", "text", "spacer"].includes(raw.type) ? raw.type : "divider";
    const placement = ["beforeDice", "between", "beforeDescription"].includes(raw.placement) ? raw.placement : "between";
    const style = ["item", "neutral", "rarity", "custom"].includes(raw.style) ? raw.style : "item";
    return {
      id: makeId(raw.id || `decor-${index + 1}`, used, "decor"),
      type,
      placement,
      text: String(raw.text || (type === "symbols" ? "◆" : "")).slice(0, 120),
      count: integer(raw.count, 3, 1, 12),
      style,
      rarityId: String(raw.rarityId || "").trim().slice(0, 80),
      color: cleanColor(raw.color)
    };
  });
}

export function createTooltipDecoration(index = 0) {
  return {
    id: `decor-${globalThis.foundry?.utils?.randomID?.(12) ?? globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`,
    type: "divider",
    placement: "between",
    text: "◆",
    count: 3,
    style: "item",
    rarityId: "",
    color: "#b8c3d2"
  };
}
