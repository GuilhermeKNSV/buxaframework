/** Do not silently truncate imported Item rules when an editor saves.
 * These limits match the existing normalizers. Any old oversized document
 * must be repaired/exported first, rather than losing its tail on save. */
const limits = Object.freeze([
  { path: ['dice'], max: 40, label: 'dice rules' },
  { path: ['decorations'], max: 40, label: 'tooltip decorations' },
  { path: ['increases'], max: 60, label: 'Increase effects' },
  { path: ['resourceEffects'], max: 32, label: 'resource effects' },
  { path: ['storage', 'slots', 'external'], max: 12, label: 'storage compartments' }
]);

export function validateItemRuleCapacity(rules) {
  if (!rules || typeof rules !== 'object') return true;
  for (const {path, max, label} of limits) {
    const entries = path.reduce((value, key) => value?.[key], rules);
    if (Array.isArray(entries) && entries.length > max)
      throw new RangeError(`Item has ${entries.length} ${label}, but the editor supports ${max}. No changes were saved to avoid discarding imported data. Export or repair the oversized rules first.`);
  }
  return true;
}
