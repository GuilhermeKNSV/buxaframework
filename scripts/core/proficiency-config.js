import { savedBoolean } from "./stored-values.js";
function asInt(value, fallback = 0, { min = -Infinity, max = Infinity } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function slugify(value, fallback = "proficiency") {
  const slug = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `${fallback}-${foundry.utils.randomID(6).toLowerCase()}`;
}

function uniqueId(candidate, used) {
  let id = slugify(candidate);
  const base = id;
  let suffix = 2;
  while (used.has(id)) id = `${base}-${suffix++}`;
  used.add(id);
  return id;
}

function normalizePoints(input) {
  const raw = input && typeof input === "object" ? input : {};
  return {
    enabled: savedBoolean(raw.enabled,true),
    label: String(raw.label || "PROF. POINTS").trim() || "PROF. POINTS",
    startingPoints: asInt(raw.startingPoints, 0, { min: 0 }),
    grantAmount: asInt(raw.grantAmount, 1, { min: 0 }),
    grantEveryLevels: asInt(raw.grantEveryLevels, 1, { min: 1 }),
    playersCanDecrease: savedBoolean(raw.playersCanDecrease),
    allowBelowZero: savedBoolean(raw.allowBelowZero)
  };
}

function normalizeEntry(input, used, attributeIds) {
  const raw = input && typeof input === "object" ? input : {};
  const features = raw.features && typeof raw.features === "object" ? raw.features : {};
  const requestedAttribute = String(raw.attributeId || "");
  return {
    id: uniqueId(raw.id || raw.label || "proficiency", used),
    enabled: savedBoolean(raw.enabled,true),
    label: String(raw.label || "PROFICIENCY").trim() || "PROFICIENCY",
    icon: {
      enabled: savedBoolean(raw.icon?.enabled),
      path: String(raw.icon?.path || "").trim().slice(0, 500)
    },
    attributeId: attributeIds.has(requestedAttribute) ? requestedAttribute : "",
    modifierEveryPoints: asInt(raw.modifierEveryPoints, 1, { min: 1 }),
    features: {
      dice: savedBoolean(features.dice,true),
      reroll: savedBoolean(features.reroll,true),
      number: savedBoolean(features.number,true),
      modifier: savedBoolean(features.modifier,true)
    }
  };
}

export function normalizeProficiencies(input, attributes = []) {
  const raw = input && typeof input === "object" ? input : {};
  const mode = raw.mode === "attribute" ? "attribute" : "modifier";
  const attributeIds = new Set(attributes.map((attribute) => attribute.id));
  const used = new Set();
  const entries = [];
  for (const entry of Array.isArray(raw.entries) ? raw.entries : []) {
    if (!entry) continue;
    entries.push(normalizeEntry(entry, used, attributeIds));
  }

  return {
    enabled: savedBoolean(raw.enabled),
    label: String(raw.label || "PROFICIENCIES").trim() || "PROFICIENCIES",
    mode,
    points: normalizePoints(raw.points),
    entries
  };
}

export function createProficiency(label = "NEW PROFICIENCY") {
  return normalizeEntry({
    id: `${slugify(label)}-${foundry.utils.randomID(5).toLowerCase()}`,
    enabled: true,
    label,
    icon: { enabled: false, path: "" },
    attributeId: "",
    modifierEveryPoints: 1,
    features: { dice: true, reroll: true, number: true, modifier: true }
  }, new Set(), new Set());
}
