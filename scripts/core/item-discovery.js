/** Item discovery rules. Pure functions are deliberately independent of Foundry. */
export const ITEM_VISIBILITIES = ["revealed", "locked", "hidden", "dmOnly"];
export const ITEM_VISIBILITY_LABELS = { revealed: "Revealed", locked: "Locked", hidden: "Hidden", dmOnly: "DM only" };

export function visibilityOf(entry) {
  return ITEM_VISIBILITIES.includes(entry?.visibility) ? entry.visibility : "revealed";
}
export function isRevealed(entry) { return visibilityOf(entry) === "revealed"; }
export function normalizeReveal(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  const color = String(source.color || "#b8c3d2");
  return {
    mergeInto: String(source.mergeInto || "").slice(0, 60),
    rarityId: String(source.rarityId || "").slice(0, 80),
    label: String(source.label || "").slice(0, 100),
    icon: String(source.icon || "").slice(0, 500),
    style: ["keep", "neutral", "item", "rarity", "custom"].includes(source.style) ? source.style : "keep",
    color: /^#[0-9a-f]{6}$/i.test(color) ? color : "#b8c3d2",
    tooltipRarityId: String(source.tooltipRarityId || "").slice(0, 80)
  };
}
export function normalizeDescriptionParts(input, legacyText = "") {
  const parts = Array.isArray(input) ? input : [];
  const source = parts.length ? parts.slice(0, 70) : (legacyText ? [{ id: "legacy-description", text: legacyText }] : []);
  const used = new Set();
  return source.map((part, index) => {
    const raw = part && typeof part === "object" ? part : {};
    let id = String(raw.id || `part-${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60) || `part-${index + 1}`;
    while (used.has(id)) id = `${id}-${index + 1}`;
    used.add(id);
    return {
      id,
      text: String(raw.text || "").slice(0, 10000),
      revealedText: String(raw.revealedText || "").slice(0, 10000),
      visibility: visibilityOf(raw),
      join: ["space", "none", "line"].includes(raw.join) ? raw.join : "space"
    };
  });
}
/** Returns only player-safe *rendered* text. Never expose raw secret values in presentation objects. */
export function descriptionView(description) {
  if (!description?.enabled) return [];
  if (description.mode === "standard") {
    const text = String(description.text || "");
    return text.trim() ? [{ id: "standard-description", text, visibility: "revealed", locked: false, hidden: false, prefix: "" }] : [];
  }
  const visible = (description.parts || []).filter((part) => visibilityOf(part) !== "dmOnly");
  return visible.map((part, index) => {
    const state = visibilityOf(part);
    const text = state === "hidden" ? "???" : state === "revealed" ? (part.revealedText || part.text) : part.text;
    return {
      id: part.id, text, visibility: state, locked: state === "locked", hidden: state === "hidden",
      prefix: index === 0 || part.join === "none" ? "" : (part.join === "line" ? "\n" : " ")
    };
  });
}
/** Whether a new bonus is compatible with being displayed inside another. */
export function mergeTargetFor(increase, increases) {
  if (!isRevealed(increase) || !increase?.reveal?.mergeInto || increase.reveal.mergeInto === increase.id) return null;
  const target = increases.find((entry) => entry.id === increase.reveal.mergeInto);
  if (!target || !isRevealed(target)) return null;
  if (target.target !== increase.target || target.mode !== increase.mode || target.activation !== increase.activation) return null;
  // A target that itself merges into another would make the UI ambiguous.
  if (target.reveal?.mergeInto) return null;
  return target;
}
/** One-click GM change; returns new normalized rules without mutating the source. */
export function changeDiscoveryState(rules, kind, id, visibility, rarityIds = []) {
  if (!ITEM_VISIBILITIES.includes(visibility)) return null;
  const collection = kind === "increase" ? "increases" : kind === "dice" ? "dice" : kind === "description" ? "parts" : "";
  if (!collection) return null;
  const next = structuredClone(rules);
  const rows = kind === "description" ? next.description?.parts : next[collection];
  const row = rows?.find((entry) => entry.id === id);
  if (!row) return null;
  const wasRevealed = isRevealed(row);
  row.visibility = visibility;
  const rarity = kind !== "description" ? row.reveal?.rarityId : "";
  if (!wasRevealed && visibility === "revealed" && rarity && rarityIds.includes(rarity)) next.rarityId = rarity;
  return next;
}
