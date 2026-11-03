import { formatItemDiceFormula } from '../core/item-formula-display.js';
/** Buxa item editor card behaviour. Presentation only; no item data migration. */
import { createItemChoiceManager, describeItemChoice } from "./item-rule-choice.js";

const field = (row, name) => row.querySelector(`[${name}]`);
const numeric = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const signed = (value) => `${numeric(value) >= 0 ? "+" : ""}${numeric(value)}`;

export function itemIncreaseSummary(row) {
  const target = field(row, "data-item-increase-target")?.selectedOptions?.[0];
  const label = describeItemChoice(target).label || "Choose a stat";
  const value = numeric(field(row, "data-item-increase-value")?.value);
  const suffix = field(row, "data-item-increase-mode")?.value === "percent" ? "%" : "";
  const active = field(row, "data-item-increase-activation")?.value === "passive" ? "Passive" : "Equipped";
  return `${label}  ·  ${signed(value)}${suffix}  ·  ${active}`;
}

export function itemDiceSummary(row) {
  const attributeEnabled = Boolean(field(row, "data-item-dice-attribute-enabled")?.checked);
  const count = Math.max(0, numeric(field(row, "data-item-dice-count")?.value, 1));
  const faces = Math.max(2, numeric(field(row, "data-item-dice-faces")?.value, 20));
  const attributeFaces = Math.max(2, numeric(field(row, "data-item-dice-attribute-faces")?.value, 20));
  const selectedAttribute = field(row, "data-item-dice-attribute-id")?.selectedOptions?.[0]?.textContent?.trim() || "Attribute";
  const flat = numeric(field(row, "data-item-dice-flat")?.value);
  const mode = field(row, "data-item-dice-roll-mode")?.selectedOptions?.[0]?.textContent?.trim() || "Normal";
  // Editor has no Actor: use the base (1 die) preview for an attribute
  // source, and put the dynamic source in metadata outside the formula.
  const diceText = formatItemDiceFormula({
    count:attributeEnabled ? 1 : count, faces:attributeEnabled ? attributeFaces : faces, bonus:flat,
    unresolvedModifier:field(row, "data-item-dice-modifier")?.selectedOptions?.[0]?.value !== "none:"
      && field(row, "data-item-dice-modifier")?.selectedOptions?.[0]?.value ? 'MOD' : ''
  });
  const source = attributeEnabled ? `  ·  ${selectedAttribute} source` : '';
  return `${diceText}${source}  ·  ${mode}`;
}

/** Update only the editor row that changed. Source choice menus are rebuilt
 * exclusively after a structural change, not on every typed character. */
export function createItemRuleEditor(root) {
  const manager = createItemChoiceManager(root);
  const rows = selector => [...root.querySelectorAll(selector)];
  const refreshIncrease = (row, index) => {
    const title = field(row, "data-buxa-rule-title");
    const summary = field(row, "data-buxa-rule-summary");
    const label = `Increase ${String(index + 1).padStart(2, "0")}`;
    const value = itemIncreaseSummary(row);
    if (title && title.textContent !== label) title.textContent = label;
    if (summary && summary.textContent !== value) summary.textContent = value;
  };
  const refreshDice = row => {
    const title = field(row, "data-buxa-rule-title");
    const summary = field(row, "data-buxa-rule-summary");
    const label = field(row, "data-item-dice-label")?.value?.trim() || "Untitled roll";
    const value = itemDiceSummary(row);
    if (title && title.textContent !== label) title.textContent = label;
    if (summary && summary.textContent !== value) summary.textContent = value;
  };
  const refresh = () => {
    manager.refresh();
    rows("[data-item-increase-row]").forEach(refreshIncrease);
    rows("[data-item-dice-row]").forEach(refreshDice);
  };
  const onChange = event => {
    const row = event.target.closest?.("[data-item-increase-row], [data-item-dice-row]");
    if (!row) return;
    if (row.matches?.("[data-item-increase-row]")) {
      const increaseRows = rows("[data-item-increase-row]");
      refreshIncrease(row, increaseRows.indexOf(row));
    } else refreshDice(row);
  };
  const onClick = event => {
    const button = event.target.closest?.("[data-buxa-rule-collapse]");
    if (!button || !root.contains(button)) return;
    event.preventDefault();
    const card = button.closest(".buxa-rule-card");
    if (!card) return;
    const collapsed = card.classList.toggle("is-collapsed");
    button.setAttribute("aria-expanded", String(!collapsed));
    button.title = collapsed ? "Expand rule" : "Collapse rule";
  };
  root.addEventListener("input", onChange);
  root.addEventListener("change", onChange);
  root.addEventListener("click", onClick);
  refresh();
  return {
    refresh,
    destroy: () => {
      root.removeEventListener("input", onChange);
      root.removeEventListener("change", onChange);
      root.removeEventListener("click", onClick);
      manager.destroy();
    }
  };
}
