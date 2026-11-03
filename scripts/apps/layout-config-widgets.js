/** Buxa Module Configuration presentation widgets.
 * Native input/select data controls remain the sole source of saved values.
 * There are no changes to layout settings schema or serialization.
 */

export function syncConfigSelectTrigger(select) {
  const trigger = select?.parentElement?.querySelector?.('.bc-select-trigger');
  if (!trigger) return;
  const active = select.selectedOptions?.[0] ?? select.options?.[select.selectedIndex];
  const label = trigger.querySelector('.bc-select-value');
  const nextLabel = active?.textContent?.trim() || 'Choose…';
  if (label && label.textContent !== nextLabel) label.textContent = nextLabel;
  trigger.disabled = Boolean(select.disabled);
}

export function enhanceConfigControls(root, app, onSelectCreated) {
  if (!root?.querySelectorAll || !root?.ownerDocument?.createElement) return;
  const doc = root.ownerDocument;

  // One switch per checkbox, including dynamically added rarity/resource rows.
  // The native control remains authoritative for checked state and saving;
  // the track is inert, so clicking its owning label toggles the original input.
  for (const input of root.querySelectorAll('.buxa-config-main input[type="checkbox"]:not([data-bc-toggle])')) {
    if (!input.parentNode) continue;
    const track = doc.createElement('span');
    track.className = 'bc-toggle-track';
    track.setAttribute('aria-hidden', 'true');
    input.insertAdjacentElement('afterend', track);
    input.dataset.bcToggle = 'true';
  }

  for (const input of root.querySelectorAll('.buxa-config-main input[type="number"]:not([data-bc-number])')) {
    if (!input.parentNode || input.closest('.bc-number')) continue;
    const wrapper = doc.createElement('span');
    wrapper.className = 'bc-number';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);
    input.dataset.bcNumber = 'true';
    const actions = doc.createElement('span');
    actions.className = 'bc-number-steppers';
    for (const [label, dir, icon] of [['Increase',1,'fa-chevron-up'],['Decrease',-1,'fa-chevron-down']]) {
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'bc-number-step';
      button.setAttribute('aria-label', label);
      button.innerHTML = `<i class="fa-solid ${icon}" aria-hidden="true"></i>`;
      button.disabled = input.disabled || input.readOnly;
      button.addEventListener('click', () => {
        if (input.disabled || input.readOnly) return;
        const before = input.value;
        try { dir > 0 ? input.stepUp() : input.stepDown(); }
        catch { return; }
        if (input.value === before) return;
        input.dispatchEvent(new Event('input', { bubbles:true }));
        input.dispatchEvent(new Event('change', { bubbles:true }));
      });
      actions.appendChild(button);
    }
    wrapper.appendChild(actions);
  }

  for (const select of root.querySelectorAll('.buxa-config-main select:not([data-bc-enhanced])')) {
    if (!select.parentNode || select.closest('.bc-select')) continue;
    const shell = doc.createElement('span');
    shell.className = 'bc-select';
    select.parentNode.insertBefore(shell, select);
    shell.appendChild(select);
    const trigger = doc.createElement('button');
    trigger.type = 'button';
    trigger.className = 'bc-select-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.innerHTML = '<span class="bc-select-value"></span><i class="fa-solid fa-chevron-down" aria-hidden="true"></i>';
    shell.appendChild(trigger);
    const fieldLabel = shell.closest('label')?.querySelector(':scope > span');
    if (fieldLabel?.textContent) trigger.setAttribute('aria-label', fieldLabel.textContent.trim());
    select.dataset.bcEnhanced = 'true';
    syncConfigSelectTrigger(select);
    onSelectCreated?.(select, trigger);
  }
}

export function bindConfigWidgets(app) {
  app._configWidgetsCleanup?.();
  const root = app?.element?.querySelector?.('.buxa-config-shell-v2');
  const doc = root?.ownerDocument;
  if (!root || !doc?.createElement) { app._configWidgetsCleanup = null; return; }

  let popup = null;
  let owner = null;
  let trigger = null;
  let observer = null;
  const disposers = [];

  function closePopup({ restoreFocus = false } = {}) {
    if (!popup) return;
    const oldTrigger = trigger;
    popup.remove();
    popup = null;
    owner = null;
    trigger = null;
    oldTrigger?.setAttribute('aria-expanded', 'false');
    if (restoreFocus) oldTrigger?.focus?.();
  }

  function optionEntries(select) {
    return Array.from(select.options ?? []).filter(o => !o.hidden);
  }

  function openPopup(select, target) {
    if (select.disabled) return;
    if (popup && owner === select) { closePopup(); return; }
    closePopup();
    owner = select;
    trigger = target;
    popup = doc.createElement('div');
    popup.className = 'bc-select-popup';
    popup.setAttribute('role', 'listbox');
    popup.setAttribute('aria-label', target.getAttribute('aria-label') || 'Choose option');
    for (const option of optionEntries(select)) {
      const choice = doc.createElement('button');
      choice.type = 'button';
      choice.className = 'bc-select-option';
      choice.textContent = option.textContent;
      choice.setAttribute('role', 'option');
      choice.setAttribute('aria-selected', String(option.selected));
      choice.disabled = Boolean(option.disabled);
      choice.addEventListener('click', () => {
        if (choice.disabled) return;
        const changed = select.value !== option.value;
        select.value = option.value;
        // Keep any custom inputs/listeners used by Buxa's existing serializer.
        if (changed) select.dispatchEvent(new Event('change', { bubbles: true }));
        syncConfigSelectTrigger(select);
        closePopup({ restoreFocus: true });
      });
      popup.appendChild(choice);
    }
    const theme = doc.defaultView?.getComputedStyle?.(root);
    for (const key of ['--bc-surface-3','--bc-accent','--bc-ink','--bc-muted']) {
      const v = theme?.getPropertyValue?.(key);
      if (v) popup.style.setProperty(key, v.trim());
    }
    doc.body.appendChild(popup);
    target.setAttribute('aria-expanded', 'true');
    const anchor = target.getBoundingClientRect();
    const viewportWidth = doc.defaultView?.innerWidth ?? 1280;
    const viewportHeight = doc.defaultView?.innerHeight ?? 720;
    const width = Math.max(anchor.width, 175);
    popup.style.width = `${Math.min(width, viewportWidth - 16)}px`;
    const estimatedHeight = Math.min(popup.scrollHeight || 230, 260);
    const below = viewportHeight - anchor.bottom;
    popup.style.left = `${Math.max(8, Math.min(viewportWidth - width - 8, anchor.left))}px`;
    popup.style.top = `${below >= Math.min(estimatedHeight, 130) ? Math.min(viewportHeight - estimatedHeight - 8, anchor.bottom + 3) : Math.max(8, anchor.top - estimatedHeight - 3)}px`;
    const selected = popup.querySelector('[aria-selected="true"]');
    if (selected) popup.scrollTop = Math.max(0, selected.offsetTop - popup.offsetTop - Math.max(0, popup.clientHeight / 2 - selected.offsetHeight / 2));
  }

  const onChange = event => {
    if (event.target?.matches?.('select[data-bc-enhanced]')) syncConfigSelectTrigger(event.target);
  };
  const onPointer = event => {
    if (popup && !popup.contains(event.target) && !trigger?.contains(event.target)) closePopup();
  };
  const onEscape = event => {
    if (event.key === 'Escape' && popup) { event.stopPropagation(); closePopup({ restoreFocus: true }); }
  };
  const onScroll = event => {
    if (popup && !popup.contains(event.target)) closePopup();
  };

  function attach(select, button) {
    const onActivate = () => openPopup(select, button);
    const onKeys = event => {
      if (['Enter',' ','ArrowDown','ArrowUp'].includes(event.key)) {
        event.preventDefault();
        if (!popup || owner !== select) openPopup(select, button);
        const entries = [...(popup?.querySelectorAll('.bc-select-option:not(:disabled)') ?? [])];
        const selectedIndex = entries.findIndex(n => n.getAttribute('aria-selected') === 'true');
        (entries[Math.max(0, selectedIndex)] ?? entries[0])?.focus();
      }
    };
    button.addEventListener('click', onActivate);
    button.addEventListener('keydown', onKeys);
    disposers.push(() => { button.removeEventListener('click', onActivate); button.removeEventListener('keydown', onKeys); });
  }
  enhanceConfigControls(root, app, attach);
  const Observer = doc.defaultView?.MutationObserver ?? globalThis.MutationObserver;
  if (typeof Observer === 'function') {
    observer = new Observer(records => {
      if (records.some(record => record.addedNodes?.length)) {
        enhanceConfigControls(root, app, attach);
        for (const select of root.querySelectorAll('select[data-bc-enhanced]')) syncConfigSelectTrigger(select);
      }
    });
    observer.observe(root, { childList: true, subtree: true });
  }
  root.addEventListener('change', onChange);
  doc.addEventListener('pointerdown', onPointer, true);
  doc.addEventListener('keydown', onEscape, true);
  doc.addEventListener('scroll', onScroll, true);
  app._configWidgetsCleanup = () => {
    observer?.disconnect();
    closePopup();
    root.removeEventListener('change', onChange);
    doc.removeEventListener('pointerdown', onPointer, true);
    doc.removeEventListener('keydown', onEscape, true);
    doc.removeEventListener('scroll', onScroll, true);
    for (const off of disposers) off();
  };
}
