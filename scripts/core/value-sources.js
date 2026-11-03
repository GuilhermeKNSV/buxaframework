import { getResourceState } from "./dnd5e.js";
import { getAttributeBaseProgressState } from "./attribute-progress.js";
import {
  getAttributeBaseValue,
  getAttributeDice,
  getAttributeModifier,
  getAttributeRebirthState,
  getAttributeValue
} from "./attributes.js";
import {
  getProficiencyBaseModifier,
  getProficiencyBaseValue,
  getLinkedProficiencyAttribute,
  getLinkedProficiencyModifier
} from "./proficiencies.js";
import { getActiveItemIncreaseEntries } from "./item-effects.js";
import { getItemVisual } from "./item-runtime.js";
import { cleanFloatingNumber } from "./number-display.js";

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? cleanFloatingNumber(number) : fallback;
}

function signed(value, { suffix = "" } = {}) {
  const number = finite(value, 0);
  const prefix = number > 0 ? "+" : "";
  return `${prefix}${number}${suffix}`;
}

function genericSource({ icon, label, detail = "", valueText = "", tone = "neutral" }) {
  return { icon, label, detail, valueText, tone, image: "", style: "", itemId: "" };
}

function itemSources(actor, target, config, unit) {
  const sources = [];
  for (const { item, increase } of getActiveItemIncreaseEntries(actor, config)) {
    if (increase.target !== target) continue;
    const visual = getItemVisual(item, config);
    const suffix = increase.mode === "percent" ? "%" : "";
    const customLabel = String(increase.tooltip?.label || "").trim();
    const detail = customLabel || (increase.activation === "passive" ? "PASSIVE" : "");
    sources.push({
      image: item.img || "icons/svg/item-bag.svg",
      itemId: item.id,
      icon: "",
      label: item.name || "Item",
      detail,
      valueText: `${signed(increase.value, { suffix })} ${unit}`.trim(),
      tone: Number(increase.value) < 0 ? "loss" : "gain",
      style: `--buxa-source-color:${visual.rarity?.color || "#7b8aa0"}`
    });
  }
  return sources;
}

export function buildAttributeSources(actor, attribute, config) {
  const rebirthState = getAttributeRebirthState(actor, attribute, config);
  const value = getAttributeValue(actor, attribute, config);
  const modifier = getAttributeModifier(attribute, value, rebirthState.activeRebirths, actor, config);
  const entries = [];

  if (attribute.rebirth?.enabled) {
    const base = getAttributeBaseProgressState(actor, attribute);
    entries.push(genericSource({
      icon: "fa-solid fa-chart-line",
      label: "Invested points",
      valueText: String(finite(base.progress))
    }));
    if (rebirthState.activeRebirths > 0) {
      entries.push(genericSource({
        icon: "fa-solid fa-arrows-rotate",
        label: "Rebirths",
        valueText: `R${rebirthState.activeRebirths}`,
        tone: "special"
      }));
    }
  } else {
    entries.push(genericSource({
      icon: "fa-solid fa-chart-simple",
      label: "Invested points",
      valueText: String(finite(getAttributeBaseValue(actor, attribute)))
    }));
  }

  entries.push(...itemSources(actor, `attribute:${attribute.id}:value`, config, "VALUE"));

  if (modifier !== null && attribute.modifier?.enabled) {
    const derived = getAttributeModifier(attribute, value, rebirthState.activeRebirths, null, config);
    entries.push(genericSource({
      icon: "fa-solid fa-calculator",
      label: "Attribute modifier",
      valueText: `${signed(derived)} MOD`,
      tone: derived < 0 ? "loss" : "neutral"
    }));
  }
  entries.push(...itemSources(actor, `attribute:${attribute.id}:modifier`, config, "MOD"));

  const baseDice = getAttributeDice(attribute, rebirthState.activeRebirths, null, config);
  entries.push(genericSource({
    icon: "fa-solid fa-dice-d20",
    label: "Dice",
    valueText: `${finite(baseDice)} DICE`
  }));
  entries.push(...itemSources(actor, `attribute:${attribute.id}:dice`, config, "DICE"));

  return { id: `attribute-${attribute.id}`, title: "SOURCES", entries };
}

export function buildResourceSources(actor, resource, config) {
  const stored = getResourceState(actor, resource);
  return {
    id: `resource-${resource.id}`,
    title: "SOURCES",
    entries: [
      genericSource({
        icon: "fa-solid fa-database",
        label: "Base max",
        valueText: String(finite(stored.max))
      }),
      ...itemSources(actor, `resource:${resource.id}:max`, config, "MAX")
    ]
  };
}

export function buildProficiencySources(actor, proficiency, config) {
  const entries = [
    genericSource({
      icon: "fa-solid fa-chart-simple",
      label: "Invested points",
      valueText: String(finite(getProficiencyBaseValue(actor, proficiency)))
    }),
    ...itemSources(actor, `proficiency:${proficiency.id}:value`, config, "VALUE")
  ];

  if (config.proficiencies.mode === "attribute" && proficiency.features?.modifier !== false) {
    const baseModifier = getProficiencyBaseModifier(actor, proficiency, config);
    entries.push(genericSource({
      icon: "fa-solid fa-calculator",
      label: "Proficiency modifier",
      valueText: `${signed(baseModifier)} MOD`
    }));
  }

  const linked = getLinkedProficiencyAttribute(proficiency, config);
  const linkedModifier = getLinkedProficiencyModifier(actor, proficiency, config);
  if (linked) {
    entries.push(genericSource({
      icon: "fa-solid fa-link",
      label: linked.label,
      valueText: `${signed(linkedModifier)} MOD`,
      tone: linkedModifier < 0 ? "loss" : "special"
    }));
  }

  entries.push(...itemSources(actor, `proficiency:${proficiency.id}:modifier`, config, "MOD"));
  return { id: `proficiency-${proficiency.id}`, title: "SOURCES", entries };
}
