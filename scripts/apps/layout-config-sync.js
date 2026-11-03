/** Configuration UI synchronization and sheet refresh routines. */
import { MODULE_ID } from "../core/constants.js";
import { reconcileInventoryState } from "../core/inventory.js";
import { BuxaPlayerSheet } from "./player-sheet.js";
import { value } from "./layout-config-helpers.js";

export function refreshOpenBuxaSheets() {
  try {
    for (const app of foundry.applications.sheets.ActorSheetV2.instances?.() ?? []) {
      if (app instanceof BuxaPlayerSheet && app.rendered) void app.render({ force: true });
    }
  } catch (_error) {
    // Non-critical: sheets naturally refresh on their next render/update.
  }
}
export async function reconcileConfiguredInventories(config) {
  if (!game.user.isGM) return;
  for (const actor of game.actors ?? []) {
    if (!actor?.isOwner || !actor.getFlag?.(MODULE_ID, "inventory")) continue;
    try {
      await reconcileInventoryState(actor, config);
    } catch (error) {
      console.warn(`${MODULE_ID} | Could not reconcile inventory for ${actor.name}.`, error);
    }
  }
}
export function replaceSelectOptions(select, items, { allowNone = false, noneLabel = "Choose..." } = {}) {
  if (!select) return;
  const selected = select.value;
  select.replaceChildren();
  if (allowNone) {
    const option = select.ownerDocument.createElement("option");
    option.value = "";
    option.textContent = noneLabel;
    select.append(option);
  }
  for (const item of items) {
    const option = select.ownerDocument.createElement("option");
    option.value = item.id;
    option.textContent = item.label;
    select.append(option);
  }
  const valid = [...select.options].some((option) => option.value === selected);
  if (valid) select.value = selected;
}
export function syncStatsChoices(app) {
  const root = app?.element;
  if (!root) return;
  const resources = [...root.querySelectorAll("[data-resource-row]")].map((row) => ({
    id: row.dataset.resourceId,
    label: value(row, "[data-resource-label]", "RESOURCE").trim() || "RESOURCE"
  }));
  const attributes = [...root.querySelectorAll("[data-attribute-row]")].map((row) => ({
    id: row.dataset.attributeId,
    label: value(row, "[data-attribute-label]", "ATTRIBUTE").trim() || "ATTRIBUTE"
  }));
  replaceSelectOptions(root.querySelector("[data-dr-resource]"), resources);
  replaceSelectOptions(root.querySelector("[data-initiative-attribute]"), attributes, {
    allowNone: true,
    noneLabel: "Choose an attribute"
  });
  for (const select of root.querySelectorAll("[data-proficiency-attribute]")) {
    replaceSelectOptions(select, attributes, { allowNone: true, noneLabel: "None" });
  }
}
export function syncProficiencyModeUi(app) {
  const root = app?.element;
  if (!root) return;
  const attributeMode = value(root, "[data-proficiencies-mode]", "modifier") === "attribute";
  root.querySelectorAll(".buxa-proficiency-attribute-options").forEach((element) => {
    element.hidden = !attributeMode;
  });
}
