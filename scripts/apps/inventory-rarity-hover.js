/** Hover state for Complex inventory/pouches.
 * Their artwork is intentionally pointer-transparent: the authoritative
 * occupied-cell hit map (not the rectangular artwork) owns hover targeting.
 * The event delegation only changes classes when the hovered item changes;
 * it never touches Actor data or triggers a sheet render.
 */
const boardHoverClear = new WeakMap();

/** Release only the active board's pointer highlight after an actual drag. */
export function clearComplexRarityHover(board) {
  boardHoverClear.get(board)?.();
}

export function bindComplexRarityHover(board, resolveHit) {
  if (!board?.addEventListener || typeof resolveHit !== "function") return;
  const itemElements = new Map();
  for (const item of board.querySelectorAll?.('[data-complex-item][data-item-id]') ?? []) {
    if (item.dataset.itemId) itemElements.set(item.dataset.itemId, item);
  }
  const cellSelector = board.matches?.('[data-storage-board]')
    ? '[data-storage-index]'
    : '[data-inventory-index]';
  let current = null;
  let lastTarget = null;

  function setHovered(itemId) {
    const next = itemElements.get(itemId) ?? null;
    if (next === current) return;
    current?.classList.remove('is-rarity-hovered');
    current = next;
    current?.classList.add('is-rarity-hovered');
  }

  boardHoverClear.set(board, () => {
    lastTarget = null;
    setHovered(null);
  });

  function update(event) {
    if (event.pointerType === 'touch' || board.ownerDocument?.body?.classList?.contains('buxa-inventory-pointer-dragging')) {
      setHovered(null);
      return;
    }
    const cell = event.target?.closest?.(cellSelector);
    // The cell map is cheaper and more reliable than artwork hit testing.
    // Fall back to shared geometry when a transparent overlay is the target.
    const itemId = cell && board.contains?.(cell)
      ? cell.dataset.hitItemId
      : resolveHit(event)?.itemId;
    setHovered(itemId);
  }

  board.addEventListener('pointerover', event => {
    lastTarget = event.target;
    update(event);
  });
  board.addEventListener('pointermove', event => {
    if (event.target === lastTarget) return;
    lastTarget = event.target;
    update(event);
  });
  board.addEventListener('pointerleave', () => {
    lastTarget = null;
    setHovered(null);
  });
  // A press is not yet a drag. Keep the hover color until the pointer
  // crosses the movement threshold; the drag controller then clears it.
  board.addEventListener('pointercancel', () => {
    lastTarget = null;
    setHovered(null);
  });
}


/** Copy the *resolved* item rarity into its pointer ghost before insertion.
 * A ghost lives under <body>, outside the sheet's inherited CSS variables.
 * Reading once on drag start also avoids transitional default/red flashes.
 * The actual item colors are never changed or persisted. */
export function applyDragRarityFeedback(ghost, item, view) {
  if (!ghost || !item) return;
  const computed = typeof view?.getComputedStyle === "function" ? view.getComputedStyle(item) : null;
  const properties = ["--buxa-rarity-color", "--buxa-rarity-accent",
    "--buxa-rarity-bg-opacity", "--buxa-rarity-bg-brightness"];
  for (const name of properties) {
    const value = (computed?.getPropertyValue?.(name) || item.style?.getPropertyValue?.(name) || "").trim();
    if (value) ghost.style?.setProperty?.(name, value);
  }
  ghost.classList?.add?.("is-rarity-dragging");
}
