/** Pure presentation view models for the Buxa Item configuration editor. */
import { buildItemIncreaseTargetOptions } from "../core/item-increase-config.js";
import { buildDiceAttributeOptions, buildDiceModifierOptions, modifierSelectionValue } from "../core/item-dice-config.js";
import { itemRarityOptions } from "../core/item-config.js";
import { visibilityOf } from "../core/item-discovery.js";

export function selectedOptions(options, selected, missingGroup = "UNAVAILABLE") {
  const copy = options.map((entry) => ({ ...entry, selected: entry.value === selected }));
  if (selected && !copy.some((entry) => entry.selected)) {
    copy.push({ value: selected, label: `Missing source (${selected})`, group: missingGroup, selected: true });
  }
  return copy;
}

export function selectedAttributes(options, selected) {
  const copy = options.map((entry) => ({ ...entry, selected: entry.id === selected }));
  if (selected && !copy.some((entry) => entry.selected)) {
    copy.push({ id: selected, label: `Missing attribute (${selected})`, selected: true });
  }
  return copy;
}

export function increaseViews(rules, config) {
  const targets = buildItemIncreaseTargetOptions(config);
  const rarities = itemRarityOptions(config, "");
  return (rules.increases ?? []).map((increase) => ({
    ...increase,
    isRevealed: visibilityOf(increase) === "revealed",
    isLocked: visibilityOf(increase) === "locked",
    isHidden: visibilityOf(increase) === "hidden",
    isDmOnly: visibilityOf(increase) === "dmOnly",
    revealStyleKeep: increase.reveal.style === "keep",
    revealStyleNeutral: increase.reveal.style === "neutral",
    revealStyleItem: increase.reveal.style === "item",
    revealStyleRarity: increase.reveal.style === "rarity",
    revealStyleCustom: increase.reveal.style === "custom",
    revealRarities: rarities.map((r) => ({ ...r, selected: increase.reveal.rarityId === r.id })),
    revealColorRarities: rarities.map((r) => ({ ...r, selected: increase.reveal.tooltipRarityId === r.id })),
    tooltipItem: increase.tooltip.style === "item",
    tooltipNeutral: increase.tooltip.style === "neutral",
    tooltipRarity: increase.tooltip.style === "rarity",
    tooltipCustom: increase.tooltip.style === "custom",
    modeFlat: increase.mode !== "percent",
    modePercent: increase.mode === "percent",
    activationEquipped: increase.activation !== "passive",
    activationPassive: increase.activation === "passive",
    targetOptions: selectedOptions(targets, increase.target),
    tooltipRarities: rarities.map((rarity) => ({ ...rarity, selected: rarity.id === increase.tooltip.rarityId }))
  }));
}


export function diceViews(rules, config) {
  const attributes = buildDiceAttributeOptions(config);
  const modifiers = buildDiceModifierOptions(config);
  const rarities = itemRarityOptions(config, "");
  return (rules.dice ?? []).map((dice) => {
    const modifierValue = modifierSelectionValue(dice.modifier);
    return {
      ...dice,
      isRevealed: visibilityOf(dice) === "revealed",
      isLocked: visibilityOf(dice) === "locked",
      isHidden: visibilityOf(dice) === "hidden",
      isDmOnly: visibilityOf(dice) === "dmOnly",
      revealStyleKeep: dice.reveal.style === "keep",
      revealStyleNeutral: dice.reveal.style === "neutral",
      revealStyleItem: dice.reveal.style === "item",
      revealStyleRarity: dice.reveal.style === "rarity",
      revealStyleCustom: dice.reveal.style === "custom",
      revealRarities: rarities.map((r) => ({ ...r, selected: dice.reveal.rarityId === r.id })),
      revealColorRarities: rarities.map((r) => ({ ...r, selected: dice.reveal.tooltipRarityId === r.id })),
      attributeOptions: selectedAttributes(attributes, dice.attributeDice.attributeId),
      modifierOptions: selectedOptions(modifiers, modifierValue),
      modeNormal: dice.rollMode === "normal",
      modeAdvantage: dice.rollMode === "advantage",
      modeDisadvantage: dice.rollMode === "disadvantage",
      tooltipItem: dice.tooltip.style === "item",
      tooltipNeutral: dice.tooltip.style === "neutral",
      tooltipRarity: dice.tooltip.style === "rarity",
      tooltipCustom: dice.tooltip.style === "custom",
      tooltipRarities: rarities.map((rarity) => ({ ...rarity, selected: rarity.id === dice.tooltip.rarityId }))
    };
  });
}

export function decorationViews(rules, config) {
  const rarities = itemRarityOptions(config, "");
  return (rules.decorations ?? []).map((entry) => ({
    ...entry,
    isDivider: entry.type === "divider",
    isSymbols: entry.type === "symbols",
    isText: entry.type === "text",
    isSpacer: entry.type === "spacer",
    beforeDice: entry.placement === "beforeDice",
    between: entry.placement === "between",
    beforeDescription: entry.placement === "beforeDescription",
    styleItem: entry.style === "item",
    styleNeutral: entry.style === "neutral",
    styleRarity: entry.style === "rarity",
    styleCustom: entry.style === "custom",
    rarityOptions: rarities.map((rarity) => ({ ...rarity, selected: rarity.id === entry.rarityId }))
  }));
}

