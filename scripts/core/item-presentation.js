import { rarityVisualPresentation } from './rarity-visuals.js';
import { getItemRules, normalizeItemSystemConfig, readableAccent } from "./item-config.js";
import { itemDisplayLabel } from "./item-type-label.js";
import { itemIncreaseTargetLabel } from "./item-increase-config.js";
import { resolveItemDice } from "./item-dice.js";
import { getItemVisual, itemTotalWeight } from "./item-runtime.js";
import { getItemQuantity } from "./dnd5e.js";
import { visibilityOf, isRevealed, mergeTargetFor, descriptionView } from "./item-discovery.js";
import { rarityTier } from "./rarity-tier.js";

function formatNumber(value) {
  const number = Math.round((Number(value) || 0) * 100) / 100;
  return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function signed(value, suffix = "") {
  const number = Math.round((Number(value) || 0) * 100) / 100;
  return `${number > 0 ? "+" : ""}${formatNumber(number)}${suffix}`;
}

export function formatItemCardLabel(value) {
  const label = String(value ?? "").trim();
  // Custom labels are authored by the GM. Never rewrite acronyms, names,
  // formulas or intentionally uppercase labels for presentation.
  return label;
}

export function presentationColor(presentation, itemRarity, config) {
  const style = presentation?.style || "item";
  if (style === "neutral") return "#c8d0dc";
  if (style === "custom") return String(presentation?.color || "#b8c3d2");
  if (style === "rarity") {
    const rarity = normalizeItemSystemConfig(config?.items).rarities.find((entry) => entry.id === presentation?.rarityId);
    return readableAccent(rarity?.color || itemRarity?.color);
  }
  return readableAccent(itemRarity?.color);
}

export function presentationTheme(presentation, itemRarity, config, visibility = 'revealed') {
  const style = presentation?.style || 'item';
  if (visibility !== 'revealed' || style === 'neutral' || style === 'custom') return { themeClass: '', themeStyle: '' };
  const rarity = style === 'rarity'
    ? normalizeItemSystemConfig(config?.items).rarities.find(r => r.id === presentation?.rarityId) ?? itemRarity
    : itemRarity;
  const theme = rarityVisualPresentation(rarity);
  return { themeClass: theme.className, themeStyle: theme.style };
}

function increaseLines(item, rules, visual, config) {
  const entries = rules.increases || [];
  const merged = new Map();
  const mergeStyle = new Map();
  for (const entry of entries) {
    const target = mergeTargetFor(entry, entries);
    if (!target) continue;
    merged.set(target.id, (merged.get(target.id) || 0) + entry.value);
    if ((entry.reveal?.style && entry.reveal.style !== "keep") || entry.reveal?.label || entry.reveal?.icon)
      mergeStyle.set(target.id, entry);
  }
  const absorbed = new Set(entries.filter((entry) => mergeTargetFor(entry, entries)).map((entry) => entry.id));
  return entries.filter((entry) => entry.tooltip.enabled && visibilityOf(entry) !== "dmOnly" && !absorbed.has(entry.id)).map((entry) => {
    const state = visibilityOf(entry);
    const targetLabel = formatItemCardLabel(itemIncreaseTargetLabel(entry.target, config));
    const override = mergeStyle.get(entry.id) || entry;
    const reveal = override.reveal;
    const presentation = reveal?.style && reveal.style !== "keep" ? {
      ...entry.tooltip, style: reveal.style,
      color: reveal.color, rarityId: reveal.tooltipRarityId || override.tooltip.rarityId
    } : entry.tooltip;
    const label = formatItemCardLabel(reveal?.label || entry.tooltip.label || targetLabel);
    const color = state === "revealed" ? presentationColor(presentation, visual.rarity, config) : "#788390";
    return {
      id: entry.id, label: state === "hidden" ? "" : label,
      valueText: state === "hidden" ? "???" : signed(entry.value + (merged.get(entry.id) || 0), entry.mode === "percent" ? "%" : ""),
      visibility: state, locked: state === "locked", hidden: state === "hidden",
      activation: entry.activation, passive: state === "revealed" && entry.activation === "passive",
      icon: state === "revealed" ? (override.reveal?.icon || entry.tooltip.icon || "") : "",
      color, ...presentationTheme(presentation, visual.rarity, config, state),
      style: `--buxa-tooltip-color:${color};${presentationTheme(presentation, visual.rarity, config, state).themeStyle}`
    };
  });
}

function diceLines(item, rules, visual, config, actor) {
  return (rules.dice ?? []).filter((dice) => dice.tooltip.enabled && visibilityOf(dice) !== "dmOnly").map((dice) => {
    const state = visibilityOf(dice);
    // Do not evaluate a hidden formula for player-facing presentation.
    const resolved = state === "hidden" ? null : resolveItemDice(item, dice, { actor, config });
    const rawLabel = state === "revealed" ? (dice.reveal?.label || dice.tooltip.label || dice.label) : (dice.tooltip.label || dice.label);
    const label = state === "hidden" ? "" : formatItemCardLabel(rawLabel);
    const presented = dice.reveal?.style && dice.reveal.style !== "keep" ? {
      ...dice.tooltip, style: dice.reveal.style, color: dice.reveal.color,
      rarityId: dice.reveal.tooltipRarityId || dice.tooltip.rarityId
    } : dice.tooltip;
    const color = state === "revealed" ? presentationColor(presented, visual.rarity, config) : "#788390";
    const isRange = state !== "hidden" && dice.showRange && resolved.displayText === resolved.rangeText;
    const displayText = state === "hidden" ? "???" : isRange ? `[${resolved.rangeText}]`
      : resolved.displayText;
    return {
      id: dice.id, label,
      displayText,
      formula: state === "hidden" ? "" : resolved.displayFormula,
      visibility: state, locked: state === "locked", hidden: state === "hidden",
      rollMode: dice.rollMode,
      chatRoll: state === "revealed" && dice.chatRoll,
      icon: state === "revealed" ? (dice.reveal?.icon || dice.tooltip.icon || "") : "",
      color, ...presentationTheme(presented, visual.rarity, config, state),
      style: `--buxa-tooltip-color:${color};${presentationTheme(presented, visual.rarity, config, state).themeStyle}`
    };
  });
}

function decorationView(entry, visual, config) {
  const color = presentationColor(entry, visual.rarity, config);
  const symbols = entry.type === "symbols" ? String(entry.text || "◆").repeat(Math.max(1, Number(entry.count) || 1)) : "";
  return { ...entry, color, symbols, style: `--buxa-tooltip-color:${color}` };
}

/** Explicitly neutralize lines for consumers that request a monochrome view. */
export function neutralItemSheetLines(lines = []) {
  return lines.map((line) => ({
    ...line,
    color: "#c8d0dc",
    themeClass: "", themeStyle: "",
    style: "--buxa-tooltip-color:#c8d0dc"
  }));
}

export function buildItemPresentation(item, { actor = item?.parent, config } = {}) {
  const rules = getItemRules(item, config);
  const visual = getItemVisual(item, config);
  const quantity = Math.max(1, getItemQuantity(item));
  const typeLabel = itemDisplayLabel(rules);
  const decorations = (rules.decorations ?? []).map((entry) => decorationView(entry, visual, config));
  const groups = {
    beforeDice: decorations.filter((entry) => entry.placement === "beforeDice"),
    between: decorations.filter((entry) => entry.placement === "between"),
    beforeDescription: decorations.filter((entry) => entry.placement === "beforeDescription")
  };
  return {
    item,
    rules,
    visual,
    rarity: visual.rarity ? { ...visual.rarity, label: formatItemCardLabel(visual.rarity.label) } : visual.rarity,
    rarityClass: visual.className,
    rarityStyle: visual.style,
    rarityTier: rarityTier(visual.rarity),
    quantity,
    showQuantity: quantity > 1,
    typeLabel: formatItemCardLabel(typeLabel),
    showTypeLabel: Boolean(typeLabel),
    descriptionParts: descriptionView(rules.description),
    diceLines: diceLines(item, rules, visual, config, actor),
    increaseLines: increaseLines(item, rules, visual, config),
    decorations: groups,
    totalWeightText: formatNumber(itemTotalWeight(item, config))
  };
}
