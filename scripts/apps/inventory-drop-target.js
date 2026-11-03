import { measureComplexBoard } from "../core/complex-drag-geometry.js";
/** Pure hit testing for simple/equipment and shaped inventory drops.
 * No Foundry API usage; shared by pointer and native drop paths. */
export function getInventoryDropDestination(event) {
  const target = event?.target;
  if (!target || typeof target.closest !== "function") return null;
  const storageBoard=target.closest('[data-storage-board]');
  if(storageBoard && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
    const rect=storageBoard.getBoundingClientRect();
    const columns=Number(storageBoard.style.getPropertyValue('--buxa-storage-columns'))||4;
    const rows=Number(storageBoard.style.getPropertyValue('--buxa-storage-rows'))||4;
    const cell=rect.width/columns,cellHeight=rect.height/rows;
    const x=Math.floor((event.clientX-rect.left)/cell);
    const y=Math.floor((event.clientY-rect.top)/cellHeight);
    if(x>=0&&y>=0&&x<columns&&y<rows)return {area:'storage',storageId:storageBoard.dataset.storageBoard,index:y*columns+x};
    return null;
  }
  // The entire backpack card is a drop target, including its header and
  // narrow padding. If no particular cell is under the pointer, the transfer
  // picks the first valid slot INSIDE that backpack, never main inventory.
  const compartment=target.closest('.buxa-storage-compartment[data-storage-id]');
  if(compartment && !target.closest('[data-storage-board]'))
    return {area:'storage',storageId:compartment.dataset.storageId,index:0,auto:true};
  const board = target.closest('[data-complex-board]');
  if (board && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
    const grid = measureComplexBoard(board);
    if (!grid) return null;
    // Native drops share the same real cell rectangles as pointer dragging.
    const px=Number.isFinite(event.anchorX)?event.anchorX:event.clientX;
    const py=Number.isFinite(event.anchorY)?event.anchorY:event.clientY;
    const x=Math.floor((px-grid.left)/grid.cellSize);
    const y=Math.floor((py-grid.top)/grid.cellHeight);
    if(x>=0&&x<grid.columns&&y>=0&&y<grid.rows)return {area:'inventory',index:y*grid.columns+x};
    // Never fall back to the hovered single square if the multi-cell item's
    // upper-left origin is outside the board. That would shift the drop.
    return null;
  }
  const position = target.closest("[data-equipment-position]");
  const equipment = target.closest("[data-equipment-slot]");
  if (equipment) {
    const destination = { area: "equipment", slotId: equipment.dataset.equipmentSlot };
    if (position) destination.position = Number(position.dataset.equipmentPosition);
    return destination;
  }
  const storage=target.closest('[data-storage-index]');
  if(storage)return {area:'storage',storageId:storage.dataset.storageId,index:Number(storage.dataset.storageIndex)};
  const inventory = target.closest("[data-inventory-index]");
  if (inventory) return { area: "inventory", index: Number(inventory.dataset.inventoryIndex) };
  return null;
}

export function getInventoryDropTargetItemId(event) {
  const target = event?.target;
  if (!target || typeof target.closest !== "function") return null;
  return target.closest("[data-item-id]")?.dataset?.itemId
    || target.closest("[data-hit-item-id]")?.dataset?.hitItemId
    || null;
}


/** An occupied Simple pouch cell may accept a compatible stack even though
 * ordinary placement collision rules reject its occupied coordinate. */
export function compatibleStorageStackTarget(destination, pointerTarget, actor, sourceId,
  placements = {}, config = null, canStack = () => false) {
  if (destination?.area !== 'storage' || !actor?.items?.get) return null;
  const hoveredId = pointerTarget?.closest?.('[data-item-id]')?.dataset?.itemId
    || pointerTarget?.closest?.('[data-hit-item-id]')?.dataset?.hitItemId;
  if (!hoveredId || hoveredId === sourceId) return null;
  const placement = placements[hoveredId];
  if (placement?.area !== 'storage' || placement.storageId !== destination.storageId) return null;
  const source = actor.items.get(sourceId), target = actor.items.get(hoveredId);
  return source && target && canStack(source, target, config) ? hoveredId : null;
}
