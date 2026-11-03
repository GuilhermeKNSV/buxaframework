import { BuxaSvgPicker } from "./svg-picker.js";

const ICON_ROW_SELECTORS = Object.freeze({
  resource: { row: "[data-resource-row]", path: "[data-resource-icon-path]", enabled: "[data-resource-icon-enabled]" },
  attribute: { row: "[data-attribute-row]", path: "[data-attribute-icon-path]", enabled: "[data-attribute-icon-enabled]" },
  proficiency: { row: "[data-proficiency-config-row]", path: "[data-proficiency-icon-path]", enabled: "[data-proficiency-icon-enabled]" }
});

function updatePreview(control, path) {
  const preview = control?.querySelector?.("[data-icon-preview]");
  if (!preview) return;
  preview.replaceChildren();
  preview.classList.toggle("is-empty", !path);
  if (!path) return;
  const img = preview.ownerDocument.createElement("img");
  img.src = path;
  img.alt = "";
  preview.append(img);
}

export function openEntrySvgPicker(app, target) {
  const selectors = ICON_ROW_SELECTORS[target?.dataset?.iconKind];
  if (!selectors) return;
  const row = target.closest(selectors.row);
  const control = target.closest("[data-entry-icon-control]");
  const input = row?.querySelector?.(selectors.path);
  const enabled = row?.querySelector?.(selectors.enabled);
  if (!row || !control || !input) return;

  new BuxaSvgPicker({
    current: input.value,
    onSelect: async (path) => {
      input.value = path;
      if (enabled) enabled.checked = Boolean(path);
      updatePreview(control, path);
    }
  }).render({ force: true });
}
