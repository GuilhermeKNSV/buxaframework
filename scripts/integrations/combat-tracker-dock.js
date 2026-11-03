import { HOOKS, MODULE_ID } from "../core/constants.js";
import { getSheetConfig } from "../core/config.js";

const DOCK_SELECTOR = "#combat-dock, .combat-dock, [data-appid='combat-dock']";
const COMBATANT_SELECTOR = "[data-combatant-id], [data-entry-id], [data-document-id], [id^='combatant-'], [id^='combatant_']";

function integrationEnabled() {
  return getSheetConfig().addons.carouselTracker.enabled
    && Boolean(game.modules.get("combat-tracker-dock")?.active);
}

function isElement(value) {
  return Boolean(value && value.nodeType === 1 && typeof value.querySelectorAll === "function");
}

function asElement(html) {
  if (isElement(html)) return html;
  if (isElement(html?.[0])) return html[0];
  if (isElement(html?.element)) return html.element;
  return null;
}

function combatantNodes(root) {
  if (!isElement(root)) return [];
  const nodes = [...(root.querySelectorAll?.(COMBATANT_SELECTOR) ?? [])];
  if (root.matches?.(COMBATANT_SELECTOR)) nodes.unshift(root);
  return nodes;
}

function findCombatantId(node) {
  const direct = node.dataset.combatantId || node.dataset.entryId || node.dataset.documentId;
  if (direct && game.combat?.combatants?.has(direct)) return direct;

  const idCandidate = node.id?.replace(/^combatant[-_]/, "");
  if (idCandidate && game.combat?.combatants?.has(idCandidate)) return idCandidate;
  return null;
}

function applyPortraits(root) {
  if (!game.combat || !isElement(root)) return;

  for (const node of combatantNodes(root)) {
    const combatantId = findCombatantId(node);
    if (!combatantId) continue;
    const actor = game.combat.combatants.get(combatantId)?.actor;
    const fullbody = actor?.img;
    if (!fullbody) continue;

    const images = node.querySelectorAll("img");
    if (!images.length) continue;

    const portrait = [...images].find((img) => !img.closest("button")) || images[0];
    if (!portrait || portrait.getAttribute("src") === fullbody) continue;
    portrait.setAttribute("src", fullbody);
    portrait.dataset.buxaFullbody = "true";
  }
}

let observer = null;
let observedDock = null;
let queued = false;
let queuedRoot = null;

function stopObserver() {
  observer?.disconnect();
  observer = null;
  observedDock = null;
}

function queueApply(root) {
  queuedRoot = root;
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    const target = queuedRoot;
    queuedRoot = null;
    if (target?.isConnected) applyPortraits(target);
  });
}

function observeDock(dock) {
  if (!isElement(dock)) return;
  if (observedDock === dock && observer) {
    queueApply(dock);
    return;
  }

  stopObserver();
  observedDock = dock;
  observer = new MutationObserver((mutations) => {
    if (!mutations.some((mutation) => mutation.type === "attributes" || mutation.addedNodes.length || mutation.removedNodes.length)) return;
    queueApply(dock);
  });
  observer.observe(dock, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src", "data-combatant-id", "data-entry-id", "data-document-id"]
  });
  queueApply(dock);
}

function findDock(root = document) {
  if (isElement(root) && root.matches?.(DOCK_SELECTOR)) return root;
  return root?.querySelector?.(DOCK_SELECTOR) ?? document.querySelector(DOCK_SELECTOR);
}

function activateDock(root = document) {
  const dock = findDock(root);
  if (!dock) return false;
  observeDock(dock);
  return true;
}

export function refreshCombatDockPortraits() {
  if (!integrationEnabled()) {
    stopObserver();
    return;
  }
  const dock = observedDock?.isConnected ? observedDock : findDock(document);
  if (!dock) {
    stopObserver();
    return;
  }
  observeDock(dock);
  applyPortraits(dock);
}

export function registerCombatTrackerDockIntegration() {
  Hooks.on("renderCombatDock", (_app, html) => {
    if (!integrationEnabled()) return;
    const root = asElement(html) || document;
    queueMicrotask(() => activateDock(root));
  });

  Hooks.on(HOOKS.FULLBODY_UPDATED, () => {
    queueMicrotask(refreshCombatDockPortraits);
  });

  Hooks.on(HOOKS.CONFIG_UPDATED, () => {
    if (!integrationEnabled()) {
      stopObserver();
      return;
    }
    queueMicrotask(() => activateDock(document));
  });

  // A fullbody may be changed by another client or by another module without
  // going through Buxa's image picker. Keep the local dock in sync in either case.
  Hooks.on("updateActor", (_actor, changed) => {
    if (!Object.prototype.hasOwnProperty.call(changed ?? {}, "img")) return;
    queueMicrotask(refreshCombatDockPortraits);
  });

  Hooks.once("ready", () => {
    if (!integrationEnabled()) return;
    activateDock(document);
    console.log(`${MODULE_ID} | Combat Tracker Dock integration enabled.`);
  });
}
