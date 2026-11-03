export const NUMBER_DISPLAY_MODES = Object.freeze({
  TRUNCATE: "truncate",
  CEIL: "ceil",
  FLOOR: "floor",
  FULL: "full"
});

const VALID_MODES = new Set(Object.values(NUMBER_DISPLAY_MODES));

export function normalizeNumberDisplay(input) {
  const raw = input && typeof input === "object" ? input : {};
  const mode = VALID_MODES.has(raw.mode) ? raw.mode : NUMBER_DISPLAY_MODES.TRUNCATE;
  return { mode };
}

/**
 * Remove normal IEEE-754 display noise without deliberately changing useful
 * decimal values. Eight fractional digits is more precision than Buxa's
 * gameplay values currently need and turns values such as
 * 61.199999999999996 into 61.2.
 */
export function cleanFloatingNumber(value, fallback = 0) {
  if (value == null || typeof value === 'boolean' || !['number','string'].includes(typeof value) ||
      (typeof value === 'string' && !value.trim())) return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  if (Number.isInteger(number)) return number;
  const cleaned = Number(number.toFixed(8));
  return Object.is(cleaned, -0) ? 0 : cleaned;
}

export function applyNumberDisplay(value, setting = NUMBER_DISPLAY_MODES.TRUNCATE, fallback = 0) {
  const mode = typeof setting === "string" ? setting : setting?.mode;
  const clean = cleanFloatingNumber(value, fallback);
  switch (VALID_MODES.has(mode) ? mode : NUMBER_DISPLAY_MODES.TRUNCATE) {
    case NUMBER_DISPLAY_MODES.CEIL:
      return Math.ceil(clean);
    case NUMBER_DISPLAY_MODES.FLOOR:
      return Math.floor(clean);
    case NUMBER_DISPLAY_MODES.FULL:
      return clean;
    case NUMBER_DISPLAY_MODES.TRUNCATE:
    default:
      return Math.trunc(clean);
  }
}

export function formatNumberDisplay(value, setting = NUMBER_DISPLAY_MODES.TRUNCATE, fallback = 0) {
  return String(applyNumberDisplay(value, setting, fallback));
}

export function numberInputStep(setting = NUMBER_DISPLAY_MODES.TRUNCATE) {
  const mode = typeof setting === "string" ? setting : setting?.mode;
  return mode === NUMBER_DISPLAY_MODES.FULL ? "any" : "1";
}
