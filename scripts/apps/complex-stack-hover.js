import { canStackItems } from '../core/item-runtime.js';
import { pointerCellIndex, stackTargetAtPointer } from '../core/complex-stack-target.js';

/** One short-lived drag session. No listeners, flags or repeated DOM scans. */
export function createComplexStackHover({ actor, sourceId, config, scanner, getGeometry, getCells, getGhost }) {
  const compatible = new Map();
  let highlighted = null;
  let highlightedIndex = null;
  let activeTarget = null;

  const cellAt = (x, y) => pointerCellIndex(getGeometry(), x, y);
  const canMerge = targetId => {
    if (!compatible.has(targetId)) {
      const source = actor.items?.get?.(sourceId);
      const target = actor.items?.get?.(targetId);
      compatible.set(targetId, Boolean(source && target && canStackItems(source, target, config)));
    }
    return compatible.get(targetId);
  };
  const targetAt = (x, y) => stackTargetAtPointer(scanner.occupied, sourceId, cellAt(x, y), canMerge);
  const highlight = (targetId, cellIndex) => {
    if (targetId === activeTarget && cellIndex === highlightedIndex) return;
    highlighted?.classList.remove('is-complex-stack-target');
    highlighted = null;
    highlightedIndex = cellIndex;
    activeTarget = targetId;
    if (targetId && Number.isInteger(cellIndex)) {
      highlighted = getCells()?.[cellIndex] ?? null;
      highlighted?.classList.add('is-complex-stack-target');
    }
    getGhost()?.classList.toggle('is-stack-target', Boolean(targetId));
  };
  const clear = () => {
    highlighted?.classList.remove('is-complex-stack-target');
    highlighted = null;
    activeTarget = null;
    highlightedIndex = null;
    compatible.clear();
  };
  return { cellAt, targetAt, highlight, clear };
}
