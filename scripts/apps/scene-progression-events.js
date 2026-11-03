/** Normalize Foundry document update payloads into the progression events that
 * can be displayed by the scene FX. Foundry can send either flattened dotted
 * keys or a nested update object; both are used by system/module integrations.
 */
import { MODULE_ID } from "../core/constants.js";

function walkChanges(value, prefix = "", result = new Map()) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return result;
  for (const [key, entry] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (entry !== null && typeof entry === "object" && !Array.isArray(entry)) {
      walkChanges(entry, path, result);
    } else result.set(path, entry);
  }
  return result;
}

/** Return only successful Buxa progression writes, never initial Actor creation
 * or bulk/GM configuration changes. The observer is invoked *after* Foundry has
 * committed the update, and is independent of optional custom hook listeners.
 */
export function progressionChanges(actor, changes, options = {}, config = {}) {
  if (!actor || options?.[`${MODULE_ID}.runtime`] !== true) return [];
  const paths = walkChanges(changes);
  const result = [];
  const level = paths.get(`flags.${MODULE_ID}.level`);
  if (level !== undefined && level !== null && level !== "" && Number.isInteger(Number(level)) && Number(level) > 0) {
    result.push({ kind: "level", result: { newLevel: Number(level) } });
  }
  const prefix = `flags.${MODULE_ID}.attributes.`;
  for (const [path, value] of paths) {
    if (!path.startsWith(prefix) || !path.endsWith(".rebirths")) continue;
    const id = path.slice(prefix.length, -".rebirths".length);
    if (!id || id.includes(".") || !Number.isInteger(Number(value)) || Number(value) <= 0) continue;
    const attribute = config?.attributes?.entries?.find(entry => entry.id === id);
    if (!attribute?.rebirth?.enabled) continue;
    result.push({ kind: "rebirth", result: { attribute, after: Number(value) } });
  }
  return result;
}

/** Include the exact token when the Actor is synthetic/unlinked. */
export function progressionEventKey(actor, visual, sceneId = "") {
  const tokenId = actor?.isToken ? (actor.token?.id ?? actor.parent?.id ?? "") : "";
  return [sceneId, actor?.id ?? "", tokenId, visual.kind,
    visual.attributeId ?? "", visual.subtitle, visual.value ?? ""].join("|");
}
