import { notifyError } from "../core/notifications.js";
import { MODULE_ID } from "../core/constants.js";
import {
  getAttributeDice,
  getAttributeModifier,
  getAttributeRebirths,
  getAttributeValue,
  getAttributeVisual
} from "../core/attributes.js";
import { getSheetConfig } from "../core/config.js";

const menuState = new WeakMap();

function closeMenu(sheet) {
  const state = menuState.get(sheet);
  state?.cleanup?.();
  state?.menu?.remove?.();
  menuState.delete(sheet);
}

export async function rollAttribute(sheet, attribute, mode = "normal") {
  if (!sheet.actor?.isOwner || !attribute) return false;

  const validModes = new Set(["normal", "advantage", "disadvantage"]);
  const rollMode = validModes.has(mode) ? mode : "normal";

  try {
    const config = getSheetConfig();
    const value = getAttributeValue(sheet.actor, attribute, config);
    const rebirths = getAttributeRebirths(sheet.actor, attribute.id);
    const baseDice = Math.max(1, Math.min(100, Number(getAttributeDice(attribute, rebirths, sheet.actor, config)) || 1));
    const modifier = Number(getAttributeModifier(attribute, value, rebirths, sheet.actor, config) ?? 0) || 0;
    const rollCount = rollMode === "advantage" ? baseDice + 1 : baseDice;
    const keepWorst = rollMode === "disadvantage";

    const RollClass = foundry.dice?.Roll ?? globalThis.Roll;
    const ChatMessageClass = foundry.documents?.ChatMessage ?? globalThis.ChatMessage;
    if (!RollClass || !ChatMessageClass) throw new Error("Foundry Roll or ChatMessage API is unavailable.");

    const formula = `1d20 ${modifier >= 0 ? "+" : "-"} ${Math.abs(modifier)}`;
    const results = [];
    for (let i = 0; i < rollCount; i += 1) {
      const roll = new RollClass(formula);
      await roll.evaluate({ allowInteractive: false });
      const raw = Number(roll.dice?.[0]?.total ?? (Number(roll.total) - modifier)) || 0;
      results.push({ roll, raw, total: Number(roll.total) || 0 });
    }
    if (!results.length) return false;

    let selectedIndex = 0;
    for (let i = 1; i < results.length; i += 1) {
      const better = keepWorst
        ? results[i].total < results[selectedIndex].total
        : results[i].total > results[selectedIndex].total;
      if (better) selectedIndex = i;
    }

    const modeLabels = {
      normal: "Normal Roll",
      advantage: "Vantagem",
      disadvantage: "Desvantagem"
    };
    const modeLabel = modeLabels[rollMode];
    const escapedLabel = foundry.utils.escapeHTML(attribute.label);
    const escapedMode = foundry.utils.escapeHTML(modeLabel);
    const modText = modifier >= 0 ? `+${modifier}` : String(modifier);
    const keepText = keepWorst ? "worst" : "best";

    const rows = results.map((entry, index) => `
      <div class="buxa-chat-roll-row ${index === selectedIndex ? "is-kept" : ""}">
        <span class="buxa-chat-roll-index">${index + 1}</span>
        <span class="buxa-chat-roll-d20">${entry.raw}</span>
        <span class="buxa-chat-roll-mod">${modText}</span>
        <strong class="buxa-chat-roll-total">${entry.total}</strong>
        ${index === selectedIndex ? `<span class="buxa-chat-roll-kept">${keepText.toUpperCase()}</span>` : ""}
      </div>`).join("");

    const content = `
      <section class="buxa-chat-roll-card">
        <header>
          <strong>${escapedLabel}</strong>
          <span>${escapedMode}</span>
        </header>
        <div class="buxa-chat-roll-meta">${rollCount} × (1d20 ${modText}) · keep ${keepText}</div>
        <div class="buxa-chat-roll-list">${rows}</div>
        <footer><span>RESULT</span><strong>${results[selectedIndex].total}</strong></footer>
      </section>`;

    const messageData = {
      user: game.user.id,
      speaker: ChatMessageClass.getSpeaker({ actor: sheet.actor }),
      flavor: `<strong>${escapedLabel}</strong> · ${escapedMode}`,
      content,
      rolls: results.map((entry) => entry.roll.toJSON())
    };
    if (CONST.CHAT_MESSAGE_STYLES?.ROLL !== undefined) messageData.style = CONST.CHAT_MESSAGE_STYLES.ROLL;
    const chatData = typeof ChatMessageClass.applyMode === "function"
      ? ChatMessageClass.applyMode(messageData)
      : messageData;
    await ChatMessageClass.create(chatData);
    return true;
  } catch (error) {
    console.error(`${MODULE_ID} | Attribute roll failed.`, error);
    notifyError("The attribute roll failed. Check the console for details.");
    return false;
  }
}

export function openAttributeRollMenu(sheet, emblem) {
  closeMenu(sheet);
  if (!sheet.actor?.isOwner || !emblem) return;

  const attributeId = emblem.dataset.attributeId;
  const config = getSheetConfig();
  const attribute = config.attributes.entries.find((entry) => entry.id === attributeId);
  if (!attribute) return;

  const value = getAttributeValue(sheet.actor, attribute, config);
  const rebirths = getAttributeRebirths(sheet.actor, attribute.id);
  const baseDice = Math.max(1, Math.min(100, Number(getAttributeDice(attribute, rebirths, sheet.actor, config)) || 1));
  const modifier = Number(getAttributeModifier(attribute, value, rebirths, sheet.actor, config) ?? 0) || 0;
  const visual = getAttributeVisual(attribute, rebirths);
  const modText = modifier >= 0 ? `+${modifier}` : String(modifier);
  const escapedLabel = foundry.utils.escapeHTML(attribute.label);

  const ownerDocument = sheet.element?.ownerDocument ?? document;
  const menu = ownerDocument.createElement("div");
  menu.className = "buxa-attribute-roll-menu";
  menu.setAttribute("role", "menu");
  menu.style.setProperty("--buxa-roll-accent", visual?.color || "#7f8ca1");
  const normalLabel = `${baseDice} ${baseDice === 1 ? "roll" : "rolls"} · 1d20 ${modText} · best`;
  const advantageDice = baseDice + 1;
  const advantageLabel = `${advantageDice} ${advantageDice === 1 ? "roll" : "rolls"} · 1d20 ${modText} · best`;
  const disadvantageLabel = `${baseDice} ${baseDice === 1 ? "roll" : "rolls"} · 1d20 ${modText} · worst`;

  menu.innerHTML = `
    <header class="buxa-roll-menu-head">
      <div class="buxa-roll-menu-title">
        <span class="buxa-roll-menu-dice">${baseDice}</span>
        <div>
          <strong>${escapedLabel}</strong>
          <span>${baseDice} ${baseDice === 1 ? "die" : "dice"} · MOD ${modText}</span>
        </div>
      </div>
      <button type="button" class="buxa-roll-menu-close" data-roll-close aria-label="Close">×</button>
    </header>

    <div class="buxa-roll-mode-list">
      <button type="button" class="buxa-roll-mode is-normal" data-roll-mode="normal" role="menuitem">
        <span class="buxa-roll-mode-mark">N</span>
        <span class="buxa-roll-mode-copy">
          <strong>Normal Roll</strong>
          <small>${normalLabel}</small>
        </span>
        <span class="buxa-roll-mode-result">BEST</span>
      </button>

      <button type="button" class="buxa-roll-mode is-advantage" data-roll-mode="advantage" role="menuitem">
        <span class="buxa-roll-mode-mark">+</span>
        <span class="buxa-roll-mode-copy">
          <strong>Vantagem</strong>
          <small>${advantageLabel}</small>
        </span>
        <span class="buxa-roll-mode-result">BEST</span>
      </button>

      <button type="button" class="buxa-roll-mode is-disadvantage" data-roll-mode="disadvantage" role="menuitem">
        <span class="buxa-roll-mode-mark">−</span>
        <span class="buxa-roll-mode-copy">
          <strong>Desvantagem</strong>
          <small>${disadvantageLabel}</small>
        </span>
        <span class="buxa-roll-mode-result">WORST</span>
      </button>
    </div>`;

  sheet.element.append(menu);

  const rootRect = sheet.element.getBoundingClientRect();
  const targetRect = emblem.getBoundingClientRect();
  menu.style.left = `${Math.max(8, targetRect.left - rootRect.left)}px`;
  menu.style.top = `${targetRect.bottom - rootRect.top + 8}px`;

  const ownerWindow = ownerDocument.defaultView ?? window;
  ownerWindow.requestAnimationFrame(() => {
    if (!menu.isConnected) return;
    const menuRect = menu.getBoundingClientRect();
    let left = targetRect.left - rootRect.left;
    let top = targetRect.bottom - rootRect.top + 8;
    if (left + menuRect.width > rootRect.width - 8) left = rootRect.width - menuRect.width - 8;
    if (top + menuRect.height > rootRect.height - 8) top = targetRect.top - rootRect.top - menuRect.height - 8;
    menu.style.left = `${Math.max(8, left)}px`;
    menu.style.top = `${Math.max(8, top)}px`;
    menu.classList.add("is-open");
    menu.querySelector("[data-roll-mode]")?.focus?.();
  });

  menu.querySelector("[data-roll-close]")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeMenu(sheet);
    emblem.focus?.();
  });

  for (const button of menu.querySelectorAll("[data-roll-mode]")) {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const mode = button.dataset.rollMode || "normal";
      closeMenu(sheet);

      emblem.classList.remove("is-rolling");
      void emblem.offsetWidth;
      emblem.classList.add("is-rolling");
      ownerWindow.setTimeout(() => emblem.classList.remove("is-rolling"), 460);

      await rollAttribute(sheet, attribute, mode);
    });
  }

  const outside = (event) => {
    if (menu.contains(event.target) || emblem.contains(event.target)) return;
    closeMenu(sheet);
  };
  const onEscape = (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    closeMenu(sheet);
    emblem.focus?.();
  };
  const onScroll = () => closeMenu(sheet);

  const scrollElement = sheet.element.querySelector(".buxa-sheet-scroll");
  ownerDocument.addEventListener("pointerdown", outside, true);
  ownerDocument.addEventListener("keydown", onEscape, true);
  scrollElement?.addEventListener("scroll", onScroll, { passive: true });
  menuState.set(sheet, {
    menu,
    cleanup: () => {
      ownerDocument.removeEventListener("pointerdown", outside, true);
      ownerDocument.removeEventListener("keydown", onEscape, true);
      scrollElement?.removeEventListener("scroll", onScroll);
    }
  });
}

export function closeAttributeRollMenu(sheet) {
  closeMenu(sheet);
}
