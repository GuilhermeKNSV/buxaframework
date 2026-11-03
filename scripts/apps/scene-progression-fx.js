import { actorRarityContext, rebirthRarityContext } from '../core/rarity-context.js';
/** Short-lived, client-local celebration above an Actor's visible scene Tokens.
 * Purely visual. No changes to token documents or Actor state. */
import { HOOKS } from "../core/constants.js";
import { isNpcQuick } from "../core/npc-sheet.js";
import { getSheetConfig } from "../core/config.js";
import { getAttributeVisual } from "../core/attributes.js";
import { progressionChanges, progressionEventKey } from "./scene-progression-events.js";
import { playSceneSvgProgression, removeSceneProgressionEffects } from "./scene-progression-svg.js";

export function progressionColor(input, fallback = "#76baff") {
  const color = String(input ?? "").trim();
  if (/^#[\da-f]{6}$/i.test(color)) return color;
  if (/^#[\da-f]{3}$/i.test(color)) return `#${[...color.slice(1)].map(c => c + c).join("")}`;
  return fallback;
}

/** Restrict effects to matching Tokens on the currently viewed scene. */
export function matchingProgressionTokens(actor, tokens = []) {
  if (!actor) return [];
  return [...tokens].filter((token) => {
    if (!token || token.destroyed ||
      (token.document?.parent?.id && globalThis.canvas?.scene?.id && token.document.parent.id !== globalThis.canvas.scene.id) ||
      (!globalThis.game?.user?.isGM && (token.document?.hidden || token.visible === false ||
        token.actor?.visible === false))) return false;
    if (!token.center || !Number.isFinite(token.center.x) || !Number.isFinite(token.center.y)) return false;
    if (actor.isToken) return token.document?.id === (actor.token?.id ?? actor.parent?.id) &&
      (token.document?.actorId ?? token.actor?.id) === actor.id;
    return token.document?.actorId === actor.id || token.actor?.id === actor.id;
  });
}

export function progressionVisual(kind, result, config = {}) {
  if (kind === "rebirth") {
    const attribute = result?.attribute ?? {};
    const tier = Math.max(1, Math.floor(Number(result?.after) || 1));
    const color = getAttributeVisual(attribute, tier, config)?.color;
    const rarity = rebirthRarityContext(attribute, tier, config, color);
    return {
      kind,
      attributeId: String(attribute.id || ""),
      rarity,
      color: progressionColor(color, "#a878fc"),
      title: "REBIRTH",
      subtitle: String(attribute.label || "ATTRIBUTE").toUpperCase(),
      value: `R${tier}`,
      duration: 2400
    };
  }
  return {
    kind: "level",
    color: "#efc65a",
    title: "LEVEL UP",
    subtitle: "ASCENDED",
    value: String(Math.max(0, Math.floor(Number(result?.newLevel) || 0))),
    duration: 2100
  };
}

/** Real SVG/CSS effect; no PIXI Graphics chaining (unreliable in Foundry V14). */
export function playTokenProgressionFx(token, visual, options = {}) {
  return playSceneSvgProgression(token, visual, options);
}

/** Even when a WebGL effect cannot be constructed, display Foundry's native
 * canvas floating text rather than silently discarding the celebration. */
export function showProgressionFallback(canvasRef, token, visual) {
  const interfaceGroup = canvasRef?.interface;
  if (!canvasRef?.ready || !interfaceGroup?.createScrollingText || !token?.center) return false;
  try {
    const text = visual.kind === "rebirth"
      ? `${visual.title} · ${visual.subtitle}`
      : `${visual.title} · ${visual.value}`;
    const promise = interfaceGroup.createScrollingText({ x: token.center.x, y: token.center.y - Math.max(42, (Number(token.h) || 70) * .7) }, text, {
      duration: 2200,
      distance: Math.max(36, (Number(token.h) || 70) * .35),
      jitter: 0,
      direction: globalThis.CONST?.TEXT_ANCHOR_POINTS?.TOP ?? 1,
      textStyle: { fill: progressionColor(visual.color), fontSize: 24, fontWeight: "bold" }
    });
    Promise.resolve(promise).catch(error => console.warn("buxaframework | Progression floating text failed.", error));
    return true;
  } catch (error) {
    console.warn("buxaframework | Progression floating text failed.", error);
    return false;
  }
}

export function installSceneProgressionFx() {
  const channel = "module.buxaframework";
  const recentlyPlayed = new Map();
  const recentlyBroadcast = new Map();
  const recentlySeen = key => {
    const now = Date.now();
    for (const [older, expiry] of recentlyPlayed) if (expiry <= now) recentlyPlayed.delete(older);
    return (recentlyPlayed.get(key) ?? 0) > now;
  };
  const play = (actor, visual, eventKey) => {
    const scene = globalThis.canvas?.scene;
    const themeActor = actor?.isToken
      ? globalThis.canvas?.tokens?.placeables?.find(t => t.document?.id === (actor.token?.id ?? actor.parent?.id))?.actor ?? actor
      : actor;
    visual = { ...visual, rarity: visual.kind === "level" ? actorRarityContext(themeActor, getSheetConfig()) : visual.rarity };
    if (!globalThis.canvas?.ready || !scene || isNpcQuick(actor)) return false;
    const key = eventKey || progressionEventKey(actor, visual, scene.id);
    if (recentlySeen(key)) return false;
    let displayed = false;
    for (const token of matchingProgressionTokens(actor, globalThis.canvas.tokens?.placeables ?? [])) {
      if (isNpcQuick(token.actor)) continue;
      let tokenDisplayed = false;
      try {
        tokenDisplayed = playTokenProgressionFx(token, visual);
      } catch (error) {
        console.warn("buxaframework | Scene progression effect failed; using floating text.", error);
      }
      if (!tokenDisplayed) tokenDisplayed = showProgressionFallback(globalThis.canvas, token, visual);
      displayed = tokenDisplayed || displayed;
    }
    if (displayed) recentlyPlayed.set(key, Date.now() + 6000);
    return displayed;
  };
  const broadcast = (actor, visual) => {
    if (!actor || !globalThis.canvas?.scene?.id || isNpcQuick(actor)) return;
    const key = progressionEventKey(actor, visual, globalThis.canvas.scene.id);
    play(actor, visual, key);
    if ((recentlyBroadcast.get(key) ?? 0) > Date.now()) return;
    recentlyBroadcast.set(key, Date.now() + 6000);
    try {
      const sent = globalThis.game?.socket?.emit?.(channel, {
        type: "progression-fx", sender: globalThis.game?.user?.id,
        sceneId: globalThis.canvas.scene.id,
        actorId: actor.id, tokenId: actor.isToken ? (actor.token?.id ?? actor.parent?.id) : null,
        key, visual
      });
      Promise.resolve(sent).catch(error => console.warn("buxaframework | Progression FX socket failed.", error));
    } catch (error) {
      console.warn("buxaframework | Progression FX socket failed.", error);
    }
  };
  Hooks.on(HOOKS.LEVEL_UP, (actor, result) => broadcast(actor, progressionVisual("level", result)));
  Hooks.on(HOOKS.ATTRIBUTE_REBIRTH, (actor, attribute, result) =>
    broadcast(actor, progressionVisual("rebirth", { ...result, attribute }, getSheetConfig())));
  Hooks.on("updateActor", (actor, changes, options, userId) => {
    const config = getSheetConfig();
    for (const event of progressionChanges(actor, changes, options, config)) {
      const visual = progressionVisual(event.kind, event.result, config);
      if (userId && userId !== game.user?.id) play(actor, visual);
      else broadcast(actor, visual);
    }
  });
  game.socket?.on?.(channel, (message) => {
    if (message?.type !== "progression-fx" || message.sender === game.user?.id
        || message.sceneId !== globalThis.canvas?.scene?.id) return;
    if (!message.actorId || !["level", "rebirth"].includes(message.visual?.kind)) return;
    const actor = message.tokenId
      ? { id: message.actorId, isToken: true, token: { id: message.tokenId } }
      : game.actors?.get?.(message.actorId);
    if (!actor || isNpcQuick(actor)) return;
    const safeVisual = {
      kind: message.visual.kind,
      attributeId: String(message.visual.attributeId || "").slice(0, 80),
      color: progressionColor(message.visual.color),
      rarity: { ...getSheetConfig().items?.rarities?.find(r => r.id === String(message.visual.rarity?.id)),
        color: progressionColor(message.visual.rarity?.color || message.visual.color) },
      title: String(message.visual.title || "").slice(0, 35),
      subtitle: String(message.visual.subtitle || "").slice(0, 70),
      value: String(message.visual.value || "").slice(0, 12),
      duration: message.visual.kind === "rebirth" ? 2400 : 2100
    };
    play(actor, safeVisual, progressionEventKey(actor, safeVisual, message.sceneId));
  });
  Hooks.on("canvasTearDown", () => {
    recentlyPlayed.clear();
    recentlyBroadcast.clear();
    removeSceneProgressionEffects();
  });
  if (game.buxaframework) {
    game.buxaframework.previewProgressionFx = (actor, kind = "level", attributeId = "") => {
      if (!game.user?.isGM || !actor || !["level", "rebirth"].includes(kind)) return false;
      const config = getSheetConfig();
      const selected = config.attributes.entries.find(entry => entry.id === attributeId)
        ?? config.attributes.entries.find(entry => entry.rebirth?.enabled)
        ?? { id: "preview", label: "ATTRIBUTE", rebirth: { enabled: true } };
      const tier = Math.max(1, Number(actor.getFlag?.("buxaframework", `attributes.${selected.id}.rebirths`)) || 1);
      const level = Math.max(1, Number(actor.getFlag?.("buxaframework", "level")) || 1);
      const visual = progressionVisual(kind, kind === "rebirth"
        ? { attribute: selected, after: tier }
        : { newLevel: level }, config);
      return play(actor, visual, `${progressionEventKey(actor, visual, canvas.scene?.id)}|preview|${Date.now()}`);
    };
  }
}
