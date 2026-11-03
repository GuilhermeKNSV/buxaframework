import { visibilityOf, normalizeReveal } from "./item-discovery.js";
import { numericField, booleanField } from "./numeric-field.js";

function finite(value, fallback = 0, min = -1000000, max = 1000000) {
  return numericField(value, fallback, min, max);
}

function cleanColor(value, fallback = "#b8c3d2") {
  const text = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(text) ? text.toLowerCase() : fallback;
}

function cleanTarget(value) {
  const target = String(value || "").trim().slice(0, 180);
  return /^(resource|attribute|proficiency|stat):[^:]+:(max|value|modifier|dice)$/.test(target) ? target : "stat:damageReduction:value";
}

function makeId(value, used) {
  const base = String(value || "increase").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "increase";
  let id = base;
  let suffix = 2;
  while (used.has(id)) id = `${base}-${suffix++}`;
  used.add(id);
  return id;
}

export function normalizeItemIncreases(input) {
  const source = Array.isArray(input) ? input : [];
  const used = new Set();
  return source.slice(0, 60).map((entry, index) => {
    const raw = entry && typeof entry === "object" ? entry : {};
    const tooltip = raw.tooltip && typeof raw.tooltip === "object" ? raw.tooltip : {};
    const style = ["item", "neutral", "rarity", "custom"].includes(tooltip.style) ? tooltip.style : "neutral";
    const mode = raw.mode === "percent" ? "percent" : "flat";
    const activation = raw.activation === "passive" ? "passive" : "equipped";
    return {
      id: makeId(raw.id || `increase-${index + 1}`, used),
      target: cleanTarget(raw.target),
      mode,
      activation,
      visibility: visibilityOf(raw),
      reveal: normalizeReveal(raw.reveal),
      value: finite(raw.value, 0, mode === "percent" ? -100 : -1000000, 1000000),
      tooltip: {
        enabled: booleanField(tooltip.enabled, true),
        style,
        rarityId: String(tooltip.rarityId || "").trim().slice(0, 80),
        color: cleanColor(tooltip.color),
        label: String(tooltip.label || "").trim().slice(0, 100),
        icon: String(tooltip.icon || "").trim().slice(0, 500)
      }
    };
  });
}

export function createItemIncrease(index = 0) {
  return {
    id: `increase-${globalThis.foundry?.utils?.randomID?.(12) ?? globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`,
    target: "stat:damageReduction:value",
    mode: "flat",
    activation: "equipped",
    visibility: "revealed",
    reveal: normalizeReveal(),
    value: 1,
    tooltip: { enabled: true, style: "neutral", rarityId: "", color: "#b8c3d2", label: "", icon: "" }
  };
}

export function buildItemIncreaseTargetOptions(config) {
  const options = [];
  for (const resource of config?.resources ?? []) {
    options.push({ value: `resource:${resource.id}:max`, label: `${resource.label} · Maximum`, group: "RESOURCES" });
  }
  for (const attribute of config?.attributes?.entries ?? []) {
    options.push({ value: `attribute:${attribute.id}:value`, label: `${attribute.label} · Value`, group: "ATTRIBUTES" });
    options.push({ value: `attribute:${attribute.id}:modifier`, label: `${attribute.label} · Modifier`, group: "ATTRIBUTES" });
    options.push({ value: `attribute:${attribute.id}:dice`, label: `${attribute.label} · Dice`, group: "ATTRIBUTES" });
  }
  for (const proficiency of config?.proficiencies?.entries ?? []) {
    if (proficiency?.enabled === false) continue;
    options.push({ value: `proficiency:${proficiency.id}:value`, label: `${proficiency.label} · Value`, group: "PROFICIENCIES" });
    options.push({ value: `proficiency:${proficiency.id}:modifier`, label: `${proficiency.label} · Modifier`, group: "PROFICIENCIES" });
  }
  options.push({ value: "stat:damageReduction:value", label: "Damage Reduction", group: "STATS" });
  options.push({ value: "stat:initiative:value", label: "Initiative", group: "STATS" });
  return options;
}

export function itemIncreaseTargetLabel(target, config) {
  const option = buildItemIncreaseTargetOptions(config).find((entry) => entry.value === target);
  if (!option) return "Bonus";
  const { kind, property } = itemIncreaseTargetParts(target);
  const base = option.label.split(" · ")[0];
  if ((kind === "attribute" || kind === "proficiency") && property === "value") return base;
  if (property === "modifier") return `${base} mod`;
  if (kind === "attribute" && property === "dice") return `${base} dice`;
  if (kind === "resource" && property === "max") return `Max ${base}`;
  return option.label.replace(" · ", " ");
}

export function itemIncreaseTargetParts(target) {
  const [kind = "", id = "", property = ""] = String(target || "").split(":");
  return { kind, id, property };
}
