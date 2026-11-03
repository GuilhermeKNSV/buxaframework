/** Persistent, per-Actor token resource display. No canvas or UI dependencies. */
import { MODULE_ID } from "./constants.js";

export const HUD_STYLES = Object.freeze(["sao", "classic", "vertical"]);
export const HUD_VISIBILITIES = Object.freeze(["owner", "everyone", "selected"]);
export const HUD_POSITIONS = Object.freeze(["top", "bottom", "left", "right"]);
export const HUD_VALUE_POSITIONS = Object.freeze(["inside", "above", "below", "left", "right"]);
const clamp = (value, min, max, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) ? Math.max(min, Math.min(max, num)) : fallback;
};
const oneOf = (value, options, fallback) => options.includes(value) ? value : fallback;
const color = (value, fallback) => /^#[\da-f]{6}$/i.test(value || "") ? value : fallback;

export function normalizeHudResource(input = {}, resource = {}) {
  const item = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  // The removed radial style is interpreted as Classic; old Actor flags stay
  // readable without any migration or destructive settings write.
  const style = item.style === "ring" ? "classic" : oneOf(item.style, HUD_STYLES, "sao");
  const defaultPosition = style === "vertical" ? "right" : "top";
  return {
    enabled: item.enabled === true,
    style,
    position: oneOf(item.position, HUD_POSITIONS, defaultPosition),
    visibility: oneOf(item.visibility, HUD_VISIBILITIES, "everyone"),
    viewers: Array.isArray(item.viewers) ? [...new Set(item.viewers.filter(v => typeof v === "string" && v.length <= 128))].slice(0, 500) : [],
    showValue: item.showValue !== false,
    showMax: item.showMax !== false,
    // A resource bar should be clean by default; labels are opt-in. Never
    // display a character name as a substitute for a resource label.
    showLabel: item.showLabel === true,
    valuePosition: oneOf(item.valuePosition, HUD_VALUE_POSITIONS, "inside"),
    scale: clamp(item.scale, 0.5, 2.5, 1),
    thickness: clamp(item.thickness, 4, 28, 11),
    opacity: clamp(item.opacity, 0.2, 1, 0.96),
    offsetX: clamp(item.offsetX, -250, 250, 0),
    offsetY: clamp(item.offsetY, -250, 250, 0),
    color: color(item.color, color(resource.color, "#58bdec"))
  };
}

export function getResourceHud(actor, resource) {
  const saved = actor?.getFlag?.(MODULE_ID, "resourceHud")?.[resource.id];
  return normalizeHudResource(saved, resource);
}

/** Update multiple resources in one Actor document write, preventing redraw storms. */
export async function saveResourceHudBatch(actor, updates, resources = []) {
  if (!actor?.isOwner || !updates || typeof updates !== "object") return false;
  const saved = actor.getFlag?.(MODULE_ID, "resourceHud") ?? {};
  const byId = new Map(resources.map(resource => [resource.id, resource]));
  const patch = {};
  for (const [resourceId, changes] of Object.entries(updates)) {
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(resourceId) || !byId.has(resourceId)) continue;
    const resource = byId.get(resourceId);
    const previous = saved?.[resourceId] ?? {};
    const next = normalizeHudResource({ ...previous, ...changes }, resource);
    // On explicit Save, retire an old radial flag even if the visible Classic
    // configuration was otherwise unchanged. Other no-op writes remain skipped.
    if (previous.style !== "ring" && JSON.stringify(normalizeHudResource(previous, resource)) === JSON.stringify(next)) continue;
    patch[`flags.${MODULE_ID}.resourceHud.${resourceId}`] = next;
  }
  if (Object.keys(patch).length) await actor.update(patch);
  return true;
}

export async function saveResourceHud(actor, resourceId, changes, resource) {
  if (!resourceId || !resource) return false;
  return saveResourceHudBatch(actor, { [resourceId]: changes }, [resource]);
}

export function canSeeResourceHud(actor, settings, viewer, { tokenVisible = true } = {}) {
  if (!settings?.enabled || !viewer || !tokenVisible) return false;
  if (viewer.isGM) return true;
  if (settings.visibility === "everyone") return true;
  if (settings.visibility === "selected") return settings.viewers.includes(viewer.id);
  const ownerLevel = globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
  return Boolean(actor?.testUserPermission?.(viewer, ownerLevel));
}

export function trackedHudResources(actor, resources, viewer, options = {}) {
  return (resources ?? []).map(resource => ({ resource, settings: getResourceHud(actor, resource) }))
    .filter(entry => canSeeResourceHud(actor, entry.settings, viewer, options));
}
