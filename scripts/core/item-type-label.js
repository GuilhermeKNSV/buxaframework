/** The visible category of a Buxa item is a cosmetic, player-authored label.
 * Foundry's required document `type` is deliberately never used as a fallback.
 */
export function itemDisplayLabel(rules) {
  const typeLabel = rules?.typeLabel;
  if (!typeLabel || typeLabel.enabled === false) return "";
  return String(typeLabel.label ?? "").trim().slice(0, 48);
}
