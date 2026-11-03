/** UI options shared by every Buxa Framework toast (info, success, warning, error). */
import { DEFAULT_WARNING_SETTINGS, MODULE_ID, SETTINGS } from "./constants.js";

const POSITIONS = new Set(["left", "center", "right"]);

export function normalizeWarningSettings(input) {
  const raw = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const numeric = Number(raw.durationSeconds);
  return {
    durationSeconds: raw.durationSeconds === "" || raw.durationSeconds === null || raw.durationSeconds === undefined
      ? DEFAULT_WARNING_SETTINGS.durationSeconds
      : Number.isFinite(numeric)
        ? Math.max(0, Math.min(60, Math.round(numeric)))
        : DEFAULT_WARNING_SETTINGS.durationSeconds,
    position: POSITIONS.has(raw.position) ? raw.position : DEFAULT_WARNING_SETTINGS.position
  };
}

export function normalizeUiSettings(raw) {
  return { warning: normalizeWarningSettings(raw?.warning), itemUi: { openFoldersLeft: raw?.itemUi?.openFoldersLeft === true } };
}

/** Keep UI notifications usable on first load, before settings have registered. */
export function getWarningSettings() {
  try {
    const config = game.settings.get(MODULE_ID, SETTINGS.SHEET_CONFIG);
    return normalizeWarningSettings(config?.ui?.warning);
  } catch (_error) {
    return normalizeWarningSettings();
  }
}
