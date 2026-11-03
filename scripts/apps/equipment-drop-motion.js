/** Ghost-to-slot flight survives Foundry replacing the sheet's contents.
 * Item writes and collision checks never depend on animation completion. */
import { motionAllowed, EQUIP_MS } from './inventory-drag-motion.js';

const pending = new WeakMap();
const HIDDEN = 'buxa-equip-motion-hidden';

/** Freeze rendered artwork, including saved per-slot transforms and stacks.
 * No item IDs or event handlers are carried into the presentation overlay. */
function snapshot(node) {
  const copy = node.cloneNode(true);
  const view = node.ownerDocument.defaultView;
  const sourceNodes = [node, ...node.querySelectorAll('*')];
  const copyNodes = [copy, ...copy.querySelectorAll('*')];
  for (let i = 0; i < sourceNodes.length; i++) {
    const target = copyNodes[i], style = view.getComputedStyle(sourceNodes[i]);
    for (const key of style) target.style.setProperty(key, style.getPropertyValue(key), 'important');
    for (const attribute of [...target.attributes]) {
      if (attribute.name === 'id' || attribute.name.startsWith('data-')) target.removeAttribute(attribute.name);
    }
    target.classList.remove(HIDDEN, 'is-dragging', 'is-invalid', 'is-merge-hover');
    target.style.setProperty('animation', 'none', 'important');
    target.style.setProperty('transition', 'none', 'important');
    target.style.setProperty('pointer-events', 'none', 'important');
  }
  for (const [key, value] of Object.entries({position:'absolute',left:'0px',top:'0px',right:'auto',bottom:'auto',margin:'0',transform:'none',visibility:'visible',opacity:'1'})) {
    copy.style.setProperty(key, value, 'important');
  }
  copy.setAttribute('aria-hidden', 'true');
  return copy;
}

function frame(doc, rect) {
  const node = doc.createElement('div');
  node.className = 'buxa-equipment-flight';
  node.setAttribute('aria-hidden', 'true');
  Object.assign(node.style, {width:`${rect.width}px`,height:`${rect.height}px`,transform:`translate(${rect.left}px, ${rect.top}px)`});
  return node;
}

/** Preserve aspect ratio throughout the flight instead of stretching a 1x3
 * weapon into a 1x1 slot. Blend the two original artwork snapshots. */
export function equipmentFlightFrames(from,to) {
  const valid=r=>r && [r.left,r.top,r.width,r.height].every(Number.isFinite) && r.width>0 && r.height>0;
  if (!valid(from)||!valid(to)) return null;
  const center=r=>({x:r.left+r.width/2,y:r.top+r.height/2});
  const a=center(from),b=center(to);
  const toScale=Math.min(to.width/from.width,to.height/from.height,1.6);
  const fromScale=Math.min(from.width/to.width,from.height/to.height,1.6);
  const translate=(middle,rect,scale)=>`translate(${middle.x-rect.width*scale/2}px, ${middle.y-rect.height*scale/2}px) scale(${scale})`;
  return {
    source:[{transform:translate(a,from,1),opacity:1},{transform:translate(b,from,toScale),opacity:0}],
    arrival:[{transform:translate(a,to,fromScale),opacity:0},{transform:translate(b,to,1),opacity:1}]
  };
}

function visibleRect(node) {
  if (!node?.isConnected || node.closest('[hidden]')) return null;
  const rect = node.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 ? rect : null;
}

export function prepareEquipmentDropMotion(sheet, itemId, destination, ghost, target) {
  if (destination?.area !== 'equipment' || !motionAllowed(ghost)) return null;
  const slot = target?.closest?.('[data-equipment-slot]');
  const from = visibleRect(ghost);
  if (!from || !visibleRect(slot)) return null;
  const inventory = sheet.actor?.getFlag?.('buxaframework', 'inventory');
  const position = Number(destination.position ?? inventory?.equipmentActive?.[destination.slotId] ?? 0);
  // Inactive loadout positions have no visible destination artwork.
  if (position !== Number(inventory?.equipmentActive?.[destination.slotId] ?? 0)) return null;
  const old = inventory?.placements?.[itemId];
  if (old?.area === 'equipment' && old.slotId === destination.slotId && Number(old.position ?? 0) === position) return null;
  const doc = ghost.ownerDocument, view = doc.defaultView;
  const entries = pending.get(sheet) || new Map();
  pending.set(sheet, entries);
  entries.get(itemId)?.cancel();
  const source = frame(doc, from);
  source.append(snapshot(ghost));
  doc.body.append(source);
  let arrived, observer, timeout, committed = false, flying = false, disposed = false;
  const hidden = new Set(), animations = [];
  const cancel = () => {
    if (disposed) return;
    disposed = true;
    observer?.disconnect(); view.clearTimeout(timeout);
    view.removeEventListener('blur', cancel);
    view.removeEventListener('pagehide', cancel);
    view.removeEventListener('resize', cancel);
    view.removeEventListener('scroll', cancel, true);
    for (const animation of animations) animation.cancel();
    source.remove(); arrived?.remove();
    for (const node of hidden) node.classList.remove(HIDDEN);
    if (entries.get(itemId) === motion) entries.delete(itemId);
  };
  const sync = () => {
    if (disposed) return;
    if (!sheet.element?.isConnected) { cancel(); return; }
    if (committed) {
      const saved = sheet.actor?.getFlag?.('buxaframework', 'inventory')?.placements?.[itemId];
      if (saved?.area !== 'equipment' || saved.slotId !== destination.slotId || Number(saved.position ?? 0) !== position) { cancel(); return; }
    }
    const items = [...sheet.element.querySelectorAll('[data-item-id]')].filter(node => node.dataset.itemId === itemId);
    let equipped;
    for (const node of items) {
      if (node.closest('[data-equipment-slot]')?.dataset.equipmentSlot === destination.slotId) equipped = node;
      node.classList.add(HIDDEN); hidden.add(node);
    }
    if (!committed || flying || !equipped) return;
    const to = visibleRect(equipped);
    if (!to) { cancel(); return; }
    flying = true;
    arrived = frame(doc, to);
    equipped.classList.remove(HIDDEN);
    try { arrived.append(snapshot(equipped)); }
    finally { equipped.classList.add(HIDDEN); }
    doc.body.append(arrived);
    const frames=equipmentFlightFrames(from,to);
    if (!frames) { cancel(); return; }
    const options = {duration:EQUIP_MS,easing:'cubic-bezier(.22,.75,.25,1)',fill:'both'};
    try {
      animations.push(source.animate(frames.source,options));
      animations.push(arrived.animate(frames.arrival,options));
      Promise.all(animations.map(animation => animation.finished)).then(cancel, cancel);
    } catch { cancel(); }
  };
  const motion = {cancel, complete(changed) {
    if (disposed) return;
    const saved = sheet.actor?.getFlag?.('buxaframework', 'inventory')?.placements?.[itemId];
    if (!changed || saved?.area !== 'equipment' || saved.slotId !== destination.slotId || Number(saved.position ?? 0) !== position) { cancel(); return; }
    committed = true;
    sync();
    view.clearTimeout(timeout);
    if (!disposed) timeout = view.setTimeout(cancel, 1500);
  }};
  entries.set(itemId, motion);
  observer = new view.MutationObserver(() => { try { sync(); } catch { cancel(); } });
  observer.observe(doc.body, {childList:true,subtree:true});
  view.addEventListener('blur', cancel);
  view.addEventListener('pagehide', cancel);
  view.addEventListener('resize', cancel);
  view.addEventListener('scroll', cancel, true);
  timeout = view.setTimeout(cancel, 5000);
  sync();
  return motion;
}

export async function commitEquipmentDropMotion(motion, action) {
  try {
    const changed = await action();
    // A presentation failure cannot change the outcome of a saved item move.
    try { motion?.complete(changed); } catch { motion?.cancel(); }
    return changed;
  } catch (error) { motion?.cancel(); throw error; }
}
