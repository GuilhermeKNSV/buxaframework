/** Convert the pointer preview between a one-slot pouch and the original
 * irregular footprint. Visual-only: never writes shape, rotation or Item flags. */
export function transitionStorageOccupancyGhost({ghost, destination, compartments,
  image='', cellSize=58, shaped=false, restoreShape=null, offsets=()=>({offsetX:29,offsetY:29})}={}) {
  if (!ghost) return null;
  const bag=destination?.area==='storage' ? compartments?.find(c=>c.storageId===destination.storageId) : null;
  const compact=bag?.itemMode==='simple';
  const wasCompact=ghost.classList.contains('is-simple-storage-ghost');
  if (compact && !ghost.classList.contains('is-equipment-ghost')) {
    if (wasCompact) return null;
    ghost.classList.remove('is-complex-ghost','is-rectangular-shape','is-merge-hover');
    ghost.classList.add('is-simple-storage-ghost');
    ghost.style.width=`${cellSize}px`;
    ghost.style.height=`${cellSize}px`;
    ghost.style.aspectRatio='1 / 1';
    ghost.replaceChildren();
    if (image) {
      const img=ghost.ownerDocument.createElement('img');
      img.src=image;img.alt='';img.draggable=false;ghost.append(img);
    }
    return {offsetX:cellSize/2,offsetY:cellSize/2};
  }
  if (!wasCompact) return null;
  ghost.classList.remove('is-simple-storage-ghost');
  if (ghost.classList.contains('is-equipment-ghost'))return null;
  if (shaped && typeof restoreShape==='function') {
    restoreShape();
    return offsets();
  }
  ghost.style.width=`${cellSize}px`;
  ghost.style.height=`${cellSize}px`;
  ghost.style.aspectRatio='1 / 1';
  ghost.replaceChildren();
  if (image) {
    const img=ghost.ownerDocument.createElement('img');
    img.src=image;img.alt='';img.draggable=false;ghost.append(img);
  }
  return {offsetX:cellSize/2,offsetY:cellSize/2};
}
