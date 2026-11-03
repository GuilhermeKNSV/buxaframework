import { getItemQuantity } from "../core/dnd5e.js";

// One lightweight popup per document. Selecting a different stack dismisses the
// previous picker rather than leaving multiple floating controls on the canvas.
const activePickers = new WeakMap();

export function isValidSplitQuantity(value, max) {
  if (typeof value !== "string" && typeof value !== "number") return false;
  const input = String(value).trim();
  if (!/^\d+$/.test(input)) return false;
  const number = Number(input);
  return Number.isSafeInteger(number) && number >= 1 && number <= max;
}

/** Keep a fixed-position popup beside the clicked action, within the viewport. */
export function positionSplitPopover({ x = 0, y = 0, width, height, viewportWidth, viewportHeight, gap = 9 }) {
  const vw = Math.max(0, Number(viewportWidth) || 0);
  const vh = Math.max(0, Number(viewportHeight) || 0);
  const w = Math.max(0, Number(width) || 0);
  const h = Math.max(0, Number(height) || 0);
  const left = (x + gap + w <= vw - gap) ? x + gap : x - w - gap;
  return {
    left: Math.round(Math.min(Math.max(gap, left), Math.max(gap, vw - w - gap))),
    top: Math.round(Math.min(Math.max(gap, y - h / 2), Math.max(gap, vh - h - gap)))
  };
}

/**
 * A tiny NON-modal, fixed-position split quantity popup. No backdrop or focus
 * trap; the player can interact with the sheet as normal. Returns null if
 * dismissed, or the quantity requested for a newly created stack.
 */
export function promptUnstackAmount(item, { ownerDocument = document, anchor = null } = {}) {
  const quantity = Math.floor(getItemQuantity(item));
  if (quantity < 2) return Promise.resolve(null);
  const max = quantity - 1;
  const doc = ownerDocument;
  const view = doc.defaultView;
  // Close any existing popup before creating a new one.
  activePickers.get(doc)?.();

  const popup = doc.createElement("div");
  popup.className = "buxa-unstack-popover";
  popup.setAttribute("role", "dialog");
  popup.setAttribute("aria-label", "Split stack");
  popup.innerHTML = `
    <form class="buxa-unstack-form" aria-label="Split stack">
      <button type="button" data-unstack-minus aria-label="Decrease quantity" title="Decrease"><i class="fa-solid fa-minus" aria-hidden="true"></i></button>
      <input data-unstack-number type="number" min="1" step="1" inputmode="numeric" aria-label="Quantity to split" required>
      <button type="button" data-unstack-plus aria-label="Increase quantity" title="Increase"><i class="fa-solid fa-plus" aria-hidden="true"></i></button>
      <button type="submit" data-unstack-submit aria-label="Split stack" title="Split stack"><i class="fa-solid fa-layer-group" aria-hidden="true"></i></button>
    </form>`;

  const input = popup.querySelector("[data-unstack-number]");
  const submit = popup.querySelector("[data-unstack-submit]");
  input.max = String(max);
  input.value = String(Math.max(1, Math.floor(quantity / 2)));
  const validate = () => { submit.disabled = !isValidSplitQuantity(input.value, max); };
  const setAmount = (value) => {
    input.value = String(Math.min(max, Math.max(1, Math.round(Number(value) || 1))));
    validate();
  };
  input.addEventListener("input", validate);
  input.addEventListener("change", validate);
  popup.querySelector("[data-unstack-minus]").addEventListener("click", () => setAmount(Number(input.value) - 1));
  popup.querySelector("[data-unstack-plus]").addEventListener("click", () => setAmount(Number(input.value) + 1));

  return new Promise((resolve) => {
    let finished = false;
    const cleanup = (result = null) => {
      if (finished) return;
      finished = true;
      doc.removeEventListener("pointerdown", onOutside, true);
      doc.removeEventListener("keydown", onKey, true);
      view?.removeEventListener("resize", onViewportChange);
      view?.removeEventListener("scroll", onViewportChange, true);
      popup.remove();
      if (activePickers.get(doc) === cleanup) activePickers.delete(doc);
      resolve(result);
    };
    const onOutside = (event) => { if (!popup.contains(event.target)) cleanup(); };
    const onKey = (event) => { if (event.key === "Escape") { event.preventDefault(); cleanup(); } };
    const onViewportChange = () => cleanup();
    popup.querySelector("form").addEventListener("submit", (event) => {
      event.preventDefault();
      if (!isValidSplitQuantity(input.value, max)) { input.focus(); return; }
      cleanup(Number(input.value));
    });

    doc.body.append(popup);
    activePickers.set(doc, cleanup);
    const bounds = popup.getBoundingClientRect();
    const viewportWidth = view?.innerWidth ?? doc.documentElement.clientWidth;
    const viewportHeight = view?.innerHeight ?? doc.documentElement.clientHeight;
    // A keyboard-activated button has 0/0 coordinates; use its bounding box.
    const fallback = anchor?.rect;
    const x = Number(anchor?.x) > 0 ? anchor.x : (fallback?.right ?? viewportWidth / 2);
    const y = Number(anchor?.y) > 0 ? anchor.y : (fallback?.top ?? viewportHeight / 2);
    const pos = positionSplitPopover({ x, y, width: bounds.width, height: bounds.height, viewportWidth, viewportHeight });
    popup.style.left = `${pos.left}px`;
    popup.style.top = `${pos.top}px`;
    doc.addEventListener("pointerdown", onOutside, true);
    doc.addEventListener("keydown", onKey, true);
    view?.addEventListener("resize", onViewportChange);
    view?.addEventListener("scroll", onViewportChange, true);
    input.focus();
    input.select();
  });
}
