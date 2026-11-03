/** Presentation-only enhancements for Module Configuration.
 * No changes to form bindings, submission, flags, settings or navigation.
 */
const PERSISTED_ACTIONS = new Set([
  'addField', 'removeField', 'moveFieldUp', 'moveFieldDown',
  'addResource', 'removeResource', 'moveResourceUp', 'moveResourceDown',
  'addAttribute', 'removeAttribute', 'moveAttributeUp', 'moveAttributeDown',
  'addProficiency', 'removeProficiency', 'moveProficiencyUp', 'moveProficiencyDown',
  'addRebirthStyle', 'removeRebirthStyle'
]);

/** Native range controls keep their current value; only a CSS variable changes. */
export function paintConfigRange(input) {
  if (input?.type !== 'range') return;
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const value = Number(input.value);
  const percentage = Number.isFinite(value) && Number.isFinite(min) && Number.isFinite(max) && max > min
    ? Math.min(100, Math.max(0, (value - min) / (max - min) * 100))
    : 0;
  input.style?.setProperty?.('--bc-fill', `${percentage}%`);
  // Mirror the source value only when the existing range row provides a readout.
  // Do not write to inputs or alter the form's serialized value.
  const row = input.closest?.('.bc-range-row') ?? input.parentElement;
  const display = row?.querySelector?.('.bc-range-value');
  if (display && display.textContent !== String(input.value)) display.textContent = String(input.value);
}

/** Reinstall after Foundry rerenders the application; never add duplicate listeners. */
export function bindLayoutConfigPresentation(app) {
  app._configPresentationCleanup?.();
  const root = app?.element?.querySelector?.('.buxa-config-shell-v2');
  if (!root) { app._configPresentationCleanup = null; return; }
  const workspace = root.querySelector('.buxa-config-main');
  root.classList.toggle('has-unsaved-changes', app._configPresentationDirty === true);
  workspace?.querySelectorAll('input[type="range"]').forEach(paintConfigRange);

  const markDirty = () => {
    app._configPresentationDirty = true;
    root.classList.add('has-unsaved-changes');
  };
  const onInput = (event) => {
    const target = event.target;
    if (!target?.matches?.('input,select,textarea')) return;
    paintConfigRange(target);
    if (target.type !== 'hidden' && target.type !== 'button') markDirty();
  };
  const onChange = (event) => {
    if (event.target?.matches?.('input:not([type="hidden"]),select,textarea')) markDirty();
  };
  const onClick = (event) => {
    const target = event.target;
    const button = target?.closest?.('[data-action],[data-rarity-action],[data-rarity-add]');
    if (!button || !root.contains(button)) return;
    const action = button.dataset?.action;
    if (PERSISTED_ACTIONS.has(action) || button.hasAttribute('data-rarity-add') ||
        button.dataset?.rarityAction === 'remove') markDirty();
  };
  // Some input values (e.g. a slider) are programmatically synchronized by
  // existing editors. A standard input event will repaint their actual value.
  root.addEventListener('input', onInput);
  root.addEventListener('change', onChange);
  root.addEventListener('click', onClick);
  app._configPresentationCleanup = () => {
    root.removeEventListener('input', onInput);
    root.removeEventListener('change', onChange);
    root.removeEventListener('click', onClick);
  };
}
