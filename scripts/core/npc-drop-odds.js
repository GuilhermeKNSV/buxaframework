/** Editor-only adapters for NPC quantity odds. The stored string remains the
 * legacy `quantity:weight` format consumed by quantityOptions/rollNpcDrops. */
import { quantityOptions } from './npc-dropping.js';

const clampInteger = (value, fallback = 0, min = 0, max = 100) => {
  if (value == null || String(value).trim() === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
};

export function quantityOddsDraft(entry) {
  // Editable draft remains available even while runtime weights are disabled.
  const options = quantityOptions({...entry, weightsEnabled:true});
  const maximum = Math.max(1, ...options.map(option => option.weight));
  const divisor = maximum > 100 ? maximum / 100 : 1;
  const even = !String(entry?.weights || '').trim();
  return new Map(options.map(option => [option.quantity, even ? 50 : clampInteger(option.weight / divisor)]));
}

export function quantityOddsRows(draft, min, max) {
  const lower = clampInteger(min, 1, 1, 100);
  const upper = clampInteger(max, lower, lower, 100);
  const rows = Array.from({length: upper - lower + 1}, (_, i) => {
    const quantity = lower + i;
    return {quantity, weight: clampInteger(draft.get(quantity), 50)};
  });
  const total = rows.reduce((sum, row) => sum + row.weight, 0);
  return rows.map(row => ({...row, percent: total ? Math.round(row.weight * 1000 / total) / 10 : 0}));
}

export function setQuantityOddsPreset(draft, min, max, preset) {
  const lower = clampInteger(min, 1, 1, 100);
  const upper = clampInteger(max, lower, lower, 100);
  for (let quantity = lower; quantity <= upper; quantity++) {
    const index = quantity - lower;
    const opposite = upper - quantity;
    const weight = preset === 'lower' ? Math.max(1, Math.round(100 * (.6 ** index)))
      : preset === 'higher' ? Math.max(1, Math.round(100 * (.6 ** opposite)))
      : preset === 'minimum' ? (quantity === lower ? 100 : 0) : 50;
    draft.set(quantity, weight);
  }
  return draft;
}

export function serializeQuantityOdds(draft, min, max) {
  const rows = quantityOddsRows(draft, min, max);
  if (!rows.some(row => row.weight > 0)) return null;
  if (rows.every(row => row.weight === rows[0].weight)) return '';
  return rows.map(row => `${row.quantity}:${row.weight}`).join(',');
}
