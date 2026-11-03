/** Edit an Item's appearance independently in each configured equipment footprint. */
import { INVENTORY_SIZE_PATTERNS } from '../core/inventory-config.js';
import { equipmentArtworkFit, shouldEnlargeEquipmentArtwork } from '../core/equipment-artwork-zoom.js';
import { normalizeItemEquipArtwork, equipmentArtworkTransform } from '../core/item-equip-artwork.js';

export function bindItemEquipSizeEditor(root, app) {
  const host = root.querySelector('[data-equip-size-editor]');
  if (!host) return;
  app._equipArtworkDraft = normalizeItemEquipArtwork(app._equipArtworkDraft);
  const imageField = root.querySelector('[data-item-image]');
  host.innerHTML = '<header class="buxa-equip-art-heading"><strong>EQUIPMENT ARTWORK</strong><small>One preview for each equipment-slot size. The artwork uses the real equipped-slot rendering. Right-click a preview to edit it. Drag to move; use ↘ to resize or ↻ to rotate.</small></header><div class="buxa-equip-art-gallery"></div>';
  const gallery = host.querySelector('.buxa-equip-art-gallery');
  const images = [];
  let activeId = INVENTORY_SIZE_PATTERNS.some(pattern => pattern.id === app._activeEquipArtworkSize)
    ? app._activeEquipArtworkSize : 'small';

  const setActive = id => {
    activeId = id;
    app._activeEquipArtworkSize = id;
    for (const tile of gallery.querySelectorAll('.buxa-equip-art-tile')) tile.classList.toggle('is-editing', tile.dataset.equipArtSize === id);
  };

  for (const { id, label, width, height } of INVENTORY_SIZE_PATTERNS) {
    const figure = root.ownerDocument.createElement('section');
    figure.className = 'buxa-equip-art-tile';
    figure.dataset.equipArtSize = id;
    figure.innerHTML = `
      <div class="buxa-equip-art-canvas">
        <article class="buxa-equipment-slot buxa-equip-art-slot is-${id} has-item" style="--equip-w:${width};--equip-h:${height}">
          <div class="buxa-equip-art-frame"></div>
          <div class="buxa-inventory-item buxa-equip-art-item">
            <img class="buxa-equip-art-image" alt="${label}" draggable="false">
          </div>
          <button type="button" class="buxa-equip-art-grip is-rotate" data-equip-art-rotate title="Rotate">↻</button>
          <button type="button" class="buxa-equip-art-grip is-resize" data-equip-art-resize title="Resize">↘</button>
        </article>
      </div>
      <footer><strong>${label}</strong><small data-equip-art-values></small><button type="button" data-equip-art-reset>Reset</button></footer>`;
    gallery.append(figure);
    const img = figure.querySelector('img');
    const slot = figure.querySelector('.buxa-equip-art-slot');
    const previewItem = { type: app.item?.type, shape: app._shapeDraft, showQuantity: false };
    const fit = equipmentArtworkFit(width, height, shouldEnlargeEquipmentArtwork(app.item?.type, previewItem));
    slot.style.setProperty('--buxa-equipped-art-width', fit.width);
    slot.style.setProperty('--buxa-equipped-art-height', fit.height);
    slot.style.setProperty('--buxa-equipped-art-fit', fit.fit);
    slot.style.setProperty('--buxa-equipped-art-zoom', String(fit.zoom));
    img.src = imageField?.value || app.item?.img || 'icons/svg/item-bag.svg';

    const redraw = () => {
      const v = app._equipArtworkDraft[id];
      slot.style.setProperty('--buxa-equipped-art-transform', equipmentArtworkTransform(v));
      figure.querySelector('[data-equip-art-values]').textContent = `${Math.round(v.zoom * 100)}% · ${v.rotation}° · x ${v.x} · y ${v.y}`;
    };

    figure.querySelector('[data-equip-art-reset]').addEventListener('click', () => {
      app._equipArtworkDraft[id] = { x: 0, y: 0, zoom: 1, rotation: 0 };
      setActive(id);
      redraw();
    });

    slot.addEventListener('contextmenu', e => { e.preventDefault(); setActive(id); });
    slot.addEventListener('pointerdown', () => setActive(id));

    let gesture;
    const release = () => {
      gesture = null;
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', release, true);
      window.removeEventListener('pointercancel', release, true);
    };
    const move = e => {
      if (!gesture || (e.pointerId != null && e.pointerId !== gesture.pointerId)) return;
      const dx = e.clientX - gesture.clientX;
      const dy = e.clientY - gesture.clientY;
      const previous = gesture.initial;
      const rect = slot.getBoundingClientRect();
      const angle = Math.atan2(e.clientY - (rect.top + rect.height / 2),
        e.clientX - (rect.left + rect.width / 2));
      const deltaAngle = Math.atan2(Math.sin(angle - gesture.initialAngle), Math.cos(angle - gesture.initialAngle));
      const rotation = previous.rotation + Math.round(deltaAngle * 180 / Math.PI);
      const next = gesture.mode === 'rotate'
        ? { ...previous, rotation: e.shiftKey ? Math.round(rotation / 15) * 15 : rotation }
        : gesture.mode === 'resize'
          ? { ...previous, zoom: Math.round(Math.max(.25, Math.min(4, previous.zoom + dx / 80)) * 100) / 100 }
          : { ...previous, x: previous.x + Math.round(dx), y: previous.y + Math.round(dy) };
      app._equipArtworkDraft[id] = normalizeItemEquipArtwork({ [id]: next })[id];
      redraw();
      e.preventDefault();
    };
    slot.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      setActive(id);
      const mode = e.target.closest('[data-equip-art-rotate]') ? 'rotate' : e.target.closest('[data-equip-art-resize]') ? 'resize' : 'move';
      const bounds = slot.getBoundingClientRect();
      gesture = { mode, clientX: e.clientX, clientY: e.clientY, pointerId: e.pointerId,
        initialAngle: Math.atan2(e.clientY - (bounds.top + bounds.height / 2),
          e.clientX - (bounds.left + bounds.width / 2)),
        initial: { ...app._equipArtworkDraft[id] } };
      window.addEventListener('pointermove', move, true);
      window.addEventListener('pointerup', release, true);
      window.addEventListener('pointercancel', release, true);
      e.preventDefault();
    });
    images.push(img);
    redraw();
  }
  setActive(activeId);
  imageField?.addEventListener('change', e => {
    for (const img of images) img.src = e.target.value || 'icons/svg/item-bag.svg';
  });
}
