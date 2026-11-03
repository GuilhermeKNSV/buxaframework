import { getInventoryState, getActorStorage } from "../core/inventory.js";
import { setStorageOpen } from "../core/storage-open-state.js";
import { patchActorUiState } from "../core/ui-state.js";

/** Locate the exact embedded item used by a source (never find by name). */
export function sourceInventoryTarget(root, itemId) {
  if (!itemId) return null;
  return [...(root?.querySelectorAll?.("[data-item-id]") ?? [])]
    .find((node) => node.dataset.itemId === itemId && !node.closest("[hidden]")) ?? null;
}

export async function revealSourceItem(sheet, itemId) {
  if (!sheet?.actor?.items?.get?.(itemId)) return false;
  sheet._activeTab = "inventory";
  sheet.activateInventoryTab?.();
  try { await patchActorUiState(sheet.actor, { activeTab: "inventory" }); } catch (_error) { /* Never block navigation. */ }
  let item = sourceInventoryTarget(sheet.element, itemId);
  if (!item) {
    // Switching equipment tabs changes only presentation state, not the active loadout.
    const hiddenItem = [...(sheet.element?.querySelectorAll?.("[data-item-id]") ?? [])]
      .find((node) => node.dataset.itemId === itemId && node.closest?.("[data-equipment-tab-panel]"));
    const panel = hiddenItem?.closest?.("[data-equipment-tab-panel]");
    const tabId = panel?.dataset?.equipmentTabPanel;
    const tab = tabId && [...(sheet.element?.querySelectorAll?.("[data-equipment-tab]") ?? [])]
      .find((node) => node.dataset.equipmentTab === tabId);
    if (tab) {
      tab.click();
      item = sourceInventoryTarget(sheet.element, itemId);
    }
  }
  if (!item) {
    const placement = getInventoryState(sheet.actor).placements[itemId];
    if (placement?.area === "storage") {
      // Find the provider for a closed pouch; leave saved gameplay data alone.
      const bag = getActorStorage(sheet.actor).compartments.find((entry) => entry.storageId === placement.storageId);
      if (bag?.providerId) setStorageOpen(sheet.actor, bag.providerId, true);
    }
    await sheet.render({ force: true });
    sheet.activateInventoryTab?.();
    item = sourceInventoryTarget(sheet.element, itemId);
  }
  if (!item) return false;
  item.scrollIntoView?.({ behavior: "smooth", block: "center", inline: "nearest" });
  item.classList.remove("buxa-source-item-flash");
  // Force a restart if the same source is clicked twice.
  void item.offsetWidth;
  item.classList.add("buxa-source-item-flash");
  item.ownerDocument?.defaultView?.setTimeout?.(() => item.classList.remove("buxa-source-item-flash"), 1150);
  return true;
}

export function bindSourceItemNavigation(sheet) {
  sheet.element?.querySelectorAll?.("[data-source-item-id]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void revealSourceItem(sheet, button.dataset.sourceItemId);
    });
  });
}
