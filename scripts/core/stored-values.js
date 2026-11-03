import { numericField } from './numeric-field.js';
/** Shared persisted primitive readers for Actor documents and world settings. */
/** Reject empty, boolean and non-finite persisted form values. Zero itself is
 * a valid stored value and must not be replaced by the configured default.
 */
export function savedNumber(value, fallback = 0) {
  return numericField(value, fallback);
}
export function savedInteger(value, fallback = 0) {
  return Math.round(savedNumber(value, fallback));
}

/** FormData and older module versions may persist toggles as text. Never
 * interpret the string "false" as enabled or "true" as disabled. */
export function savedBoolean(value, fallback = false) {
  if (value === true || value === false) return value;
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'number') return Number.isFinite(value) ? value !== 0 : fallback;
  if (typeof value === 'string') {
    const text=value.trim().toLowerCase();
    if (['true','on','yes','1'].includes(text)) return true;
    if (['false','off','no','0'].includes(text)) return false;
  }
  return fallback;
}
