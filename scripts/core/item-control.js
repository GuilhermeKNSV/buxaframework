import { visibilityOf, ITEM_VISIBILITY_LABELS } from "./item-discovery.js";
import { itemIncreaseTargetLabel } from "./item-increase-config.js";

/** GM configuration display data; do not pass to player-facing templates. */
export function buildItemControlEntries(rules, config) {
  if (!rules) return [];
  const entries = [
    ...(rules.increases || []).map((entry) => ({
      ...entry, kind: "increase", title: entry.tooltip?.label || itemIncreaseTargetLabel(entry.target, config),
      detail: `${Number(entry.value) > 0 ? "+" : ""}${entry.value}${entry.mode === "percent" ? "%" : ""} · ${entry.activation || "equipped"}`
    })),
    ...(rules.dice || []).map((entry) => ({
      ...entry, kind: "dice", title: entry.tooltip?.label || entry.label || "Dice",
      detail: `${entry.count}d${entry.faces}${entry.flat ? ` + ${entry.flat}` : ""}`
    })),
    ...(rules.description?.enabled && rules.description.mode !== "standard" ? rules.description.parts || [] : []).map((entry) => ({
      ...entry, kind: "description", title: entry.text || "Description field",
      detail: entry.revealedText ? `Reveals: ${entry.revealedText}` : "Description fragment"
    }))
  ];
  return entries.map((entry) => ({
    ...entry,
    visibility: visibilityOf(entry),
    visibilityLabel: ITEM_VISIBILITY_LABELS[visibilityOf(entry)],
    isRevealed: visibilityOf(entry) === "revealed",
    isLocked: visibilityOf(entry) === "locked",
    isHidden: visibilityOf(entry) === "hidden",
    isDmOnly: visibilityOf(entry) === "dmOnly"
  }));
}
