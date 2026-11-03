/** Effect-only navigation and lifecycle feedback; form values stay authoritative. */
const TABS = ['info', 'behavior', 'resource', 'dice', 'increase', 'description'];

export function effectLifecycleSummary({behavior, mode, turns, stack, triggers = []}) {
  if (behavior === 'passive') return 'Always active while attached to the actor.';
  const duration = mode === 'permanent' ? 'Until removed' : `${Math.max(1, Number(turns) || 1)} combat turns`;
  const stacking = {replace:'replaces the previous effect', stack:'adds a stack', refresh:'refreshes its duration'}[stack];
  return `${duration} · ${stacking || 'refreshes its duration'} · ${triggers.length ? `${triggers.length} trigger${triggers.length === 1 ? '' : 's'}` : 'no triggers selected'}`;
}

export function bindEffectConfigUi(root, {activeTab = 'info', onSelect = () => {}} = {}) {
  const nav = root.querySelector('.bfx-config-tabs');
  if (!nav) return;
  const buttons = [...nav.querySelectorAll('[data-item-config-tab]')].filter(b => TABS.includes(b.dataset.itemConfigTab));
  nav.setAttribute('role', 'tablist');
  const select = id => {
    for (const button of buttons) {
      const active = button.dataset.itemConfigTab === id;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', String(active));
      button.classList.toggle('is-active', active);
      button.tabIndex = active ? 0 : -1;
    }
    for (const panel of root.querySelectorAll('[data-item-config-panel]')) {
      panel.hidden = panel.dataset.itemConfigPanel !== id;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-label', panel.dataset.itemConfigPanel);
    }
    onSelect(id);
  };
  for (const button of buttons) button.addEventListener('click', event => {
    event.preventDefault();
    select(button.dataset.itemConfigTab);
    root.querySelector('.buxa-item-config-scroll').scrollTop = 0;
  });
  nav.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const index = buttons.indexOf(event.target);
    if (index < 0) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
      : (index + (event.key === 'ArrowLeft' ? -1 : 1) + buttons.length) % buttons.length;
    buttons[next].click(); buttons[next].focus();
  });
  const sync = () => {
    const behavior = root.querySelector('[name="bfx-behavior"]:checked')?.value;
    const passive = behavior === 'passive';
    for (const section of root.querySelectorAll('[data-bfx-timed], [data-bfx-triggers]')) {
      section.hidden = passive;
      section.inert = passive;
      section.classList.remove('is-collapsed');
    }
    const note = root.querySelector('[data-bfx-passive-note]');
    if (note) note.hidden = !passive;
    const mode = root.querySelector('[data-bfx-duration-mode]')?.value;
    const turns = root.querySelector('[data-bfx-duration-value]');
    if (turns) {
      turns.disabled = passive || mode === 'permanent';
      turns.closest('label')?.classList.toggle('is-disabled', turns.disabled);
    }
    const summary = root.querySelector('[data-bfx-lifecycle-summary]');
    if (summary) summary.textContent = effectLifecycleSummary({behavior, mode, turns:turns?.value,
      stack:root.querySelector('[name="bfx-stack"]:checked')?.value,
      triggers:[...root.querySelectorAll('[data-bfx-trigger]:checked')]});
  };
  root.addEventListener('change', sync);
  root.querySelector('[data-bfx-duration-value]')?.addEventListener('input', sync);
  select(TABS.includes(activeTab) ? activeTab : 'info');
  sync();
}
