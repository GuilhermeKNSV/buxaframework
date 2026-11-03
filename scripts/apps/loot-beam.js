import { applyRarityVisual } from '../core/rarity-visuals.js';
/** ARPG-style loot beam: a tapered light pillar with rising energy pulses, a
 * ground bloom, expanding ripples, god-rays and drifting embers. Everything is
 * compositor-friendly CSS (transform/opacity only). Intensity scales with the
 * rarity tier. Screen-space and temporary: never touches scene documents. */
import { rarityTier, rarityFlagEnabled } from '../core/rarity-tier.js';

const SIZES = [
  { h: 120, w: 12, embers: 3 }, { h: 170, w: 16, embers: 6 }, { h: 225, w: 20, embers: 9 },
  { h: 285, w: 24, embers: 13 }, { h: 350, w: 28, embers: 18 }
];
export const LOOT_COLLECT_MS = 520;

export function lootBeamSpec(rarity) {
  const tier = rarityTier(rarity);
  const rarityId=String(rarity?.id||'common').trim().toLowerCase().replace(/[^a-z0-9_-]/g,'-') || 'common';
  return { tier, rarityId, ...SIZES[tier], spectrum: rarityFlagEnabled(rarity?.spectrum) };
}

function emberMarkup(count) {
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  let html = '';
  for (let i = 0; i < count; i++) {
    const x = Math.round((rnd() - .5) * 26), dx = Math.round((rnd() - .5) * 38);
    const t = (1.5 + rnd() * 1.6).toFixed(2), d = (-rnd() * 3).toFixed(2), s = (1.6 + rnd() * 2.4).toFixed(1);
    html += `<b style="--x:${x}px;--dx:${dx}px;--t:${t}s;--d:${d}s;--s:${s}px"></b>`;
  }
  return html;
}

export function lootBeamMarkup(spec) {
  return '<i class="buxa-loot-beam-flash"></i><i class="buxa-loot-beam-bloom"></i><i class="buxa-loot-beam-ring"></i>'
    + '<i class="buxa-loot-beam-ripple"></i><i class="buxa-loot-beam-ripple is-late"></i>'
    + '<i class="buxa-loot-beam-aura"></i><i class="buxa-loot-beam-rays"></i><i class="buxa-loot-beam-column"></i>'
    + '<i class="buxa-loot-beam-core"></i><i class="buxa-loot-beam-sigil"></i>'
    + `<span class="buxa-loot-beam-embers">${emberMarkup(spec.embers)}</span>`;
}

export function createLootBeam(doc, { rarity, accent }) {
  const spec = lootBeamSpec(rarity);
  const beam = doc.createElement('div');
  beam.className = 'buxa-scene-loot-beam';
  const theme = applyRarityVisual(beam, rarity);
  beam.setAttribute('aria-hidden', 'true');
  const opacity=Number(rarity?.beamOpacity ?? 100);
  beam.style.opacity=String(Number.isFinite(opacity)?Math.min(1,Math.max(0,opacity/100)):1);
  beam.setAttribute('data-tier', String(spec.tier));
  beam.setAttribute('data-rarity', spec.rarityId);
  if (spec.spectrum) beam.setAttribute('data-spectrum', '');
  beam.style.setProperty('--loot-accent', /^#[0-9a-f]{6}$/i.test(String(accent)) ? accent : theme.glowColor);
  beam.style.setProperty('--beam-h', `min(${spec.h}px,52vh)`);
  beam.style.setProperty('--beam-w', `${spec.w}px`);
  beam.innerHTML = lootBeamMarkup(spec);
  return beam;
}

/** Keeps the beam planted on the item's on-screen base. Only writes when the
 * rounded anchor changes. Returns a stop function. */
export function trackLootBeam(beam, getAnchor) {
  const raf = globalThis.requestAnimationFrame, caf = globalThis.cancelAnimationFrame;
  let frame = 0, stopped = false, lastX = NaN, lastY = NaN;
  const place = () => {
    let p;
    try { p = getAnchor?.(); } catch { return; }
    if (!p || !Number.isFinite(Number(p.x)) || !Number.isFinite(Number(p.y)) || p.x == null || p.y == null) return;
    const x = Math.round(Number(p.x)), y = Math.round(Number(p.y));
    if (x === lastX && y === lastY) return;
    lastX = x; lastY = y;
    beam.style.left = `${x}px`; beam.style.top = `${y}px`;
  };
  const loop = () => { frame = 0; if (stopped) return; place(); if (typeof raf === 'function') frame = raf(loop); };
  place();
  if (typeof raf === 'function') frame = raf(loop);
  return () => { stopped = true; if (frame && typeof caf === 'function') caf(frame); frame = 0; };
}

export function collectLootBeam(beam) { beam?.classList?.add('is-collected'); }
