import { getSheetConfig } from "../core/config.js";
import { itemUseView } from "./item-use-actions.js";
import { buildItemPresentation } from "../core/item-presentation.js";
import { getItemRequirementState } from "../core/item-runtime.js";

const states = new WeakMap();
const HOVER_DELAY = 1000;

function closeState(sheet) {
  const state = states.get(sheet);
  if (!state) return;
  if (state.timer) clearTimeout(state.timer);
  if (state.hideTimer) clearTimeout(state.hideTimer);
  state.controller?.abort?.();
  state.tooltip?.remove?.();
  states.delete(sheet);
}

export function appendItemHoverEffectLine(parent, line, kind = "increase") {
  const row = parent.ownerDocument.createElement("div");
  row.className = `buxa-item-hover-line ${line.themeClass || ""} is-${kind} buxa-discovery-${line.visibility || "revealed"}`;
  row.style.cssText = line.style || "";
  row.style.setProperty("--buxa-tooltip-color", line.color || "#c8d0dc");
  const icon = parent.ownerDocument.createElement(line.icon && !line.locked && !line.hidden ? "img" : "i");
  if (line.locked) icon.className = "fa-solid fa-lock";
  else if (line.hidden) icon.className = "fa-solid fa-eye-slash";
  else if (line.icon) { icon.src = line.icon; icon.alt = ""; }
  else icon.className = kind === "dice" ? "fa-solid fa-dice-d20" : "fa-solid fa-diamond";
  const copy = parent.ownerDocument.createElement("span");
  copy.className = "buxa-item-effect-copy";
  const value = parent.ownerDocument.createElement("strong");
  value.className = "buxa-item-effect-value";
  value.textContent = kind === "dice" ? line.displayText : line.valueText;
  const label = parent.ownerDocument.createElement("span");
  label.className = "buxa-item-effect-label";
  label.textContent = line.label;
  copy.append(value, label);
  if (line.passive) {
    const passive = parent.ownerDocument.createElement("small");
    passive.className = "buxa-item-effect-passive";
    passive.textContent = "PASSIVE";
    copy.append(passive);
  }
  row.append(icon, copy);
  parent.append(row);
}

function appendDecorations(parent, decorations = []) {
  const doc = parent.ownerDocument;
  for (const decoration of decorations) {
    const type = decoration.type;
    if (!["divider", "symbols", "text", "spacer"].includes(type)) continue;
    const element = doc.createElement("div");
    element.className = `buxa-item-custom-${type}`;
    element.style.setProperty("--buxa-tooltip-color", decoration.color || "#8b97a7");
    if (type === "divider") element.append(doc.createElement("span"));
    else if (type === "symbols") element.textContent = decoration.symbols || "";
    else if (type === "text") element.textContent = decoration.text || "";
    parent.append(element);
  }
}

export function createTooltip(sheet, item) {
  const config = getSheetConfig();
  const presentation = buildItemPresentation(item, { actor: sheet.actor, config });
  const requirement = getItemRequirementState(item, sheet.actor, config);
  const doc = sheet.element?.ownerDocument ?? document;
  const tooltip = doc.createElement("aside");
  tooltip.className = `buxa-item-hover-tooltip ${presentation.rarityClass}`;
  tooltip.style.cssText += presentation.rarityStyle;
  tooltip.setAttribute("role", "tooltip");
  tooltip.dataset.rarityTier = String(presentation.rarityTier);
  tooltip.tabIndex = 0;

  const header = doc.createElement("header");
  const copy = doc.createElement("div");
  const name = doc.createElement("strong");
  name.textContent = `${item.name || "Item"}${presentation.showQuantity ? ` x${presentation.quantity}` : ""}`;
  const sub = doc.createElement("span");
  sub.textContent = [presentation.rarity?.label, presentation.showTypeLabel ? presentation.typeLabel : ""].filter(Boolean).join(" · ");
  copy.append(name, sub);
  header.append(copy);
  tooltip.append(header);

  const use = itemUseView(item,config);
  const meta = [];
  if (requirement.enabled) meta.push({ icon: "fa-solid fa-bookmark", text: `Level ${requirement.required}`, bad: !requirement.met });
  if (presentation.rules.weight.enabled) meta.push({ icon: "fa-solid fa-weight-hanging", text: `Weight ${presentation.totalWeightText}` });
  if (meta.length) {
    const metaRow = doc.createElement("div");
    metaRow.className = "buxa-item-hover-meta";
    for (const entry of meta) {
      const span = doc.createElement("span");
      if (entry.bad) span.classList.add("is-unmet");
      const i = doc.createElement("i");
      i.className = entry.icon;
      span.append(i, doc.createTextNode(entry.text));
      metaRow.append(span);
    }
    tooltip.append(metaRow);
  }

  if (use.limits.enabled) {
    const charges=doc.createElement('div');charges.className=`buxa-item-hover-charges${use.exhausted?' is-exhausted':''}`;
    const caption=doc.createElement('span');caption.className='buxa-item-use-caption';
    const icon=doc.createElement('i');icon.className=use.exhausted?'fa-solid fa-lock':'fa-solid fa-hourglass-half';
    caption.append(icon,doc.createTextNode(' Charges'));
    const count=doc.createElement('strong');count.textContent=use.limitsDisplay;
    const track=doc.createElement('div');track.className='buxa-item-use-meter';
    const fill=doc.createElement('span');fill.className='buxa-item-use-meter-fill';fill.style.width=`${use.usesPercent}%`;
    track.append(fill);charges.append(caption,count,track);
    if(use.onExhaustLabel){const empty=doc.createElement('small');empty.className='buxa-item-use-recharge-line';empty.textContent=use.onExhaustLabel;charges.append(empty);}
    for(const label of use.rechargeLabels){const line=doc.createElement('small');line.className='buxa-item-use-recharge-line';line.textContent=label;charges.append(line);}
    tooltip.append(charges);
  }
  if (use.hasResourceEffects) {
    const group=doc.createElement('section');group.className='buxa-item-use-resources buxa-item-hover-resource-lines';
    const heading=doc.createElement('div');heading.className='buxa-item-use-heading';
    const title=doc.createElement('h2');title.textContent='When used';
    const rule=doc.createElement('span');rule.className='buxa-item-use-heading-rule';
    heading.append(title,rule);group.append(heading);
    const effects=doc.createElement('div');effects.className='buxa-item-use-effects';
    for (const effect of use.resourceEffects) {
      const row=doc.createElement('div');row.className=`buxa-item-use-effect ${effect.fill?'is-fill':'is-drain'}`;
      const glyph=doc.createElement('i');glyph.className='fa-solid fa-diamond';
      const copy=doc.createElement('span');copy.className='buxa-item-use-effect-copy';
      const value=doc.createElement('span');value.className='buxa-item-use-effect-value';
      const description=doc.createElement('strong');description.textContent=effect.description;
      value.append(description);
      copy.append(value);
      row.append(glyph,copy);effects.append(row);
    }
    group.append(effects);tooltip.append(group);
  }
  const diceLines = presentation.diceLines;
  const increaseLines = presentation.increaseLines;
  const hasDescription = presentation.descriptionParts.length > 0;
  if (diceLines.length || increaseLines.length || hasDescription || Object.values(presentation.decorations).some((group) => group.length)) {
    const body = doc.createElement("div");
    body.className = "buxa-item-hover-lines";
    appendDecorations(body, presentation.decorations.beforeDice);
    if (diceLines.length) {
      const group = doc.createElement("section");
      group.className = "buxa-item-hover-group";
      for (const line of diceLines) appendItemHoverEffectLine(group, line, "dice");
      body.append(group);
    }
    appendDecorations(body, presentation.decorations.between);
    if (increaseLines.length) {
      const group = doc.createElement("section");
      group.className = "buxa-item-hover-group";
      for (const line of increaseLines) appendItemHoverEffectLine(group, line, "increase");
      body.append(group);
    }
    appendDecorations(body, presentation.decorations.beforeDescription);
    if (hasDescription) {
      const description = doc.createElement("p");
      description.className = "buxa-item-hover-description buxa-modular-description";
      for (const part of presentation.descriptionParts) {
        const span = doc.createElement("span");
        span.className = `buxa-description-fragment buxa-discovery-${part.visibility}`;
        span.append(doc.createTextNode(part.prefix));
        if (part.locked) {
          const lock = doc.createElement("i");
          lock.className = "fa-solid fa-lock";
          lock.setAttribute("aria-hidden", "true");
          span.append(lock, doc.createTextNode(" "));
        }
        span.append(doc.createTextNode(part.text));
        description.append(span);
      }
      body.append(description);
    }
    tooltip.append(body);
  }
  if (!diceLines.length && !increaseLines.length && !hasDescription &&
      !Object.values(presentation.decorations).some(group => group.length) &&
      !use.limits.enabled && !use.hasResourceEffects) {
    const empty = doc.createElement("p");
    empty.className = "buxa-item-hover-empty";
    empty.textContent = "No additional effects are configured.";
    tooltip.append(empty);
  }
  return tooltip;
}

function positionTooltip(tooltip, target) {
  const rect = target.getBoundingClientRect();
  const doc = target.ownerDocument;
  const view = doc.defaultView ?? window;
  const margin = 10;
  const tip = tooltip.getBoundingClientRect();
  const roomRight = view.innerWidth - rect.right - margin;
  const roomLeft = rect.left - margin;
  let left = roomRight >= tip.width || roomRight >= roomLeft ? rect.right + margin : rect.left - tip.width - margin;
  // Clamp both axes even when a long tooltip is larger than the viewport.
  // It must stay scrollable instead of disappearing above/left of the screen.
  tooltip.style.maxHeight = `${Math.max(72, view.innerHeight - margin * 2)}px`;
  tooltip.style.maxWidth = `${Math.max(120, view.innerWidth - margin * 2)}px`;
  tooltip.style.overflowY = 'auto';
  const top = Math.max(margin, Math.min(Math.max(margin, view.innerHeight - tip.height - margin), rect.top));
  left = Math.max(margin, Math.min(Math.max(margin, view.innerWidth - tip.width - margin), left));
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function clearHideTimer(state) {
  if (state.hideTimer) clearTimeout(state.hideTimer);
  state.hideTimer = null;
}

function hideTooltip(state) {
  if (state.timer) clearTimeout(state.timer);
  state.timer = null;
  state.tooltip?.remove?.();
  state.tooltip = null;
  state.target = null;
}

function scheduleHide(state) {
  clearHideTimer(state);
  state.hideTimer = setTimeout(() => {
    state.hideTimer = null;
    const tooltip = state.tooltip;
    if (!tooltip?.matches?.(":hover") && !tooltip?.contains?.(tooltip.ownerDocument.activeElement)) hideTooltip(state);
  }, 140);
}

export function bindItemHoverTooltips(sheet) {
  closeState(sheet);
  const root = sheet.element;
  if (!root) return;
  const state = { timer: null, hideTimer: null, tooltip: null, target: null, controller: new AbortController() };
  states.set(sheet, state);
  const { signal } = state.controller;

  const hide = () => {
    clearHideTimer(state);
    hideTooltip(state);
  };
  const show = target => {
    clearHideTimer(state);
    hideTooltip(state);
    if (root.ownerDocument.body.classList.contains("buxa-inventory-pointer-dragging")) return;
    state.target = target;
    state.timer = setTimeout(() => {
      state.timer = null;
      const itemId=target.dataset.hitItemId || target.dataset.itemId;
      const item = sheet.actor?.items?.get?.(itemId);
      if (!item || !target.isConnected) return;
      const itemSheetOpen = item.uuid && [...root.ownerDocument.querySelectorAll(".buxa-item-sheet[data-item-uuid]")]
        .some(element => element.dataset.itemUuid === item.uuid);
      if (itemSheetOpen) return;
      const tooltip = createTooltip(sheet, item);
      root.ownerDocument.body.append(tooltip);
      state.tooltip = tooltip;
      positionTooltip(tooltip, target);
      tooltip.addEventListener("pointerenter", () => clearHideTimer(state), { signal });
      tooltip.addEventListener("pointerleave", () => scheduleHide(state), { signal });
      tooltip.addEventListener("focusin", () => clearHideTimer(state), { signal });
      tooltip.addEventListener("focusout", event => {
        if (!tooltip.contains(event.relatedTarget) && event.relatedTarget !== state.target) scheduleHide(state);
      }, { signal });
      requestAnimationFrame(() => tooltip.classList.add("is-open"));
    }, HOVER_DELAY);
  };

  // Complex board cells can receive pointer events instead of the image.
  // Only mapped occupied cells get an item tooltip; bounding-box holes do not.
  const targets = [...new Set([
    ...root.querySelectorAll("[data-item-id]"),
    ...[...root.querySelectorAll('[data-hit-item-id]')].filter(node=>Boolean(node.dataset.hitItemId))
  ])];
  for (const target of targets) {
    target.addEventListener("pointerenter", () => show(target), { signal });
    target.addEventListener("pointerleave", () => scheduleHide(state), { signal });
    target.addEventListener("focusin", () => show(target), { signal });
    target.addEventListener("focusout", event => {
      if (!target.contains(event.relatedTarget)) scheduleHide(state);
    }, { signal });
    target.addEventListener("pointerdown", hide, { signal });
    target.addEventListener("contextmenu", hide, { signal });
  }

  root.querySelector(".buxa-sheet-scroll")?.addEventListener("scroll", hide, { passive: true, signal });
}

export function closeItemHoverTooltip(sheet) {
  closeState(sheet);
}
