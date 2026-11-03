/** Small, testable adapter for storage drops in both Simple and Complex
 * inventory. Avoid expanding the pointer controller with storage rules. */
import { resolveAutomaticStorageDrop } from '../core/external-storage-placement.js';
import { fitsExternalStorage } from '../core/item-storage.js';
import { getActorStorage, getInventoryState } from '../core/inventory.js';
import { normalizeItemShape } from '../core/inventory-shapes.js';

/** Shape lookup for mixed-mode pouch drops, computed lazily per pointer drag. */
export function storageDragShapes(actor) {
  return Object.fromEntries([...(actor?.items ?? [])].map(item => [
    item.id, normalizeItemShape(item.getFlag?.('buxaframework', 'item')?.shape)
  ]));
}

export function pointerStorageDestination(destination, itemId, getGrants, getState, getShapes) {
  if (destination?.area !== 'storage' || destination.auto !== true) return destination;
  const resolved = resolveAutomaticStorageDrop(destination, {
    compartments: getGrants().compartments,
    placements: getState().placements,
    shapes: getShapes(), itemId
  });
  return resolved || { ...destination, index: -1, containerDrop: true };
}

export function canDropIntoStorage(actor, destination, itemId, config, knownShapes = null) {
  if (destination?.area !== 'storage') return false;
  const compartment = getActorStorage(actor, config).compartments.find(bag => bag.storageId === destination.storageId);
  const shapes = knownShapes || Object.fromEntries([...actor.items].map(item =>
    [item.id, normalizeItemShape(item.getFlag?.('buxaframework', 'item')?.shape)]));
  return fitsExternalStorage(compartment, getInventoryState(actor, config).placements,
    shapes, itemId, destination.index, destination.rotation || 0);
}
