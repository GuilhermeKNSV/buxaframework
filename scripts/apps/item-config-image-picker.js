/** Asset selection for the item editor. Kept separate from rules/form parsing. */
import { BuxaAssetBrowser } from "./asset-browser.js";

export async function browseItemImage(app) {
  const input = app.element?.querySelector?.("[data-item-image]");
  if (!input) return;
  const picker = new BuxaAssetBrowser({
    type: "image",
    current: input.value || "",
    title: `Buxa · ${app.item?.name || "Item"} Image`,
    onSelect: async path => {
      if (!path) return;
      // The editor may have rerendered while the picker was open. Apply to
      // the current input, not a detached element that will never be saved.
      const current = app.element?.querySelector?.('[data-item-image]');
      if (!current?.isConnected) return;
      current.value = path;
      const preview = app.element?.querySelector?.("[data-item-image-preview]");
      if (preview) preview.src = path;
      const EventClass = current.ownerDocument?.defaultView?.Event ?? Event;
      current.dispatchEvent(new EventClass("change", { bubbles: true }));
    }
  });
  await picker.render({ force: true });
}
