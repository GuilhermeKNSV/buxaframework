/** The Item Configuration scene overlay editor. Saved values are scene offsets. */
import { normalizeItemBoardImage } from '../core/item-board-image.js';

export function bindItemSceneFxPreview(root, app, position) {
  const stage = root.querySelector('[data-board-image-stage]');
  const preview = root.querySelector('[data-board-scene-preview]');
  const toggle = root.querySelector('[data-board-preview-toggle]');
  if (!stage || !preview || !toggle) return () => {};
  const beam = preview.querySelector('[data-board-fx-target="beam"]');
  const label = preview.querySelector('[data-board-fx-target="label"]');
  const rarityInput = root.querySelector('[data-item-rarity]');
  const selectors = [...root.querySelectorAll('[data-board-preview-select]')];
  if (!['image','beam','label'].includes(app._boardPreviewTarget)) app._boardPreviewTarget = 'image';
  let enabled = String(toggle.getAttribute('aria-pressed')) === 'true';

  const syncSelection = () => {
    stage.dataset.previewOpen = enabled ? 'true' : 'false';
    stage.dataset.previewTarget = app._boardPreviewTarget;
    preview.hidden = !enabled;
    preview.dataset.activeTarget = app._boardPreviewTarget;
    toggle.setAttribute('aria-pressed', String(enabled));
    toggle.classList.toggle('is-active', enabled);
    for (const button of selectors) {
      const active = button.dataset.boardPreviewSelect === app._boardPreviewTarget;
      button.classList.toggle('is-active', enabled && active);
      button.toggleAttribute('disabled', !enabled);
      button.setAttribute('aria-pressed', String(enabled && active));
    }
    beam.classList.toggle('is-editing', enabled && app._boardPreviewTarget === 'beam');
    label.classList.toggle('is-editing', enabled && app._boardPreviewTarget === 'label');
    beam.style.pointerEvents = enabled && app._boardPreviewTarget === 'beam' ? 'auto' : 'none';
    label.style.pointerEvents = enabled && app._boardPreviewTarget === 'label' ? 'auto' : 'none';
    // Update only presentation state here. Emitting an event would feed back
    // into the board-art redraw, which itself refreshes this preview.
    root.querySelector('[data-board-image-art]')?.classList?.toggle('is-editing',
      !enabled || app._boardPreviewTarget === 'image');
  };

  const update = () => {
    const v = app._boardImageDraft = normalizeItemBoardImage(app._boardImageDraft);
    const { x = 0, y = 0 } = position();
    const beamFx = v.sceneFx.beam;
    const labelFx = v.sceneFx.label;
    beam.style.left = `calc(50% + ${x + beamFx.x}px)`;
    beam.style.top = `calc(50% + ${y + v.size / 2 + beamFx.y}px)`;
    beam.style.transform = `translate(-50%,-100%) scale(${beamFx.scale})`;
    label.style.left = `calc(50% + ${x + labelFx.x}px)`;
    label.style.top = `calc(50% + ${y - v.size / 2 - 10 + labelFx.y}px)`;
    label.style.transform = `translate(-50%,-100%) scale(${labelFx.scale})`;

    const rarityId = rarityInput?.value;
    const rarity = (app._configRarities || []).find(r => r.id === rarityId);
    const color = rarity?.color || '#66baff';
    preview.style.setProperty('--buxa-scene-preview-rarity', /^#[\da-f]{6}$/i.test(color) ? color : '#66baff');
    const nameInput = root.querySelector('[data-item-name]');
    label.querySelector('span').textContent = nameInput?.value || app.item?.name || 'Item';
    syncSelection();
  };

  toggle.addEventListener('click', () => { enabled = !enabled; update(); });
  for (const button of selectors) button.addEventListener('click', () => { app._boardPreviewTarget = button.dataset.boardPreviewSelect || 'image'; syncSelection(); });
  root.querySelector('[data-board-fx-reset]')?.addEventListener('click', () => {
    app._boardImageDraft.sceneFx = { beam: { x: 0, y: 0, scale: 1 }, label: { x: 0, y: 0, scale: 1 } };
    update();
  });
  rarityInput?.addEventListener('change', update);
  root.querySelector('[data-item-name]')?.addEventListener('input', update);

  for (const target of [beam, label]) {
    const name = target.dataset.boardFxTarget;
    let grip = null;
    const move = e => {
      if (!grip || (e.pointerId != null && e.pointerId !== grip.pointerId)) return;
      const dx = e.clientX - grip.x, dy = e.clientY - grip.y;
      const next = grip.resize
        ? { ...grip.value, scale: Math.round(Math.max(.3, Math.min(4, grip.value.scale + (dx + dy) / 160)) * 100) / 100 }
        : { ...grip.value, x: grip.value.x + Math.round(dx), y: grip.value.y + Math.round(dy) };
      app._boardImageDraft = { ...app._boardImageDraft, sceneFx: { ...app._boardImageDraft.sceneFx, [name]: next } };
      update();
      e.preventDefault();
    };
    const end = () => {
      grip = null;
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', end, true);
      window.removeEventListener('pointercancel', end, true);
    };
    target.addEventListener('pointerdown', e => {
      if (e.button !== 0 || !enabled) return;
      if ((name === 'beam' && app._boardPreviewTarget !== 'beam') || (name === 'label' && app._boardPreviewTarget !== 'label')) return;
      grip = {
        x: e.clientX,
        y: e.clientY,
        pointerId: e.pointerId,
        resize: Boolean(e.target.closest('[data-board-fx-resize]')),
        value: { ...app._boardImageDraft.sceneFx[name] }
      };
      window.addEventListener('pointermove', move, true);
      window.addEventListener('pointerup', end, true);
      window.addEventListener('pointercancel', end, true);
      e.preventDefault();
      e.stopPropagation();
    });
  }

  update();
  return update;
}
