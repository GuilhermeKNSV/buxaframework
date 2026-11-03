/** Animated visual guide for dragging Buxa Actor cards onto the Foundry canvas.
 * Never creates Tokens itself: native Foundry drop handling remains authoritative.
 * Only transforms the preview while dragging; no Pixi redraws or document writes.
 */

const finite = value => Number.isFinite(Number(value)) && Number(value) > 0;

export function tokenFootprint(actor, canvasRef) {
  const size = Number(canvasRef?.dimensions?.size) || 100;
  const prototype = actor?.prototypeToken;
  const unitsX = finite(prototype?.width) ? Number(prototype.width) : 1;
  const unitsY = finite(prototype?.height) ? Number(prototype.height) : 1;
  return { width: size * unitsX, height: size * unitsY };
}

/** Use Foundry V14's token-position algorithm where available: it accounts for
 * token footprint, grid type, and the same snapping behavior used at drop time.
 */
export function actorGhostPlacement(actor, canvasRef, client, { snap = true } = {}) {
  if (!canvasRef?.ready || !actor?.prototypeToken) return null;
  const world = canvasRef.canvasCoordinatesFromClient?.(client);
  if (!Number.isFinite(world?.x) || !Number.isFinite(world?.y)) return null;
  const dimensions = tokenFootprint(actor, canvasRef);
  const unsnapped = { x: world.x - dimensions.width / 2, y: world.y - dimensions.height / 2 };
  let position = null;
  // Foundry grids with type 0 (Gridless) must never snap, including the
  // actor ghost. Native token dropping already respects that scene setting.
  const gridType = canvasRef?.scene?.grid?.type ?? canvasRef?.grid?.type;
  if (snap && !(gridType != null && Number(gridType) === 0)) {
    try {
      const tokenClass = globalThis.CONFIG?.Token?.objectClass || globalThis.foundry?.canvas?.placeables?.Token;
      const result = tokenClass?._getDropActorPosition?.(actor.prototypeToken, world, {snap:true});
      if (Number.isFinite(result?.x) && Number.isFinite(result?.y)) position = result;
    } catch { /* Fall back to layer snapping when token internals differ. */ }
    if (!position) {
      try {
        const result = canvasRef.tokens?.getSnappedPoint?.(unsnapped);
        if (Number.isFinite(result?.x) && Number.isFinite(result?.y)) position = result;
      } catch { /* Gridless canvas and custom token layers are supported. */ }
    }
  }
  position ??= unsnapped;
  const topLeft = canvasRef.clientCoordinatesFromCanvas?.(position);
  const bottomRight = canvasRef.clientCoordinatesFromCanvas?.({x:position.x + dimensions.width, y:position.y + dimensions.height});
  if (!topLeft || !bottomRight) return null;
  const width = Math.abs(bottomRight.x - topLeft.x);
  const height = Math.abs(bottomRight.y - topLeft.y);
  if (![topLeft.x, topLeft.y, width, height].every(Number.isFinite) || width < 1 || height < 1) return null;
  return {x:topLeft.x, y:topLeft.y, width, height};
}

export function isCanvasDropTarget(event, board) {
  if (!board || !event?.target) return false;
  return event.target === board || board.contains?.(event.target) === true;
}

export class ActorTokenGhost {
  constructor({ documentRef = globalThis.document, canvasProvider = () => globalThis.canvas } = {}) {
    this.document = documentRef;
    this.canvasProvider = canvasProvider;
    this.actor = null;
    this.element = null;
    this.pending = null;
    this.frame = 0;
    this.bound = false;
    this.lastGeometry = "";
    this.board = null;
    this.dragImage = null;
    this.origin = null;
  }
  install() {
    if (this.bound || !this.document) return;
    this.bound = true;
    this.document.addEventListener("dragover", event => this.over(event), true);
    this.document.addEventListener("dragleave", event => this.leave(event), true);
    this.document.addEventListener("drop", event => this.drop(event), true);
    this.document.addEventListener("dragend", () => this.cancel(), true);
    this.document.addEventListener("keydown", event => { if (event.key === "Escape") this.cancel(); }, true);
    globalThis.addEventListener?.("blur", () => this.cancel());
  }
  start(actor, dragEvent) {
    if (!actor || !dragEvent?.dataTransfer || !this.document) return false;
    this.cancel();
    this.actor = actor;
    this.origin = null;
    this.board = this.document.getElementById?.("board") || this.document.querySelector?.("#board") || null;
    // Hide the browser's *second* drag image. The animated on-canvas ghost
    // is the only item preview; the normal cursor remains visible elsewhere.
    try {
      if (!this.dragImage) {
        this.dragImage = this.document.createElement("canvas");
        this.dragImage.width = this.dragImage.height = 1;
        this.dragImage.style.cssText = "position:fixed;left:-100px;top:-100px;pointer-events:none";
        this.document.body?.append(this.dragImage);
      }
      dragEvent.dataTransfer.setDragImage?.(this.dragImage, 0, 0);
    } catch { /* Native dragging continues if an engine rejects the image. */ }
    return true;
  }
  makeElement() {
    if (!this.actor || this.element || !this.document?.body) return;
    const el = this.document.createElement("div");
    el.className = "buxa-actor-token-ghost";
    el.setAttribute("aria-hidden", "true");
    const ruler = this.document.createElement('span');
    ruler.className = 'buxa-actor-distance-line';
    const label = this.document.createElement('span');
    label.className = 'buxa-actor-distance-label';
    label.textContent = '0 ft';
    el.append(ruler);
    el.append(label);
    this.document.body.append(el);
    this.element = el;
  }
  over(event) {
    if (!this.actor) return;
    const board = this.board?.isConnected ? this.board : this.document?.getElementById?.("board");
    this.board = board;
    if (!isCanvasDropTarget(event, board) || !this.canvasProvider()?.ready) {
      this.element?.classList.remove("is-visible");
      return;
    }
    // Necessary for HTML5 drop. Do not stop propagation: Foundry receives the
    // original Actor drag payload and creates the actual Token on release.
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    this.pending = { x:event.clientX, y:event.clientY, shiftKey:event.shiftKey };
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => { this.frame = 0; this.render(); });
  }
  render() {
    if (!this.actor || !this.pending) return;
    const rect = actorGhostPlacement(this.actor, this.canvasProvider(),this.pending,{snap:!this.pending.shiftKey});
    if (!rect) { this.element?.classList.remove("is-visible"); return; }
    this.makeElement();
    if (!this.element) return;
    // Show a distance ruler only, never a duplicate token image or yellow frame.
    const canvasRef=this.canvasProvider();
    const world=canvasRef?.canvasCoordinatesFromClient?.(this.pending);
    if (!this.origin && world && Number.isFinite(world.x) && Number.isFinite(world.y))
      this.origin = {x:world.x,y:world.y};
    const start=this.origin && canvasRef?.clientCoordinatesFromCanvas?.(this.origin);
    const cx=rect.x+rect.width/2, cy=rect.y+rect.height/2;
    const dx=cx-(start?.x??cx), dy=cy-(start?.y??cy);
    const length=Math.hypot(dx,dy), degrees=Math.atan2(dy,dx)*180/Math.PI;
    this.element.style.width='0px'; this.element.style.height='0px';
    this.element.style.transform=`translate3d(${cx}px, ${cy}px, 0)`;
    const line=(this.element.querySelector?.('.buxa-actor-distance-line') || this.element.children?.[0]);
    if(line){ line.style.width=`${length}px`; line.style.transform=`rotate(${degrees+180}deg)`; }
    const distancePerGrid=Number(canvasRef?.scene?.grid?.distance||5);
    const grid=Number(canvasRef?.dimensions?.size||100);
    const worldFrom=canvasRef?.canvasCoordinatesFromClient?.({x:cx,y:cy});
    const distance=worldFrom && this.origin ? Math.hypot(worldFrom.x-this.origin.x,worldFrom.y-this.origin.y)/grid*distancePerGrid : 0;
    const label=(this.element.querySelector?.('.buxa-actor-distance-label') || this.element.children?.[1]);
    if(label) label.textContent=`${Math.round(distance*10)/10} ft`;
    this.element.classList.add("is-visible");
  }
  leave(event) {
    if (!this.actor || !this.element) return;
    const board = this.board;
    if (isCanvasDropTarget(event,board) && !isCanvasDropTarget({target:event.relatedTarget},board)) {
      this.element.classList.remove("is-visible");
    }
  }
  drop(event) {
    if (!this.actor) return;
    const onBoard = isCanvasDropTarget(event, this.board);
    if (onBoard && this.frame) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
      this.pending = {x:event.clientX, y:event.clientY, shiftKey:event.shiftKey};
      this.render();
    }
    if (onBoard && this.element?.classList.contains("is-visible")) {
      // A short visual release, not a promise that native Foundry creation
      // succeeded. The underlying drop event is deliberately untouched.
      const landing = this.element;
      this.element = null;
      landing.classList.add("is-landing");
      landing.addEventListener("animationend", () => landing.remove(), {once:true});
      setTimeout(() => landing.remove(), 350);
    }
    this.cancel();
  }
  cancel() {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0; this.pending = null; this.actor = null; this.origin = null; this.lastGeometry = "";
    this.element?.remove(); this.element = null;
    this.board = null;
  }
}

const ghost = new ActorTokenGhost();
export const installActorTokenGhost = () => ghost.install();
export const beginActorTokenDrag = (actor, event) => ghost.start(actor,event);
export const endActorTokenDrag = () => ghost.cancel();
