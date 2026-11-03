/** Optional per-equipment-size artwork transforms. No changes to item footprints. */
import { INVENTORY_SIZE_PATTERNS } from './inventory-config.js';
const clamp = (value, fallback, min, max) => {
  if (value == null || typeof value === 'boolean' || !['string','number'].includes(typeof value) ||
      (typeof value === 'string' && !value.trim())) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
export function normalizeItemEquipArtwork(input) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  return Object.fromEntries(INVENTORY_SIZE_PATTERNS.map(({id}) => {
    const raw = source[id] && typeof source[id] === 'object' ? source[id] : {};
    return [id, {
      x: Math.round(clamp(raw.x, 0, -180, 180)),
      y: Math.round(clamp(raw.y, 0, -180, 180)),
      zoom: Math.round(clamp(raw.zoom, 1, .25, 4)*100)/100,
      rotation: Math.round(clamp(raw.rotation, 0, -360, 360))
    }];
  }));
}
export function equipmentArtworkTransform(entry) {
  const art=normalizeItemEquipArtwork({small:entry}).small;
  return `translate(${art.x}px,${art.y}px) rotate(${art.rotation}deg) scale(${art.zoom})`;
}
