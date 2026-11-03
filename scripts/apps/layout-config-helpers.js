import { RESOURCE_LINKS } from "../core/constants.js";
import { clampWidth } from "../core/config.js";

export const RESTORE_OPTIONS = Object.freeze([
  { id: "none", label: "No restore" },
  { id: "flat", label: "Restore flat amount" },
  { id: "percent", label: "Restore % of max" },
  { id: "full", label: "Restore to full" }
]);

// Primary is reserved by the permanent MP resource. Keeping it out of custom
// resource choices prevents two cards from silently editing the same D&D slot.
export const RESOURCE_LINK_OPTIONS = Object.freeze([
  { id: RESOURCE_LINKS.BUXA, label: "Buxa only" },
  { id: RESOURCE_LINKS.SECONDARY, label: "D&D 5e · Secondary" },
  { id: RESOURCE_LINKS.TERTIARY, label: "D&D 5e · Tertiary" }
]);

function esc(value) {
  return foundry.utils.escapeHTML(String(value ?? ""));
}

function q(root, selector) {
  return root?.querySelector?.(selector) ?? null;
}

export function value(root, selector, fallback = "") {
  return q(root, selector)?.value ?? fallback;
}

export function checked(root, selector) {
  return Boolean(q(root, selector)?.checked);
}

export function numberValue(root, selector, fallback = 0) {
  const number = Number(value(root, selector, fallback));
  return Number.isFinite(number) ? number : fallback;
}

export function romanNumeral(valueToConvert) {
  const number = Math.max(1, Math.min(3999, Math.round(Number(valueToConvert) || 1)));
  const table = [[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]];
  let remaining = number;
  let output = "";
  for (const [amount, symbol] of table) {
    while (remaining >= amount) {
      output += symbol;
      remaining -= amount;
    }
  }
  return output;
}

export function readRebirthStyles(element) {
  return [...element.querySelectorAll("[data-rebirth-style-row]")].map((styleRow) => ({
    color: value(styleRow, "[data-rebirth-style-color]", "#151a24"),
    decoration: value(styleRow, "[data-rebirth-style-decoration]", "").trim()
      || romanNumeral(Number(styleRow.dataset.rebirthStyleLevel) || 1)
  }));
}

export function readFieldRows(element) {
  return [...element.querySelectorAll("[data-field-row]")].map((row) => ({
    id: row.dataset.fieldId,
    label: value(row, "[data-field-label]", "CAMPO").trim() || "CAMPO",
    width: clampWidth(value(row, "[data-field-width]", 6)),
    binding: row.dataset.fieldId === "name" ? "name" : "flag",
    locked: row.dataset.fieldId === "name"
  }));
}

export function readResourceRows(element) {
  return [...element.querySelectorAll("[data-resource-row]")].map((row) => ({
    id: row.dataset.resourceId,
    label: value(row, "[data-resource-label]", "RESOURCE").trim() || "RESOURCE",
    color: value(row, "[data-resource-color]", "#4f7fdb"),
    startMax: numberValue(row, "[data-resource-start]", 0),
    syncCurrentOnMax: checked(row, "[data-resource-sync-max]"),
    link: row.dataset.resourceLocked === "true"
      ? row.dataset.resourceLink
      : value(row, "[data-resource-link]", RESOURCE_LINKS.BUXA),
    locked: row.dataset.resourceLocked === "true",
    icon: {
      enabled: checked(row, "[data-resource-icon-enabled]"),
      path: value(row, "[data-resource-icon-path]", "")
    },
    levelUp: {
      maxGain: numberValue(row, "[data-resource-max-gain]", 0),
      maxEveryLevels: numberValue(row, "[data-resource-max-every]", 1),
      restoreMode: value(row, "[data-resource-restore-mode]", "none"),
      restoreAmount: numberValue(row, "[data-resource-restore-amount]", 0),
      restoreEveryLevels: numberValue(row, "[data-resource-restore-every]", 1)
    }
  }));
}

export function readAttributeRows(element) {
  return [...element.querySelectorAll("[data-attribute-row]")].map((row) => {
    const id = row.dataset.attributeId;
    const rebirthRow = element.querySelector(`[data-rebirth-attribute-row][data-rebirth-attribute-id="${CSS.escape(id)}"]`);
    return {
      id,
      label: value(row, "[data-attribute-label]", "ATTRIBUTE").trim() || "ATTRIBUTE",
      ability: value(row, "[data-attribute-ability]", "str"),
      icon: {
        enabled: checked(row, "[data-attribute-icon-enabled]"),
        path: value(row, "[data-attribute-icon-path]", "")
      },
      appearance: {
        color: value(row, "[data-attribute-color]", "#151a24"),
        decoration: value(row, "[data-attribute-decoration]", "◆").trim() || "◆"
      },
      modifier: {
        enabled: checked(row, "[data-attribute-modifier-enabled]"),
        everyPoints: numberValue(row, "[data-attribute-modifier-every]", 5)
      },
      rebirth: {
        enabled: checked(rebirthRow, "[data-attribute-rebirth-enabled]"),
        maxPoints: numberValue(rebirthRow, "[data-attribute-rebirth-max]", 20),
        gainDieEveryRebirths: numberValue(rebirthRow, "[data-attribute-dice-every]", 1),
        lockModifier: checked(rebirthRow, "[data-attribute-lock-modifier]"),
        baseModifierCap: numberValue(rebirthRow, "[data-attribute-base-mod-cap]", 2),
        modifierCapPerRebirth: numberValue(rebirthRow, "[data-attribute-mod-cap-gain]", 1)
      }
    };
  });
}

export function readProficiencyRows(element) {
  return [...element.querySelectorAll("[data-proficiency-config-row]")].map((row) => ({
    id: row.dataset.proficiencyId,
    enabled: checked(row, "[data-proficiency-enabled]"),
    label: value(row, "[data-proficiency-label]", "PROFICIENCY").trim() || "PROFICIENCY",
    icon: {
      enabled: checked(row, "[data-proficiency-icon-enabled]"),
      path: value(row, "[data-proficiency-icon-path]", "")
    },
    attributeId: value(row, "[data-proficiency-attribute]", ""),
    modifierEveryPoints: numberValue(row, "[data-proficiency-modifier-every]", 1),
    features: {
      dice: checked(row, "[data-proficiency-feature-dice]"),
      reroll: checked(row, "[data-proficiency-feature-reroll]"),
      number: checked(row, "[data-proficiency-feature-number]"),
      modifier: checked(row, "[data-proficiency-feature-modifier]")
    }
  }));
}

export function moveRow(target, direction, rowSelector) {
  const row = target.closest(rowSelector);
  if (!row) return;
  if (direction < 0) {
    const previous = row.previousElementSibling;
    if (previous) row.parentElement.insertBefore(row, previous);
    return;
  }
  const next = row.nextElementSibling;
  if (next) row.parentElement.insertBefore(next, row);
}

export function syncRebirthRuleOrder(app) {
  const list = app?.element?.querySelector?.("[data-rebirth-attribute-list]");
  if (!list) return;
  const order = [...app.element.querySelectorAll("[data-attribute-row]")].map((row) => row.dataset.attributeId);
  for (const id of order) {
    const rule = list.querySelector(`[data-rebirth-attribute-row][data-rebirth-attribute-id="${CSS.escape(id)}"]`);
    if (rule) list.append(rule);
  }
}

export function fieldRowHtml(field) {
  return `
    <div class="buxa-config-field-row" data-field-row data-field-id="${esc(field.id)}">
      <span class="buxa-drag-handle"><i class="fa-solid fa-grip-lines"></i></span>
      <div class="buxa-label-cell"><input data-field-label type="text" value="${esc(field.label)}"></div>
      <input data-field-width type="number" min="2" max="12" step="1" value="${field.width}">
      <div class="buxa-config-row-actions">
        <button type="button" data-action="moveFieldUp" title="Move up"><i class="fa-solid fa-chevron-up"></i></button>
        <button type="button" data-action="moveFieldDown" title="Move down"><i class="fa-solid fa-chevron-down"></i></button>
        <button type="button" data-action="removeField" title="Remove"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>`;
}

function iconControlHtml(kind, entry) {
  const path = esc(entry?.icon?.path || "");
  const hasIcon = Boolean(entry?.icon?.path);
  return `<div class="buxa-config-icon-control" data-entry-icon-control>
    <label title="Show this SVG on the player sheet"><input data-${kind}-icon-enabled type="checkbox" ${entry?.icon?.enabled ? "checked" : ""}> SVG</label>
    <span class="buxa-config-icon-preview ${hasIcon ? "" : "is-empty"}" data-icon-preview>${hasIcon ? `<img src="${path}" alt="">` : ""}</span>
    <button type="button" class="buxa-config-icon-pick" data-action="pickEntrySvg" data-icon-kind="${kind}">PICK SVG</button>
    <input data-${kind}-icon-path type="hidden" value="${path}">
  </div>`;
}

export function resourceRowHtml(resource) {
  const linkOptions = RESOURCE_LINK_OPTIONS.map((option) =>
    `<option value="${option.id}" ${option.id === resource.link ? "selected" : ""}>${esc(option.label)}</option>`
  ).join("");
  const restoreOptions = RESTORE_OPTIONS.map((option) =>
    `<option value="${option.id}" ${option.id === resource.levelUp.restoreMode ? "selected" : ""}>${esc(option.label)}</option>`
  ).join("");

  return `
    <article class="buxa-config-resource" data-resource-row data-resource-id="${esc(resource.id)}" data-resource-locked="false" data-resource-link="${RESOURCE_LINKS.BUXA}">
      <div class="buxa-config-resource-main">
        <span class="buxa-drag-handle"><i class="fa-solid fa-grip-lines"></i></span>
        <label><span>Name</span><input data-resource-label type="text" value="${esc(resource.label)}"></label>
        <label><span>Color</span><input data-resource-color type="color" value="${esc(resource.color)}"></label>
        <label><span>Starting max</span><input data-resource-start type="number" min="0" step="1" value="${resource.startMax}"></label>
        <label><span>Link</span><select data-resource-link>${linkOptions}</select></label>
        <div class="buxa-config-row-actions">
          <button type="button" data-action="moveResourceUp" title="Move up"><i class="fa-solid fa-chevron-up"></i></button>
          <button type="button" data-action="moveResourceDown" title="Move down"><i class="fa-solid fa-chevron-down"></i></button>
          <button type="button" data-action="removeResource" title="Remove"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
      ${iconControlHtml("resource", resource)}
      <label class="buxa-config-toggle compact"><input data-resource-sync-max type="checkbox" checked><span><strong>Changing Max refills Current</strong></span></label>
      <details class="buxa-config-advanced">
        <summary>On level up</summary>
        <div class="buxa-config-mini-grid">
          <label><span>Max +</span><input data-resource-max-gain type="number" min="0" step="1" value="0"></label>
          <label><span>Every levels</span><input data-resource-max-every type="number" min="1" step="1" value="1"></label>
          <label><span>Restore</span><select data-resource-restore-mode>${restoreOptions}</select></label>
          <label><span>Amount / %</span><input data-resource-restore-amount type="number" min="0" step="1" value="0"></label>
          <label><span>Every levels</span><input data-resource-restore-every type="number" min="1" step="1" value="1"></label>
        </div>
      </details>
    </article>`;
}

export function rebirthStyleRowHtml(style, level) {
  const color = esc(style?.color || "#f1f4ff");
  const decoration = esc(style?.decoration || romanNumeral(level));
  return `<div class="buxa-rebirth-style-row is-global" data-rebirth-style-row data-rebirth-style-level="${level}">
    <span class="buxa-rebirth-style-level">R${level}</span>
    <input data-rebirth-style-color type="color" value="${color}" title="Rebirth color">
    <input data-rebirth-style-decoration type="text" maxlength="10" value="${decoration}" title="Badge decoration">
    <span class="buxa-rebirth-style-preview" style="--buxa-preview-color:${color}"><b>${level}</b><small>${decoration}</small></span>
    <button type="button" data-action="removeRebirthStyle" title="Remove this rebirth style">×</button>
  </div>`;
}

export function attributeRowHtml(attribute, abilityOptions) {
  const abilities = abilityOptions.map((option) =>
    `<option value="${option.id}" ${option.id === attribute.ability ? "selected" : ""}>${esc(option.label)} (${option.id.toUpperCase()})</option>`
  ).join("");

  return `
    <article class="buxa-config-attribute" data-attribute-row data-attribute-id="${esc(attribute.id)}">
      <div class="buxa-config-attribute-main">
        <span class="buxa-drag-handle">⋮⋮</span>
        <label><span>Name</span><input data-attribute-label type="text" value="${esc(attribute.label)}"></label>
        <label><span>D&D 5e link</span><select data-attribute-ability>${abilities}</select></label>
        <div class="buxa-config-row-actions">
          <button type="button" data-action="moveAttributeUp" title="Move up">↑</button>
          <button type="button" data-action="moveAttributeDown" title="Move down">↓</button>
          <button type="button" data-action="removeAttribute" title="Remove">×</button>
        </div>
      </div>
      <div class="buxa-config-attribute-features two">
        <details class="buxa-config-advanced">
          <summary>Appearance</summary>
          ${iconControlHtml("attribute", attribute)}
          <div class="buxa-config-mini-grid two">
            <label><span>Accent</span><input data-attribute-color type="color" value="${esc(attribute.appearance?.color || "#151a24")}"></label>
            <label><span>Decoration</span><input data-attribute-decoration type="text" maxlength="10" value="${esc(attribute.appearance?.decoration || "◆")}"></label>
          </div>
        </details>
        <details class="buxa-config-advanced">
          <summary>Modifier</summary>
          <label class="buxa-config-toggle compact"><input data-attribute-modifier-enabled type="checkbox" ${attribute.modifier?.enabled ? "checked" : ""}><span><strong>Enable modifier</strong></span></label>
          <div class="buxa-config-mini-grid one-line">
            <label><span>+1 every points</span><input data-attribute-modifier-every type="number" min="1" step="1" value="${attribute.modifier?.everyPoints ?? 5}"></label>
          </div>
        </details>
      </div>
    </article>`;
}

export function rebirthAttributeRowHtml(attribute) {
  return `
    <article class="buxa-config-rebirth-rule" data-rebirth-attribute-row data-rebirth-attribute-id="${esc(attribute.id)}">
      <div class="buxa-config-rebirth-rule-head"><strong>${esc(attribute.label)}</strong></div>
      <label class="buxa-config-toggle compact"><input data-attribute-rebirth-enabled type="checkbox" ${attribute.rebirth?.enabled ? "checked" : ""}><span><strong>Enable rebirth</strong></span></label>
      <div class="buxa-config-mini-grid three">
        <label><span>Max points</span><input data-attribute-rebirth-max type="number" min="1" step="1" value="${attribute.rebirth?.maxPoints ?? 20}"></label>
        <label><span>+1 die every rebirths</span><input data-attribute-dice-every type="number" min="1" step="1" value="${attribute.rebirth?.gainDieEveryRebirths ?? 1}"></label>
        <label><span>Base modifier cap</span><input data-attribute-base-mod-cap type="number" min="0" step="1" value="${attribute.rebirth?.baseModifierCap ?? 2}"></label>
        <label><span>Cap + per rebirth</span><input data-attribute-mod-cap-gain type="number" min="0" step="1" value="${attribute.rebirth?.modifierCapPerRebirth ?? 1}"></label>
      </div>
      <label class="buxa-config-toggle compact"><input data-attribute-lock-modifier type="checkbox" ${attribute.rebirth?.lockModifier ? "checked" : ""}><span><strong>Lock modifier by rebirth</strong></span></label>
    </article>`;
}


export function proficiencyRowHtml(proficiency, attributes = []) {
  const attributeOptions = [
    `<option value="">None</option>`,
    ...attributes.map((attribute) => `<option value="${esc(attribute.id)}" ${attribute.id === proficiency.attributeId ? "selected" : ""}>${esc(attribute.label)}</option>`)
  ].join("");
  const features = proficiency.features ?? {};
  return `
    <article class="buxa-config-proficiency" data-proficiency-config-row data-proficiency-id="${esc(proficiency.id)}">
      <div class="buxa-config-proficiency-main">
        <span class="buxa-drag-handle">⋮⋮</span>
        <label class="buxa-config-inline-check" title="Enabled"><input data-proficiency-enabled type="checkbox" ${proficiency.enabled !== false ? "checked" : ""}></label>
        <label><span>Name</span><input data-proficiency-label type="text" value="${esc(proficiency.label)}"></label>
        <label><span>Linked attribute</span><select data-proficiency-attribute>${attributeOptions}</select></label>
        <div class="buxa-config-row-actions">
          <button type="button" data-action="moveProficiencyUp" title="Move up">↑</button>
          <button type="button" data-action="moveProficiencyDown" title="Move down">↓</button>
          <button type="button" data-action="removeProficiency" title="Remove">×</button>
        </div>
      </div>
      ${iconControlHtml("proficiency", proficiency)}
      <div class="buxa-proficiency-attribute-options">
        <label><span>+1 MOD every</span><input data-proficiency-modifier-every type="number" min="1" step="1" value="${proficiency.modifierEveryPoints ?? 1}"></label>
        <label class="buxa-config-toggle compact"><input data-proficiency-feature-dice type="checkbox" ${features.dice !== false ? "checked" : ""}><span><strong>d20 roll</strong></span></label>
        <label class="buxa-config-toggle compact"><input data-proficiency-feature-reroll type="checkbox" ${features.reroll !== false ? "checked" : ""}><span><strong>Roll modes</strong></span></label>
        <label class="buxa-config-toggle compact"><input data-proficiency-feature-number type="checkbox" ${features.number !== false ? "checked" : ""}><span><strong>Number</strong></span></label>
        <label class="buxa-config-toggle compact"><input data-proficiency-feature-modifier type="checkbox" ${features.modifier !== false ? "checked" : ""}><span><strong>Modifier</strong></span></label>
      </div>
    </article>`;
}
