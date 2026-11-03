import { addHotbarTab, removeHotbarTab, normalizeHotbarState } from '../core/hotbar-state.js';
import { getSheetConfig } from '../core/config.js';
import { notifyWarning } from '../core/notifications.js';
const activeDialogs = new WeakMap();

const el = (doc, tag, className = '', text = '') => {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};

/** Lightweight client-only configuration overlay. Saves only on Apply. */
export function openHotbarConfigDialog({ state, onSave, documentRef = globalThis.document }) {
  activeDialogs.get(documentRef)?.();
  const originalState = normalizeHotbarState(state);
  let draft = normalizeHotbarState(state);
  const shade = el(documentRef, 'div', 'buxa-hb-config-backdrop');
  const panel = el(documentRef, 'section', 'buxa-hb-config-window');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Buxa Hotbar Configuration');
  shade.append(panel);
  const config = getSheetConfig();

  const field = (title, input) => {
    const label = el(documentRef, 'label', 'buxa-hb-setting');
    label.append(el(documentRef, 'span', '', title), input);
    return label;
  };
  const numberInput = (value, min, max) => {
    const input = el(documentRef, 'input'); input.type = 'number'; input.min = min; input.max = max; input.step = 1; input.value = String(value); return input;
  };
  const resourceOptions = (selected) => {
    const select = el(documentRef, 'select');
    const empty = el(documentRef, 'option', '', 'None'); empty.value = ''; select.append(empty);
    for (const resource of config.resources ?? []) {
      const option = el(documentRef, 'option', '', resource.label || resource.id);
      option.value = resource.id; option.selected = selected === resource.id; select.append(option);
    }
    return select;
  };
  const collect = () => {
    draft.color = color.value;
    draft.rows = Number(rows.value); draft.columns = Number(columns.value);
    draft.tabs.forEach((tab, index) => { const input = panel.querySelector(`[data-hb-tab-name="${index}"]`); if (input) tab.name = input.value; });
    draft.orbs.forEach((orb, index) => {
      orb.resourceId = panel.querySelector(`[data-hb-orb-resource="${index}"]`)?.value || '';
      orb.showNumber = panel.querySelector(`[data-hb-orb-number="${index}"]`)?.checked === true;
    });
    draft = normalizeHotbarState(draft);
  };
  const dismiss = () => { shade.remove(); documentRef.removeEventListener('keydown', onKey, true); if (activeDialogs.get(documentRef) === dismiss) activeDialogs.delete(documentRef); };
  const onKey = event => { if (event.key === 'Escape') { event.stopPropagation(); dismiss(); } };

  const title = el(documentRef, 'header', 'buxa-hb-config-head');
  title.append(el(documentRef, 'strong', '', 'HOTBAR CONFIGURATION'));
  const close = el(documentRef, 'button', 'buxa-hb-icon-button', '×'); close.type = 'button'; close.title = 'Close'; close.addEventListener('click', dismiss); title.append(close);
  panel.append(title);
  const info = el(documentRef, 'p', 'buxa-hb-config-caption', 'Personal hotbar settings. Shortcuts point to real Actor items and never move inventory items.');
  panel.append(info);
  const layout = el(documentRef, 'div', 'buxa-hb-config-fields');
  const rows = numberInput(draft.rows, 1, 4);
  const columns = numberInput(draft.columns, 4, 14);
  const color = el(documentRef, 'input'); color.type = 'color'; color.value = draft.color;
  layout.append(field('Rows', rows), field('Slots per row', columns), field('Accent color', color));
  panel.append(layout);

  const tabsHead = el(documentRef, 'div', 'buxa-hb-config-subhead');
  tabsHead.append(el(documentRef, 'strong', '', 'TABS'));
  const addTab = el(documentRef, 'button', 'buxa-hb-config-add', '+ Add tab'); addTab.type = 'button'; tabsHead.append(addTab);
  panel.append(tabsHead);
  const tabList = el(documentRef, 'div', 'buxa-hb-config-tabs'); panel.append(tabList);
  const renderTabs = () => {
    tabList.replaceChildren();
    draft.tabs.forEach((tab, index) => {
      const row = el(documentRef, 'div', 'buxa-hb-config-tabrow');
      const name = el(documentRef, 'input'); name.value = tab.name; name.maxLength = 24; name.placeholder = `Tab ${index + 1}`;
      name.dataset.hbTabName = String(index);
      const remove = el(documentRef, 'button', 'buxa-hb-icon-button', '×'); remove.type = 'button'; remove.title = 'Delete tab';
      remove.disabled = draft.tabs.length <= 1;
      remove.addEventListener('click', async () => {
        collect();
        const assigned=Object.values(draft.bindings).reduce((n, perTab) =>
          n + (Array.isArray(perTab?.[tab.id]) ? perTab[tab.id].filter(Boolean).length : 0),0);
        if (assigned) {
          const dialog=globalThis.foundry?.applications?.api?.DialogV2;
          const accepted=typeof dialog?.confirm === 'function'
            ? await dialog.confirm({window:{title:'Remove hotbar tab'},
                content:`<p>Remove this tab and ${assigned} item shortcuts? The Items themselves will not be deleted.</p>`,
                yes:{label:'Remove tab'},no:{label:'Cancel'},modal:true})
            : (globalThis.window?.confirm?.(`Remove this tab and ${assigned} item shortcuts?`) === true);
          if (!accepted || !shade.isConnected) return;
        }
        draft = removeHotbarTab(draft, tab.id);renderTabs();
      });
      row.append(name, remove); tabList.append(row);
    });
    addTab.disabled = draft.tabs.length >= 12;
  };
  addTab.addEventListener('click', () => { collect(); draft = addHotbarTab(draft); renderTabs(); });
  renderTabs();

  panel.append(el(documentRef, 'strong', 'buxa-hb-config-subhead', 'RESOURCE ORBS'));
  for (let index = 0; index < 2; index++) {
    const row = el(documentRef, 'div', 'buxa-hb-config-orbrow');
    row.append(el(documentRef, 'strong', '', `Orb ${index + 1}`));
    const resource = resourceOptions(draft.orbs[index].resourceId); resource.dataset.hbOrbResource = String(index);
    row.append(field('Resource', resource));
    const show = el(documentRef, 'input'); show.type = 'checkbox'; show.checked = draft.orbs[index].showNumber; show.dataset.hbOrbNumber = String(index);
    row.append(field('Show value in orb', show)); panel.append(row);
  }
  const actions = el(documentRef, 'footer', 'buxa-hb-config-actions');
  const cancel = el(documentRef, 'button', '', 'CANCEL'); cancel.type = 'button'; cancel.addEventListener('click', dismiss);
  const apply = el(documentRef, 'button', 'is-primary', 'APPLY CHANGES'); apply.type = 'button';
  apply.addEventListener('click', () => {
    if (apply.disabled) return;
    collect(); apply.disabled = true;
    void Promise.resolve().then(() => onSave(draft, originalState)).then(dismiss, error => {
      apply.disabled = false;
      notifyWarning(error?.message || 'Unable to save hotbar configuration.');
    });
  });
  actions.append(cancel, apply); panel.append(actions);
  shade.addEventListener('pointerdown', event => { if (event.target === shade) dismiss(); });
  documentRef.addEventListener('keydown', onKey, true);
  activeDialogs.set(documentRef, dismiss);
  documentRef.body.append(shade);
  close.focus();
  return { close: dismiss };
}
