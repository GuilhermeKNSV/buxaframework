import { getSheetConfig } from "../core/config.js";
import { getItemRules } from "../core/item-config.js";
import { changeDiscoveryState, ITEM_VISIBILITY_LABELS } from "../core/item-discovery.js";
import { saveItemRules } from "../core/item-runtime.js";
import { reconcileInventoryState } from "../core/inventory.js";

/** Bind GM control inside item configuration (never on the player-facing sheet). */
export function bindItemControl(root, { item, onSave } = {}) {
  if (!root || !item) return;
  let busy = false;
  root.querySelector("[data-item-config-panel=control]")?.addEventListener("click", async (event) => {
      const button = event.target.closest?.("[data-item-control-set]");
      if (!button || !game.user.isGM || busy) return;
      event.preventDefault();
      const card = button.closest("[data-item-control-entry]");
      const kind = card?.dataset.kind;
      const id = card?.dataset.entryId;
      const visibility = button.dataset.visibility;
      if (!kind || !id || !visibility || button.classList.contains("is-active")) return;
      busy = true;
      const buttons = [...card.querySelectorAll("[data-item-control-set]")];
      buttons.forEach((entry) => { entry.disabled = true; });
      try {
        const config = getSheetConfig();
        const current = getItemRules(item, config);
        const changed = changeDiscoveryState(current, kind, id, visibility, config.items?.rarities?.map((entry) => entry.id) || []);
        if (!changed) throw new Error("This field no longer exists. Save your changes and reopen Control.");
        await saveItemRules(item, { ...changed, name: item.name, img: item.img }, config);
        if (item.parent?.documentName === "Actor") await reconcileInventoryState(item.parent, config);
        // Keep the form synchronized so a subsequent Save won't undo the GM action.
        const selector = kind === "description" ? `[data-item-description-part][data-description-id="${id}"] [data-description-visibility]`
          : kind === "dice" ? `[data-item-dice-row][data-dice-id="${id}"] [data-item-entry-visibility]`
          : `[data-item-increase-row][data-increase-id="${id}"] [data-item-entry-visibility]`;
        const field = root.querySelector(selector);
        if (field) field.value = visibility;
        const rarity = root.querySelector("[data-item-rarity]");
        if (rarity && changed.rarityId !== current.rarityId) rarity.value = changed.rarityId;
        card.classList.remove("buxa-control-revealed", "buxa-control-locked", "buxa-control-hidden", "buxa-control-dmOnly");
        card.classList.add(`buxa-control-${visibility}`);
        const status = card.querySelector("[data-item-control-status]");
        if (status) status.textContent = ITEM_VISIBILITY_LABELS[visibility];
        buttons.forEach((entry) => {
          const active = entry.dataset.visibility === visibility;
          entry.classList.toggle("is-active", active);
          entry.setAttribute("aria-pressed", active ? "true" : "false");
        });
        await onSave?.(item);
      } catch (error) {
        console.error("Buxa | Could not update discovery control", error);
        ui.notifications?.error?.(error?.message || "Could not update item discovery state.");
      } finally {
        buttons.forEach((entry) => { entry.disabled = false; });
        busy = false;
      }
    });

}
