/** Parse optional Foundry form values without treating blank inputs and booleans as zero.
 * Explicit numeric zero stays valid where the field allows it. */
export function numericField(value, fallback, min = -Infinity, max = Infinity, round = false) {
  if (value == null || typeof value === 'boolean' ||
      (typeof value !== 'number' && typeof value !== 'string') ||
      (typeof value === 'string' && !value.trim())) return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  const bounded = Math.max(min, Math.min(max, number));
  return round ? Math.round(bounded) : bounded;
}
export function safeGridIndex(value, max = Infinity) {
  if (value == null || typeof value === 'boolean' ||
      (typeof value !== 'number' && typeof value !== 'string') ||
      (typeof value === 'string' && !value.trim())) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 && number < max ? number : null;
}

/** Persisted checkbox values may originate in plain JSON or Foundry form data.
 * The strings 'false' and '0' must never activate a disabled rule. */
export function booleanField(value, fallback = false) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1 ? true : value === 0 ? false : fallback;
  if (typeof value === 'string') {
    const clean = value.trim().toLowerCase();
    if (['true', '1', 'on', 'yes'].includes(clean)) return true;
    if (['false', '0', 'off', 'no'].includes(clean)) return false;
  }
  return fallback;
}
