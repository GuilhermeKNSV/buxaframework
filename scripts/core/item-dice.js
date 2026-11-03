import { MODULE_ID } from "./constants.js";
import { getSheetConfig } from "./config.js";
import { getItemRules } from "./item-config.js";
import { getAttributeDice, getAttributeModifier, getAttributeRebirths, getAttributeValue } from "./attributes.js";
import { getProficiencyModifier } from "./proficiencies.js";
import { cleanFloatingNumber } from "./number-display.js";
import { notifyError, notifyWarning } from "./notifications.js";
import { executeItemUse, itemUseState } from "./item-use-runtime.js";
import { isRevealed } from "./item-discovery.js";
import { formatItemDiceFormula } from "./item-formula-display.js";

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? cleanFloatingNumber(number) : fallback;
}

function actorFor(item, actor = item?.parent) {
  if (actor?.documentName === "Actor" || actor?.constructor?.name === "Actor") return actor;
  return null;
}

function attributeById(config, id) {
  return config?.attributes?.entries?.find?.((entry) => entry.id === id) ?? null;
}

function proficiencyById(config, id) {
  return config?.proficiencies?.entries?.find?.((entry) => entry.id === id) ?? null;
}

function resolveAttributeDice(actor, attribute, config) {
  if (!actor || !attribute) return null;
  const rebirths = getAttributeRebirths(actor, attribute.id, config);
  return Math.max(0, Number(getAttributeDice(attribute, rebirths, actor, config)) || 0);
}

function resolveModifier(actor, modifier, config) {
  if (!modifier || modifier.source === "none") return { value: 0, label: "" };
  if (modifier.source === "attribute") {
    const attribute = attributeById(config, modifier.id);
    if (!attribute) return { value: 0, label: "" };
    if (!actor) return { value: 0, label: `${attribute.label} MOD`, unresolved: true };
    const value = getAttributeValue(actor, attribute, config);
    const rebirths = getAttributeRebirths(actor, attribute.id, config);
    return {
      value: Number(getAttributeModifier(attribute, value, rebirths, actor, config) ?? 0) || 0,
      label: `${attribute.label} mod`
    };
  }
  if (modifier.source === "proficiency") {
    const proficiency = proficiencyById(config, modifier.id);
    if (!proficiency) return { value: 0, label: "" };
    if (!actor) return { value: 0, label: `${proficiency.label} MOD`, unresolved: true };
    return { value: Number(getProficiencyModifier(actor, proficiency, config) ?? 0) || 0, label: `${proficiency.label} mod` };
  }
  return { value: 0, label: "" };
}

const MAX_RESOLVED_DICE = 100;
function diceTerm(count, faces, rollMode) {
  const amount = Math.max(0, Math.min(MAX_RESOLVED_DICE, Math.round(Number(count) || 0)));
  const sides = Math.max(2, Math.round(Number(faces) || 20));
  if (!amount) return "";
  if (rollMode === "advantage") return `${amount * 2}d${sides}kh${amount}`;
  if (rollMode === "disadvantage") return `${amount * 2}d${sides}kl${amount}`;
  return `${amount}d${sides}`;
}

export function getItemDiceEntry(item, diceId, config = getSheetConfig()) {
  return getItemRules(item, config).dice.find((entry) => entry.id === diceId) ?? null;
}

export function resolveItemDice(item, dice, { actor = item?.parent, config = getSheetConfig() } = {}) {
  const owner = actorFor(item, actor);
  // Fixed dice and attribute-derived dice are alternative roll sources.
  // Preserve the stored fixed-dice values so switching sources is reversible.
  const useAttributeDice = dice?.attributeDice?.enabled === true;
  const attribute = useAttributeDice ? attributeById(config, dice.attributeDice.attributeId) : null;
  const attributeCount = attribute ? resolveAttributeDice(owner, attribute, config) : 0;
  const modifier = resolveModifier(owner, dice?.modifier, config);
  const baseCount = useAttributeDice ? 0 : Math.max(0, Math.round(Number(dice?.count) || 0));
  const baseFaces = Math.max(2, Math.round(Number(dice?.faces) || 20));
  const attributeFaces = Math.max(2, Math.round(Number(dice?.attributeDice?.faces) || 20));
  const flat = finite(dice?.flat, 0);
  const rollMode = ["advantage", "disadvantage"].includes(dice?.rollMode) ? dice.rollMode : "normal";
  const activeCount = Math.max(0, Math.min(MAX_RESOLVED_DICE, useAttributeDice ? attributeCount : baseCount));
  const activeFaces = useAttributeDice ? attributeFaces : baseFaces;
  const activeTerm = diceTerm(activeCount, activeFaces, rollMode);
  const bonus = finite(modifier.value, 0) + flat;
  const formulaParts = activeTerm ? [activeTerm] : [];
  if (bonus || !formulaParts.length) formulaParts.push(String(bonus));
  const formula = formulaParts.join(" + ").replace(/\+ -/g, "- ") || "0";

  // Display the resolved dice and numeric modifier, including + 0. A World
  // Item without an owner can only preview the base dice and label its dynamic
  // modifier; it must not claim to know a particular Actor's modifier.
  const previewCount = useAttributeDice && !owner && attribute
    ? Math.max(0, Math.min(MAX_RESOLVED_DICE, getAttributeDice(attribute, 0, null, config))) : activeCount;
  const displayFormula = formatItemDiceFormula({
    count: previewCount, faces: activeFaces, bonus,
    missingSource: useAttributeDice && !attribute,
    unresolvedModifier: !owner && modifier.label ? modifier.label : ''
  });

  // Buxa's displayed 0..faces range is an intentional game convention;
  // actual Foundry rolls still use 1..faces.
  const maximumDice = activeCount * activeFaces;
  const minimum = cleanFloatingNumber(bonus);
  const maximum = cleanFloatingNumber(maximumDice + bonus);
  const rangeText = `${minimum} - ${maximum}`;
  const canResolveRange = (!useAttributeDice || Boolean(owner && attribute)) && !modifier.unresolved;
  return {
    id: dice?.id,
    label: dice?.label || "ROLL",
    formula,
    displayFormula,
    rangeText,
    displayText: dice?.showRange && canResolveRange ? rangeText : displayFormula,
    useAttributeDice,
    sourceValid: !useAttributeDice || Boolean(attribute),
    baseCount,
    baseFaces,
    attribute,
    attributeCount,
    attributeFaces,
    modifier,
    flat,
    bonus,
    rollMode,
    chatRoll: dice?.chatRoll !== false,
    actor: owner
  };
}

export async function rollItemDice(item, diceId, { actor = item?.parent, config = getSheetConfig() } = {}) {
  const dice = getItemDiceEntry(item, diceId, config);
  if (!dice || !isRevealed(dice) || dice.chatRoll === false) return false;
  // Ownership must be checked before processing arbitrary Item rules/formulas.
  if (!actorFor(item, actor)?.isOwner) {
    notifyWarning("You do not have permission to use this item roll.");
    return false;
  }
  const resolved = resolveItemDice(item, dice, { actor, config });
  if (resolved.useAttributeDice && !resolved.sourceValid) {
    notifyWarning("This item's attribute dice source is missing. Choose an attribute in Item Configuration.");
    return false;
  }
  if (!resolved.actor?.isOwner) {
    notifyWarning("You do not have permission to use this item roll.");
    return false;
  }
  try {
    const RollClass = foundry.dice?.Roll ?? globalThis.Roll;
    const ChatMessageClass = foundry.documents?.ChatMessage ?? globalThis.ChatMessage;
    if (!RollClass || !ChatMessageClass) throw new Error("Foundry Roll or ChatMessage API is unavailable.");

    const result = await executeItemUse(item, {actor:resolved.actor, config, performRoll:async()=> {
      const roll = new RollClass(resolved.formula);
      await roll.evaluate({ allowInteractive: false });
    const escapedName = foundry.utils.escapeHTML(item?.name || "Item");
    const escapedLabel = foundry.utils.escapeHTML(resolved.label);
    const escapedFormula = foundry.utils.escapeHTML(resolved.displayFormula);
    const escapedMode = foundry.utils.escapeHTML({ normal: "Normal", advantage: "Advantage", disadvantage: "Disadvantage" }[resolved.rollMode] || "Normal");
    const content = `
      <section class="buxa-chat-roll-card buxa-item-chat-roll">
        <header><strong>${escapedName}</strong><span>${escapedLabel}</span></header>
        <div class="buxa-chat-roll-meta">${escapedFormula} · ${escapedMode}</div>
        <footer><span>RESULT</span><strong>${Number(roll.total) || 0}</strong></footer>
      </section>`;
    const messageData = {
      user: game.user.id,
      speaker: ChatMessageClass.getSpeaker({ actor: resolved.actor }),
      flavor: `<strong>${escapedName}</strong> · ${escapedLabel}`,
      content,
      // V14 ChatMessage.rolls is an array of JSON objects, not the legacy
      // stringified roll payload used by older Foundry versions.
      rolls: [roll.toJSON()]
    };
    if (CONST.CHAT_MESSAGE_STYLES?.ROLL !== undefined) messageData.style = CONST.CHAT_MESSAGE_STYLES.ROLL;
    const chatData = typeof ChatMessageClass.applyMode === "function" ? ChatMessageClass.applyMode(messageData) : messageData;
    return {publish:async(resources,remaining,outcome)=> {
      if (resources.length || remaining !== null) {
        const details = resources.map(r=>`${r.action === "fill" ? "+" : "-"}${r.amount} ${r.label} (${r.timing})`);
        if (remaining !== null) details.push(`${remaining} use(s) left${outcome ? ` · ${outcome}` : ""}`);
        chatData.content += `<p class="buxa-item-use-chat">${details.map(t=>foundry.utils.escapeHTML(t)).join(" · ")}</p>`;
      }
      await ChatMessageClass.create(chatData);
    }};
    }});
    return Boolean(result.ok);
  } catch (error) {
    console.error(`${MODULE_ID} | Item roll failed.`, error);
    notifyError(error?.message || "The item roll failed. Check the console for details.");
    return false;
  }
}
