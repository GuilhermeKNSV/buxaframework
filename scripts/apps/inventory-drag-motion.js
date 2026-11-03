/** Presentation only: the outer ghost follows the pointer without easing.
 * A separate inner surface rotates the already-validated final footprint. */
import { applyDragRarityFeedback } from './inventory-rarity-hover.js';

const rotations = new WeakMap();
export const ROTATION_MS = 180;
export const EQUIP_MS = 300;
export function motionAllowed(node) {
  return Boolean(node?.animate && !node.ownerDocument?.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

export function makeDragGhost(element, root, pointerX, pointerY) {
  const inventoryCell = root?.querySelector?.('[data-inventory-index]')?.getBoundingClientRect?.();
  const sourceRect = element.getBoundingClientRect();
  const size = inventoryCell
    ? Math.max(28, Math.min(inventoryCell.width, inventoryCell.height))
    : Math.max(28, Math.min(sourceRect.width, sourceRect.height, 64));
  const doc = element.ownerDocument;
  const ghost = doc.createElement('div');
  ghost.className = 'buxa-inventory-drag-ghost';
  const composite = element.querySelector('.buxa-stack-composite');
  const artwork = element.querySelector('img');
  if (composite) ghost.append(composite.cloneNode(true));
  else if (artwork) {
    const image = doc.createElement('img');
    image.src = artwork.currentSrc || artwork.src;
    image.alt = ''; image.draggable = false;
    ghost.append(image);
  }
  Object.assign(ghost.style, {
    position: 'fixed', left: '0px', top: '0px', right: 'auto', bottom: 'auto',
    transform: `translate3d(${pointerX - size / 2}px, ${pointerY - size / 2}px, 0)`,
    width: `${size}px`, height: `${size}px`, margin: '0',
    pointerEvents: 'none', zIndex: '100000'
  });
  applyDragRarityFeedback(ghost, element, doc.defaultView);
  doc.body.appendChild(ghost);
  return { ghost, offsetX: size / 2, offsetY: size / 2 };
}

export function cancelGhostRotation(ghost) {
  const running = rotations.get(ghost);
  if (!running) return;
  rotations.delete(ghost);
  ghost.classList.remove('is-rotating-ghost');
  try { running.animation.cancel(); } catch { /* Removed documents can cancel their own animations. */ }
  if (running.surface.parentNode === ghost) ghost.replaceChildren(...running.surface.childNodes);
}

/** Inverse quarter-turn maps the new rectangle onto the previous rectangle.
 * Preserves the actual on-screen pose when another R arrives mid-animation. */
export function rotationStart(before, after, pose = {a:1,b:0,c:0,d:1,e:0,f:0}, angle = 0) {
  return {
    x: before.left - after.left + pose.c * before.height + pose.e,
    y: before.top - after.top + pose.d * before.height + pose.f,
    angle: angle - 90,
    scaleX: Math.hypot(pose.c, pose.d) * before.height / after.width,
    scaleY: Math.hypot(pose.a, pose.b) * before.width / after.height
  };
}

/** Recover actual transform winding from a sampled matrix. The animation's
 * linear progress is not its eased angle, so previousAngle*(1-progress)
 * cannot be used as the visible rotation during rapid key presses. */
export function unwrapRotationAngle(matrix, expected=0) {
  const visible=Math.atan2(matrix?.b||0,matrix?.a||1)*180/Math.PI;
  if (!Number.isFinite(visible)) return Number.isFinite(expected)?expected:0;
  return visible+360*Math.round(((Number.isFinite(expected)?expected:0)-visible)/360);
}

export function animateGhostRotation(ghost, repaint) {
  if (!ghost || !motionAllowed(ghost) || !ghost.classList.contains('is-complex-ghost')) {
    repaint(); return;
  }
  const before = ghost.getBoundingClientRect();
  const view = ghost.ownerDocument.defaultView;
  const previous = rotations.get(ghost);
  let pose, angle = 0;
  if (previous?.surface.parentNode === ghost) {
    try {
      pose = new view.DOMMatrix(view.getComputedStyle(previous.surface).transform);
      const progress=previous.animation.effect?.getComputedTiming?.().progress ?? 1;
      angle=unwrapRotationAngle(pose, previous.angle*(1-progress));
    } catch { /* Some webviews don't expose DOMMatrix on live animations. */ }
  }
  cancelGhostRotation(ghost);
  repaint();
  if (!ghost.isConnected || !ghost.classList.contains('is-complex-ghost') || ghost.classList.contains('is-equipment-ghost')) return;
  const after = ghost.getBoundingClientRect();
  if (!(before.width > 0 && before.height > 0 && after.width > 0 && after.height > 0)) return;
  const start = rotationStart(before, after, pose, angle);
  if (!Object.values(start).every(Number.isFinite)) return;
  const surface = ghost.ownerDocument.createElement('div');
  surface.className = `${ghost.className} buxa-drag-rotation-surface`;
  // Retain rarity variables and the same direct-child artwork selectors.
  surface.style.cssText = ghost.style.cssText;
  for (const [key, value] of Object.entries({position:'absolute',left:'0px',top:'0px',width:'100%',height:'100%',transform:'none',transformOrigin:'0 0',opacity:'1',filter:'none',visibility:'visible'})) {
    surface.style.setProperty(key.replace(/[A-Z]/g, s => `-${s.toLowerCase()}`), value, 'important');
  }
  // A normal declaration lets WAAPI own this one transform.
  surface.style.removeProperty('transform');
  surface.append(...ghost.childNodes);
  ghost.append(surface);
  ghost.classList.add('is-rotating-ghost');
  let animation;
  try { animation = surface.animate([
    {transform:`translate(${start.x}px, ${start.y}px) rotate(${start.angle}deg) scale(${start.scaleX}, ${start.scaleY})`},
    {transform:'translate(0px, 0px) rotate(0deg) scale(1, 1)'}
  ], {duration:ROTATION_MS, easing:'cubic-bezier(.2,.8,.25,1)', fill:'both'}); }
  catch { ghost.classList.remove('is-rotating-ghost'); ghost.replaceChildren(...surface.childNodes); return; }
  const state = {surface, animation, angle:start.angle};
  rotations.set(ghost, state);
  animation.finished.then(() => {
    if (rotations.get(ghost) === state) cancelGhostRotation(ghost);
  }, () => {});
}
