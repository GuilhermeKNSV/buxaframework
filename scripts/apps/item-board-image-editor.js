/** Interactive scene-artwork preview; uses the same move, rotate and corner-resize gesture as the canvas editor. */
import { normalizeItemBoardImage } from '../core/item-board-image.js';
import { bindItemSceneFxPreview } from './item-scene-fx-preview.js';

export function bindItemBoardImageEditor(root, app) {
  const stage = root.querySelector('[data-board-image-stage]');
  const art = root.querySelector('[data-board-image-art]');
  if (!stage || !art) return;
  const size = root.querySelector('[data-board-image-size]');
  const angle = root.querySelector('[data-board-image-angle]');
  const opacity = root.querySelector('[data-board-image-opacity]');
  const opacityNumber = root.querySelector('[data-board-image-opacity-number]');
  const output = root.querySelector('[data-board-image-opacity-text]');
  const image = root.querySelector('[data-board-image-src]');
  const imagePath = root.querySelector('[data-item-image]');
  let x = 0, y = 0;
  let updatePreview = () => {};

  const redraw = () => {
    const v = app._boardImageDraft = normalizeItemBoardImage(app._boardImageDraft);
    art.style.width = `${v.size}px`;
    art.style.height = `${v.size}px`;
    art.style.opacity = String(v.opacity);
    art.style.transform = `translate(${x}px,${y}px) rotate(${v.rotation}deg)`;
    if (size) size.value = v.size;
    if (angle) angle.value = v.rotation;
    if (opacity) opacity.value = v.opacity;
    if (opacityNumber) opacityNumber.value = v.opacity;
    if (output) output.textContent = v.opacity.toFixed(2);
    const previewOpen = stage.dataset.previewOpen === 'true';
    const activeTarget = stage.dataset.previewTarget || 'image';
    art.classList.toggle('is-editing', !previewOpen || activeTarget === 'image');
    updatePreview();
  };
  function edit(key, value) { app._boardImageDraft = { ...app._boardImageDraft, [key]: value }; redraw(); }
  size?.addEventListener('input', () => edit('size', size.value));
  angle?.addEventListener('input', () => edit('rotation', angle.value));
  opacity?.addEventListener('input', () => edit('opacity', opacity.value));
  opacityNumber?.addEventListener('input', () => edit('opacity', opacityNumber.value));
  imagePath?.addEventListener('change', () => { if (image) image.src = imagePath.value; });
  let grip = null;
  const move = e => {
    if (!grip || (e.pointerId != null && grip.pointerId !== e.pointerId)) return;
    const dx = e.clientX - grip.clientX, dy = e.clientY - grip.clientY;
    if (grip.mode === 'resize') edit('size', Math.max(20, grip.value + Math.max(dx, dy) * 2));
    else if (grip.mode === 'rotate') {
      const r = stage.getBoundingClientRect();
      const cx = r.left + r.width / 2 + x, cy = r.top + r.height / 2 + y;
      const radians = Math.atan2(e.clientY - cy, e.clientX - cx);
      edit('rotation', Math.round(grip.value + (radians - grip.startAngle) * 180 / Math.PI));
    } else {
      x = grip.x + dx; y = grip.y + dy; redraw();
    }
    e.preventDefault();
  };
  const end = () => {
    if (!grip) return;
    grip = null;
    window.removeEventListener('pointermove', move, true);
    window.removeEventListener('pointerup', end, true);
    window.removeEventListener('pointercancel', end, true);
  };
  art.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const previewOpen = stage.dataset.previewOpen === 'true';
    const activeTarget = stage.dataset.previewTarget || 'image';
    if (previewOpen && activeTarget !== 'image') return;
    const mode = e.target.closest('[data-board-image-rotate]') ? 'rotate' : e.target.closest('[data-board-image-resize]') ? 'resize' : 'move';
    const rect = stage.getBoundingClientRect();
    const startAngle = Math.atan2(e.clientY - (rect.top + rect.height / 2 + y), e.clientX - (rect.left + rect.width / 2 + x));
    grip = { mode, clientX: e.clientX, clientY: e.clientY, pointerId: e.pointerId, value: mode === 'resize' ? app._boardImageDraft.size : app._boardImageDraft.rotation, startAngle, x, y };
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', end, true);
    window.addEventListener('pointercancel', end, true);
    e.preventDefault(); e.stopPropagation();
  });
  updatePreview = bindItemSceneFxPreview(root, app, () => ({ x, y }));
  redraw();
}
