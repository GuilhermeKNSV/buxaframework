/** A shaped inventory item becomes a small, square visual while hovering
 * equipment. This affects only its drag ghost, not its saved footprint. */
export function isEquipmentGhostRegion(target, destination) {
  return destination?.area === 'equipment' || Boolean(target?.closest?.('.buxa-equipment-section'));
}
export function equipmentGhostCellSize(root, fallback = 56) {
  const rect = root?.querySelector?.('[data-inventory-index]')?.getBoundingClientRect?.();
  const size = Math.min(Number(rect?.width), Number(rect?.height));
  return Number.isFinite(size) && size >= 12 ? Math.min(64, Math.max(32, size)) : fallback;
}
/** Return updated pointer offsets or null when the mode did not change.
 * restoreShape re-renders the normal masked footprint after leaving equipment. */
export function setEquipmentGhostMode(ghost, {
  compact, image, cellSize = 56, restoreShape, fallbackSize = 56
} = {}) {
  if (!ghost) return null;
  const already = ghost.classList.contains('is-equipment-ghost');
  if (already === Boolean(compact)) return null;
  if (compact) {
    const size = Number.isFinite(cellSize) && cellSize > 0 ? cellSize : fallbackSize;
    ghost.classList.remove('is-complex-ghost', 'is-rectangular-shape', 'is-merge-hover');
    ghost.classList.add('is-equipment-ghost');
    ghost.classList.remove('is-invalid');
    ghost.style.width = `${size}px`;
    ghost.style.height = `${size}px`;
    ghost.style.aspectRatio = '1 / 1';
    ghost.replaceChildren();
    if (image) {
      const img = ghost.ownerDocument.createElement('img');
      img.src = image;
      img.alt = '';
      img.draggable = false;
      ghost.append(img);
    }
    return {offsetX:size/2,offsetY:size/2};
  }
  ghost.classList.remove('is-equipment-ghost');
  if (typeof restoreShape === 'function') return restoreShape() || null;
  return null;
}

/** Switch visuals only on crossing the equipment boundary, preserving the
 * logical grabbed cell / rotation used to commit actual grid placements. */
export function transitionEquipmentDragGhost({ghost, target, destination, image, cellSize,
  shaped=false, renderShape=null, currentOffsets=()=>({offsetX:cellSize/2,offsetY:cellSize/2})}) {
  const equipmentGhost=isEquipmentGhostRegion(target,destination);
  const changed=setEquipmentGhostMode(ghost,{
    compact:equipmentGhost,image,cellSize,
    restoreShape:()=>{
      if(shaped && renderShape) {
        renderShape();
        return currentOffsets();
      }
      ghost.style.width=`${cellSize}px`;
      ghost.style.height=`${cellSize}px`;
      ghost.replaceChildren();
      if(image) {
        const img=ghost.ownerDocument.createElement('img');
        img.src=image;img.alt='';img.draggable=false;ghost.append(img);
      }
      return {offsetX:cellSize/2,offsetY:cellSize/2};
    }
  });
  return {equipmentGhost,changed};
}
