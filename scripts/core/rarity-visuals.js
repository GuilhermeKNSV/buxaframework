/** Buxa's presentation vocabulary. Pure data: no documents, timers or game rules.
 * User colors and effect switches remain authoritative. Profiles provide form,
 * material and movement, including safe defaults for custom rarity IDs. */
import { rarityFlagEnabled } from './rarity-tier.js';

const profile = (id, rank, color, material, motion, beam, crest, corner, speed, spread, rays) => Object.freeze({
  id, rank, baseColor: color, ornamentStyle: crest, corner, material,
  motionProfile: motion, beamProfile: beam, tooltipProfile: material,
  hotbarProfile: material, orbProfile: crest, levelUpProfile: crest,
  rebirthProfile: beam, nameplateProfile: crest, statAccentProfile: crest,
  speed, spread, rays
});

export const RARITY_VISUALS = Object.freeze({
  junk: profile('junk', 0, '#59616d', 'ash', 'still', 'dust', 'fracture', 'M2 20V2H16M6 9V6H11', 0, .65, 0),
  common: profile('common', 1, '#9098a6', 'iron', 'still', 'shaft', 'rivet', 'M2 22V2H22M5 5H8V8H5Z', 0, .7, 0),
  uncommon: profile('uncommon', 2, '#55c86a', 'verdant', 'bloom', 'wisp', 'leaf', 'M2 22V2H22M6 18Q6 6 18 6Q16 16 6 18M6 18L16 8', .65, .8, 3),
  rare: profile('rare', 3, '#4d98f0', 'etched', 'scan', 'lattice', 'compass', 'M2 22V2H22M6 16V6H16M10 10L14 6L18 10L14 14Z', .8, .65, 4),
  epic: profile('epic', 4, '#9a68e8', 'arcane', 'orbit', 'helix', 'eclipse', 'M2 22V2H22M5 20V5H20M8 15L15 8L22 15L15 22Z', .75, 1.05, 6),
  legendary: profile('legendary', 5, '#f2ca43', 'gilded', 'ember', 'flame', 'crown', 'M2 24V2H24M5 22V5H22M7 7L11 16L16 11ZM8 8L18 18', 1, 1.2, 8),
  mythical: profile('mythical', 6, '#ffca43', 'prism', 'aurora', 'prism', 'prism', 'M2 24V2H24M5 19L19 5L24 10L10 24ZM8 8L18 18M14 2V9', .6, 1.25, 7),
  relic: profile('relic', 7, '#f060b8', 'reliquary', 'ritual', 'votive', 'seal', 'M2 24V2H24M6 22V6H22M10 18V10H18M13 4V14H4', .45, 1.1, 8),
  masterwork: profile('masterwork', 8, '#df4e56', 'forged', 'temper', 'forge', 'anvil', 'M2 24V2H24M5 24V5H24M9 18V9H18M12 12H16V16H12Z', .8, .85, 5),
  secret: profile('secret', 9, '#08090c', 'obsidian', 'veil', 'rift', 'eye', 'M2 24V2H24M6 20L20 6M5 14Q14 5 23 14Q14 23 5 14M14 11V17', .35, 1.35, 3),
  divine: profile('divine', 10, '#78ddff', 'celestial', 'dawn', 'spire', 'star', 'M2 24V2H24M6 24V6H24M8 16L16 8M12 12L12 20M12 12H20M17 3V9M3 17H9', .5, 1.3, 12),
  special: profile('special', 11, '#ff202c', 'scarlet', 'fracture', 'rupture', 'spear', 'M2 24V2H24M5 21L13 13L9 9L21 5M6 6L20 20M16 20L20 16', 1.1, 1.4, 9)
});

const CRESTS = Object.freeze({
  fracture: 'M18 32H28L32 22L36 38L40 32H46',
  rivet: 'M24 24H40V40H24ZM29 29H35V35H29Z',
  leaf: 'M18 46Q12 18 46 16Q48 42 18 46ZM18 46L40 22M27 35L26 24M27 35L39 36',
  compass: 'M32 7L39 25L57 32L39 39L32 57L25 39L7 32L25 25ZM21 21H43V43H21ZM32 25L39 32L32 39L25 32Z',
  eclipse: 'M32 6L55 19V45L32 58L9 45V19ZM32 14L48 32L32 50L16 32ZM38 22A12 12 0 1 0 38 42A16 16 0 0 1 38 22',
  crown: 'M10 22L22 30L32 10L42 30L54 22L48 43H16ZM16 48H48M23 53H41M32 23V38',
  prism: 'M32 5L52 22L45 48L32 59L19 48L12 22ZM12 22H52L32 59ZM19 48L32 5L45 48ZM22 28L42 38M42 28L22 38',
  seal: 'M32 5L42 16L55 19L51 32L55 45L42 48L32 59L22 48L9 45L13 32L9 19L22 16ZM20 20H44V44H20ZM26 26H38V38H26ZM32 10V17M10 32H17M47 32H54M32 47V54',
  anvil: 'M9 19H55L45 29H38V38L48 46V50H16V46L26 38V29H17ZM16 14H48M22 55H42M32 8V11M7 35H17M47 35H57',
  eye: 'M5 32Q32 7 59 32Q32 57 5 32ZM32 22A10 10 0 1 0 32 42A10 10 0 1 0 32 22M32 26V38M12 18L17 23M47 41L52 46M32 7V15M32 49V57',
  star: 'M32 3L37 25L61 32L37 39L32 61L27 39L3 32L27 25ZM14 14L25 20M50 14L39 20M50 50L39 44M14 50L25 44M32 17L47 32L32 47L17 32Z',
  spear: 'M32 3L46 23L38 20L38 41L51 53L32 46L13 53L26 41V20L18 23ZM9 11L21 23M43 41L55 53M55 11L43 23M21 41L9 53'
});

export function visualColor(value, fallback = '#9098a6') {
  return /^#[\da-f]{6}$/i.test(String(value)) ? String(value).toLowerCase() : fallback;
}
function mix(a, b, weight) {
  const channel = (hex, n) => parseInt(hex.slice(n, n + 2), 16);
  return '#' + [1, 3, 5].map(n => Math.round(channel(a, n) * (1 - weight) + channel(b, n) * weight).toString(16).padStart(2, '0')).join('');
}
function svgUrl(path, size) {
  return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" fill="none" stroke="white" stroke-width="1.2" stroke-linejoin="miter"><path d="${path}"/></svg>`)}")`;
}

function frameUrl(path) {
  const corners = [0, 90, 180, 270].map(angle => `<path transform="rotate(${angle} 50 50)" d="${path}"/>`).join('');
  return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none" stroke="white" stroke-width="1.2">${corners}</svg>`)}")`;
}

export function resolveRarityVisual(rarity = {}) {
  const id = String(rarity?.id || 'common').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const base = RARITY_VISUALS[id] ?? RARITY_VISUALS.common;
  const baseColor = visualColor(rarity?.color, base.baseColor);
  const glowColor = id === 'secret' ? mix(baseColor, '#b4add2', .77) : mix(baseColor, '#eff7ff', .18);
  return {
    ...base, id, label: String(rarity?.label || id.toUpperCase()), baseColor, glowColor,
    deepColor: mix(baseColor, '#090c12', .87), textColor: mix(glowColor, '#f4f0e8', .48),
    motion: rarityFlagEnabled(rarity?.animated), glint: rarityFlagEnabled(rarity?.glint),
    ornament: rarityFlagEnabled(rarity?.ornament), spectrum: rarityFlagEnabled(rarity?.spectrum),
    crestMask: svgUrl(CRESTS[base.ornamentStyle], 64), cornerMask: svgUrl(base.corner, 28)
  };
}

export function rarityVisualPresentation(rarity) {
  const t = resolveRarityVisual(rarity);
  const vars = {
    'rv-base': t.baseColor, 'rv-light': t.glowColor, 'rv-deep': t.deepColor, 'rv-text': t.textColor,
    'rv-crest': t.crestMask, 'rv-corner': t.cornerMask, 'rv-frame': frameUrl(t.corner), 'rv-rank': t.rank,
    'rv-motion': `buxa-rv-${t.motionProfile}`, 'rv-period': `${t.speed ? 5 / t.speed : 10}s`,
    'rv-motion-state': t.motion ? 'running' : 'paused', 'rv-ornament': t.ornament ? 1 : 0,
    'rv-beam-spread': t.spread, 'rv-frame-width': t.rank >= 5 ? '3px' : '1px'
  };
  return { className: `buxa-visual buxa-material-${t.material} buxa-motion-${t.motionProfile} buxa-beam-${t.beamProfile}`,
    style: Object.entries(vars).map(([key, value]) => `--${key}:${value}`).join(';'), theme: t };
}

/** Apply properties individually: preserves position, resource fill and size. */
export function applyRarityVisual(element, rarity) {
  const view = rarityVisualPresentation(rarity);
  element.className += ` ${view.className}`;
  for (const declaration of view.style.split(';')) {
    const colon = declaration.indexOf(':');
    element.style?.setProperty?.(declaration.slice(0, colon), declaration.slice(colon + 1));
  }
  return view.theme;
}
