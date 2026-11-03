import { applyRarityVisual } from '../core/rarity-visuals.js';
/** SVG-backed DOM celebrations anchored to live Foundry V14 scene Tokens.
 * Uses browser CSS animation, avoiding PIXI.Graphics shape APIs that differ
 * between Foundry/PIXI builds. No Token or Actor documents are modified.
 */
const running = new Set();
const activeEffects = new Map();

export function sceneTokenScreenPosition(canvasRef, token) {
  const app = canvasRef?.app;
  const view = app?.renderer?.canvas ?? app?.canvas ?? app?.view ?? app?.renderer?.view
    ?? globalThis.document?.querySelector?.("#board canvas");
  const bounds = view?.getBoundingClientRect?.();
  const center = token?.center;
  if (!bounds || !center || !Number.isFinite(center.x) || !Number.isFinite(center.y)
      || bounds.width <= 0 || bounds.height <= 0) return null;
  const screen = app?.renderer?.screen ?? app?.screen;
  const sceneWidth = Number(screen?.width) || Number(view?.width) || bounds.width;
  const sceneHeight = Number(screen?.height) || Number(view?.height) || bounds.height;
  if (sceneWidth <= 0 || sceneHeight <= 0) return null;
  let transformed = center;
  const stage = canvasRef?.stage;
  if (typeof stage?.toGlobal === "function") transformed = stage.toGlobal(center);
  else if (typeof stage?.worldTransform?.apply === "function") transformed = stage.worldTransform.apply(center);
  if (!transformed || !Number.isFinite(transformed.x) || !Number.isFinite(transformed.y)) return null;
  const scaleX = bounds.width / sceneWidth;
  const scaleY = bounds.height / sceneHeight;
  const zoom = Math.max(.1, Number(stage?.scale?.x) || Number(stage?.worldTransform?.a) || 1);
  const tokenHalfHeight = Math.max(14, Math.min(240, (Number(token?.h) || 70) * zoom * scaleY * .5));
  const tokenSize = Math.max(Number(token?.w) || 70, Number(token?.h) || 70) * zoom * Math.max(scaleX, scaleY);
  return {
    x: bounds.left + transformed.x * scaleX,
    y: bounds.top + transformed.y * scaleY,
    halfHeight: tokenHalfHeight,
    span: Math.max(135, Math.min(320, tokenSize * 2.2))
  };
}

export function removeSceneProgressionEffects() {
  for (const cleanup of [...running]) cleanup();
}

function effectKey(token, visual) {
  const tokenId = String(token?.document?.id ?? token?.id ?? token?.actor?.token?.id ?? "token");
  const attribute = visual?.kind === "rebirth" ? String(visual?.attributeId || "") : "";
  const sceneId = String(token?.document?.parent?.id ?? globalThis.canvas?.scene?.id ?? 'scene');
  return `${sceneId}|${tokenId}|${String(visual?.kind || "level")}|${attribute}`;
}

function applyVisualToNode(node, visual) {
  if (!node) return;
  node.className = `buxa-scene-celebration ${visual.kind === "rebirth" ? "is-rebirth" : "is-level"}`;
  const theme = applyRarityVisual(node, visual.rarity ?? { id: 'divine', color: visual.color || '#78ddff' });
  node.setAttribute?.("aria-hidden", "true");
  node.dataset.kind = String(visual.kind || "level");
  node.dataset.attributeId = String(visual.attributeId || "");
  const label = node.querySelector?.(".buxa-celebration-label");
  if (label) label.textContent = visual.kind === "rebirth" ? "REBIRTH" : "LEVEL UP";
  const number = node.querySelector?.(".buxa-celebration-number");
  if (number) {
    number.textContent = visual.kind === "rebirth" ? "" : String(visual.value ?? "");
    number.classList?.toggle?.("is-long", number.textContent.length >= 5);
  }
  const sublabel = node.querySelector?.(".buxa-celebration-sublabel");
  if (sublabel) {
    sublabel.textContent = visual.kind === "rebirth"
      ? String(visual.subtitle || "ATTRIBUTE")
      : "";
  }
  node.style?.setProperty?.("--buxa-fx-color", String(visual.rarity ? theme.glowColor : visual.color || "#ffd56a"));
}

function createFxMarkup(doc, visual) {
  const node = doc.createElement("div");
  node.innerHTML = `<div class="buxa-celebration-field">
    <span class="buxa-celebration-glow"></span>
    <span class="buxa-celebration-ring"></span>
    <span class="buxa-celebration-ring secondary"></span>
    <span class="buxa-celebration-svg"></span>
    <span class="buxa-celebration-seal"></span>
    <span class="buxa-celebration-crosshair x"></span>
    <span class="buxa-celebration-crosshair y"></span>
  </div>
  <div class="buxa-celebration-badge">
    <span class="buxa-celebration-corner tl"></span>
    <span class="buxa-celebration-corner tr"></span>
    <span class="buxa-celebration-corner bl"></span>
    <span class="buxa-celebration-corner br"></span>
    <div class="buxa-celebration-badge-top">
      <span class="buxa-celebration-emblem"></span>
      <span class="buxa-celebration-label"></span>
    </div>
    <strong class="buxa-celebration-number"></strong>
    <span class="buxa-celebration-sublabel"></span>
  </div>`;
  const field = node.querySelector(".buxa-celebration-field");
  for (let i = 0; i < 12; i++) {
    const spark = doc.createElement("i");
    spark.className = "buxa-celebration-spark";
    spark.style.setProperty("--buxa-spark-index", String(i));
    field.appendChild(spark);
  }
  applyVisualToNode(node, visual);
  return node;
}

/** Return true only if a real SVG effect was installed into the page. */
export function playSceneSvgProgression(token, visual, {
  canvasRef = globalThis.canvas,
  documentRef = globalThis.document,
  reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true
} = {}) {
  if (!canvasRef?.ready || !documentRef?.body?.appendChild || !documentRef.createElement) return false;
  const position = sceneTokenScreenPosition(canvasRef, token);
  if (!position || (token?.document?.parent?.id && canvasRef.scene?.id
    && token.document.parent.id !== canvasRef.scene.id)) return false;
  const key = effectKey(token, visual);
  const duration = reducedMotion ? 800 : Math.max(1200, Math.min(4000, Number(visual.duration) || 2200));
  const active = activeEffects.get(key);
  if (active && active.node?.isConnected && active.disposed !== true) {
    applyVisualToNode(active.node, visual);
    active.node.classList?.add?.("is-updated");
    active.refresh(duration, position);
    return true;
  }

  const node = createFxMarkup(documentRef, visual);
  let disposed = false;
  let frameId;
  let timer;
  const raf = globalThis.requestAnimationFrame;
  const cancelRaf = globalThis.cancelAnimationFrame;

  function cleanup() {
    if (disposed) return;
    disposed = true;
    if (frameId !== undefined && typeof cancelRaf === "function") cancelRaf(frameId);
    if (timer !== undefined) globalThis.clearTimeout?.(timer);
    node.remove?.();
    running.delete(cleanup);
    if (activeEffects.get(key)?.cleanup === cleanup) activeEffects.delete(key);
  }

  function scheduleCleanup(nextDuration = duration) {
    if (timer !== undefined) globalThis.clearTimeout?.(timer);
    timer = globalThis.setTimeout?.(cleanup, nextDuration + 100);
  }

  let previousPosition = null;
  function setPosition(p) {
    if (previousPosition && p.x===previousPosition.x && p.y===previousPosition.y &&
        p.halfHeight===previousPosition.halfHeight && p.span===previousPosition.span) return;
    previousPosition = p;
    node.style.left = `${p.x}px`;
    node.style.top = `${p.y}px`;
    node.style.setProperty("--buxa-token-half-height", `${p.halfHeight}px`);
    node.style.setProperty("--buxa-fx-span", `${p.span}px`);
    node.style.setProperty("--buxa-fx-spark-travel", `${Math.round(p.span * .6)}px`);
  }

  function updateLocation() {
    if (disposed) return;
    if (token?.destroyed || !canvasRef?.ready || !node.isConnected
      || (token?.document?.parent?.id && canvasRef.scene?.id && token.document.parent.id !== canvasRef.scene.id)) {
      cleanup(); return;
    }
    const p = sceneTokenScreenPosition(canvasRef, token);
    if (!p) { cleanup(); return; }
    setPosition(p);
    if (typeof raf === "function") frameId = raf(updateLocation);
  }

  try {
    documentRef.body.appendChild(node);
    setPosition(position);
    running.add(cleanup);
    activeEffects.set(key, {
      node,
      cleanup,
      refresh(nextDuration = duration, nextPosition = null) {
        if (disposed) return;
        if (nextPosition) setPosition(nextPosition);
        scheduleCleanup(nextDuration);
      },
      get disposed() { return disposed; }
    });
    updateLocation();
    scheduleCleanup(duration);
    return !disposed;
  } catch (error) {
    cleanup();
    console.warn("buxaframework | SVG scene effect could not be rendered.", error);
    return false;
  }
}
