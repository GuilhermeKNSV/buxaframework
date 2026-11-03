/**
 * Geometric, aspect-ratio-preserving enlargement for elongated equipment slots.
 * We never stretch an image on a single axis. Instead, elongated slots can ask
 * the artwork to scale along the slot's dominant axis while preserving the
 * image aspect ratio, allowing the slot to clip excess transparent margins.
 */
export function shouldEnlargeEquipmentArtwork(slotType, item) {
  if (!item) return false;
  const cells = item.shape?.cells;
  if (Array.isArray(cells) && cells.length > 1) {
    const xs = cells.map(cell => Number(cell.x) || 0);
    const ys = cells.map(cell => Number(cell.y) || 0);
    const width = Math.max(...xs) - Math.min(...xs) + 1;
    const height = Math.max(...ys) - Math.min(...ys) + 1;
    if (Math.max(width, height) / Math.min(width, height) >= 1.4) return true;
  }
  if (String(item.type || '').toLowerCase() === 'weapon') return true;
  return slotType === 'weapon' && !item.showQuantity;
}

export function equipmentArtworkZoom(width, height) {
  const w = Number(width);
  const h = Number(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return 1;
  const elongation = Math.max(w, h) / Math.min(w, h);
  if (elongation <= 1.15) return 1;
  return Math.round(Math.min(1.8, 1 + (elongation - 1) * 0.4) * 100) / 100;
}

export function equipmentArtworkFit(width, height, enlarge = false) {
  const w = Number(width);
  const h = Number(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return {
      zoom: 1,
      width: '100%',
      height: '100%',
      fit: 'contain'
    };
  }

  const tall = h > w * 1.15;
  const wide = w > h * 1.15;
  const zoom = enlarge ? equipmentArtworkZoom(w, h) : 1;

  if (tall) {
    return {
      zoom,
      width: 'auto',
      height: zoom > 1 ? `calc(100% * ${zoom})` : '100%',
      fit: 'contain'
    };
  }

  if (wide) {
    return {
      zoom,
      width: zoom > 1 ? `calc(100% * ${zoom})` : '100%',
      height: 'auto',
      fit: 'contain'
    };
  }

  return {
    zoom,
    width: '100%',
    height: '100%',
    fit: 'contain'
  };
}
