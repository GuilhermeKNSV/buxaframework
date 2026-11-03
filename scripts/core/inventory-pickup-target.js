/** An equipped Item is not inside the grid, even when the sheet contains a
 * separate inventory grid. Only the actual item's closest ancestor grid may
 * reject pickup in a transparent cell of an irregular footprint. */
export function inventoryPickupBoard(element) {
  return element?.closest?.('[data-storage-board]') || element?.closest?.('[data-complex-board]') || null;
}

/** Simple compartment items occupy one tile regardless of their configured
 * Complex artwork footprint. The tile itself already owns pointerdown, so
 * never require a data-complex-index / transparent shape cell to pick it up. */
export function simpleStoragePickupCell(element, board) {
  if (!board || !board.matches?.('[data-storage-board]') || board.classList?.contains?.('is-complex')) return null;
  const cell = element?.closest?.('[data-storage-index]');
  return cell?.closest?.('[data-storage-board]') === board ? { x: 0, y: 0 } : null;
}
