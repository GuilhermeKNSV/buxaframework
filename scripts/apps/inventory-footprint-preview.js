/**
 * Lightweight complex-inventory drop overlay. Every highlighted cell is one
 * occupied tile of the *rotated* item, never just the cursor's grid square.
 * Geometry is pure; the DOM adapter only updates cells whose state changed.
 */
export function projectFootprint(index, cells, columns, rows) {
  if (!Number.isInteger(index) || !Number.isInteger(columns) || !Number.isInteger(rows)
      || index < 0 || columns < 1 || rows < 1 || index >= columns * rows) {
    return { indexes: [], fitsBounds: false };
  }
  const originX = index % columns;
  const originY = Math.floor(index / columns);
  const indexes = [];
  let fitsBounds = true;
  for (const { x, y } of cells || []) {
    const cx = originX + x;
    const cy = originY + y;
    if (cx < 0 || cy < 0 || cx >= columns || cy >= rows) {
      fitsBounds = false;
      continue;
    }
    indexes.push(cy * columns + cx);
  }
  return { indexes, fitsBounds };
}

export class InventoryFootprintPreview {
  constructor(board, scanner, itemId) {
    this.board = board;
    this.scanner = scanner;
    this.itemId = itemId;
    this.cells = [...board.querySelectorAll('.buxa-complex-cell')];
    this.active = new Map();
    this.key = '';
    this.valid = false;
    board.classList.add('is-footprint-preview-active');
  }

  update(index, rotation) {
    const key = `${index ?? 'none'}:${rotation}`;
    if (key === this.key) return this.valid;
    this.key = key;
    const { columns, rows, occupied } = this.scanner;
    const footprint = projectFootprint(index, index == null ? [] : this.scanner.cellsFor(this.itemId, rotation), columns, rows);
    const valid = footprint.fitsBounds && this.scanner.fits(this.itemId, index, rotation);
    const next = new Map();
    for (const position of footprint.indexes) {
      const status = valid ? 'is-footprint-valid' : occupied.has(position) ? 'is-footprint-collision' : 'is-footprint-invalid';
      next.set(position, status);
    }
    for (const [position, status] of this.active) {
      if (next.get(position) !== status) this.cells[position]?.classList.remove(status);
    }
    for (const [position, status] of next) {
      if (this.active.get(position) !== status) this.cells[position]?.classList.add(status);
    }
    this.active = next;
    this.valid = valid;
    return valid;
  }

  clear() {
    for (const [position, status] of this.active) this.cells[position]?.classList.remove(status);
    this.active.clear();
    this.key = '';
    this.valid = false;
  }

  destroy() {
    this.clear();
    this.board.classList.remove('is-footprint-preview-active');
  }
}
