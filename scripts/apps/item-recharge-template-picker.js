/** Drag-only world Item selector for a recharge material. Does not move Items. */
const FALLBACK_ICON = 'icons/svg/item-bag.svg';

/** Accept only world Item templates, never Actor Items, folders, or compendiums. */
export function worldItemFromDragData(data, worldItems) {
  if (!data || typeof data !== 'object' || data.type !== 'Item') return null;
  const uuid = typeof data.uuid === 'string' ? data.uuid : '';
  const id = /^Item\.([^.]+)$/.exec(uuid)?.[1] || (!uuid && typeof data.id === 'string' ? data.id : '');
  if (!id) return null;
  const item = worldItems?.get?.(id) ?? worldItems?.contents?.find?.(entry => entry.id === id);
  return item?.documentName === 'Item' && !item.parent && item.id === id ? item : null;
}

export function itemFromRechargeDrop(transfer, worldItems) {
  for (const kind of ['text/plain', 'application/json']) {
    const raw = transfer?.getData?.(kind);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const item = worldItemFromDragData(parsed, worldItems);
      if (item) return item;
    } catch { /* Ignore malformed drag data, never mutate the selection. */ }
  }
  return null;
}

/** Keeps the selection in a hidden input so the existing Limits save path works. */
export function createRechargeTemplatePicker(doc, selectedId, worldItems) {
  const wrap = doc.createElement('div');
  wrap.className = 'buxa-rule-field buxa-recharge-material-field';
  wrap.dataset.rechargeTemplatePicker = '';
  const caption = doc.createElement('span'); caption.textContent = 'RECHARGE MATERIAL';
  const slot = doc.createElement('div');
  slot.className = 'buxa-recharge-material-slot';
  slot.tabIndex = 0;
  slot.setAttribute('role', 'group');
  slot.setAttribute('aria-label', 'Recharge material: drag a World Item here from the Items directory');
  const icon = doc.createElement('img');
  icon.className = 'buxa-recharge-material-icon';
  icon.alt = '';
  icon.draggable = false;
  const details = doc.createElement('div'); details.className = 'buxa-recharge-material-info';
  const name = doc.createElement('strong');
  const description = doc.createElement('small');
  details.append(name, description);
  const clear = doc.createElement('button');
  clear.type = 'button'; clear.className = 'buxa-recharge-material-clear';
  clear.title = 'Clear recharge material'; clear.setAttribute('aria-label', 'Clear recharge material');
  clear.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
  const selection = doc.createElement('input');
  selection.type = 'hidden'; selection.dataset.useField = 'itemTemplateId';
  selection.value = String(selectedId ?? '');
  slot.append(icon,details,clear,selection); wrap.append(caption,slot);

  const refresh = () => {
    const item = worldItems?.get?.(selection.value) ?? worldItems?.contents?.find?.(entry => entry.id === selection.value);
    const selected = Boolean(selection.value);
    slot.classList.toggle('has-selection', selected);
    slot.classList.toggle('is-missing', selected && !item);
    icon.src = item?.img || FALLBACK_ICON;
    icon.hidden = !item;
    name.textContent = item?.name || (selected ? 'Item not found' : 'Drop an Item here');
    description.textContent = selected ? (item ? 'World Item · recharge material' : 'Clear or replace this missing Item') : 'Drag from Foundry Items';
    clear.hidden = !selected;
    clear.disabled = !selected;
    slot.title = item?.name || 'Drag a World Item from the Items directory';
  };
  const setItem = (item) => {
    selection.value = item?.id || '';
    selection.dispatchEvent(new doc.defaultView.Event('change', {bubbles:true}));
    refresh();
  };
  clear.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); setItem(null); });
  slot.addEventListener('dragenter', event => {
    if (!Array.from(event.dataTransfer?.types ?? []).some(type => type === 'text/plain' || type === 'application/json')) return;
    event.preventDefault(); event.stopPropagation(); slot.classList.add('is-drag-over');
  });
  slot.addEventListener('dragover', event => {
    if (!Array.from(event.dataTransfer?.types ?? []).some(type => type === 'text/plain' || type === 'application/json')) return;
    event.preventDefault(); event.stopPropagation();
    const effect=event.dataTransfer?.effectAllowed;
    if(effect === 'none')return;
    event.dataTransfer.dropEffect = effect === 'move' ? 'move' : 'copy';
    slot.classList.add('is-drag-over');
  });
  slot.addEventListener('dragleave', event => {
    if (!slot.contains(event.relatedTarget)) slot.classList.remove('is-drag-over');
  });
  slot.addEventListener('drop', event => {
    event.preventDefault(); event.stopPropagation(); slot.classList.remove('is-drag-over');
    const item = itemFromRechargeDrop(event.dataTransfer, worldItems);
    if (!item) {
      globalThis.ui?.notifications?.warn?.('Drop a World Item from the Items directory.');
      return;
    }
    setItem(item);
  });
  refresh();
  return wrap;
}
