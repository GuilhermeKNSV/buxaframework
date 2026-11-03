/** Hit-test an actual PIXI Token from a pointer on Foundry's rendered canvas.
 * Do not depend on controlToken: a GM can choose an already-controlled token. */
export function tokenAtHotbarPointer(clientX, clientY, canvasRef = globalThis.canvas) {
  if (!canvasRef?.ready) return null;
  const view = canvasRef?.app?.renderer?.canvas ?? canvasRef?.app?.view;
  const box = view?.getBoundingClientRect?.();
  if (!box || box.width <= 0 || box.height <= 0) return null;
  if (clientX < box.left || clientX > box.right || clientY < box.top || clientY > box.bottom) return null;
  const screen = canvasRef?.app?.renderer?.screen;
  const x = (clientX - box.left) * (Number(screen?.width) || box.width) / box.width;
  const y = (clientY - box.top) * (Number(screen?.height) || box.height) / box.height;
  for (const token of [...(canvasRef?.tokens?.placeables ?? [])].reverse()) {
    if (!token?.actor?.isOwner || token.destroyed || token.visible === false) continue;
    try {
      const bounds = token.getBounds?.();
      const minX = Number(bounds?.x ?? bounds?.minX);
      const minY = Number(bounds?.y ?? bounds?.minY);
      const maxX = Number(bounds?.maxX ?? (minX + Number(bounds?.width)));
      const maxY = Number(bounds?.maxY ?? (minY + Number(bounds?.height)));
      if (Number.isFinite(minX) && Number.isFinite(minY) && Number.isFinite(maxX) && Number.isFinite(maxY)
          && x >= minX && y >= minY && x <= maxX && y <= maxY) return token;
    } catch { /* unrendered Token */ }
  }
  return null;
}

/** A one-click GM selection mode that never changes Token ownership or control. */
export function beginHotbarTokenSelection({ canvasRef = globalThis.canvas, documentRef = globalThis.document, onSelect, onCancel }) {
  const view = canvasRef?.app?.renderer?.canvas ?? canvasRef?.app?.view;
  if (!canvasRef?.ready || !view?.addEventListener) return null;
  let active = true;
  const stop = () => {
    if (!active) return;
    active = false;
    view.removeEventListener('pointerdown', onPointer, true);
    documentRef?.removeEventListener?.('keydown', onKey, true);
  };
  const onKey = event => {
    if (event.key !== 'Escape') return;
    event.stopPropagation(); stop(); onCancel?.();
  };
  const onPointer = event => {
    if (event.button !== 0) return;
    const token = tokenAtHotbarPointer(event.clientX, event.clientY, canvasRef);
    if (!token) return; // Click empty space to leave selection mode active.
    event.preventDefault(); event.stopImmediatePropagation?.(); event.stopPropagation?.();
    stop(); onSelect?.(token);
  };
  view.addEventListener('pointerdown', onPointer, true);
  documentRef?.addEventListener?.('keydown', onKey, true);
  return stop;
}
