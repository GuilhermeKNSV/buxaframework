import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createItemRuleEditor } from '../scripts/apps/item-rule-editor.js';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function row(type, label) {
  const fields = {
    'data-buxa-rule-title': { textContent: '' },
    'data-buxa-rule-summary': { textContent: '' },
    'data-item-dice-label': { value: label },
    'data-item-dice-count': { value: '2' },
    'data-item-dice-faces': { value: '20' },
    'data-item-dice-flat': { value: '1' },
    'data-item-dice-roll-mode': { selectedOptions: [{ textContent: 'Normal' }] },
    'data-item-dice-attribute-enabled': { checked: false },
    'data-item-dice-modifier': { selectedOptions: [{ value: 'none:' }] },
    'data-item-increase-target': { selectedOptions: [{ textContent: 'ATTRIBUTES · Strength' }] },
    'data-item-increase-value': { value: '3' },
    'data-item-increase-mode': { value: 'flat' },
    'data-item-increase-activation': { value: 'equipped' }
  };
  return {
    fields,
    matches: selector => selector === `[data-item-${type}-row]`,
    querySelector: selector => fields[selector.slice(1,-1)] ?? null
  };
}

test('typing in item dice refreshes only the edited row without rebuilding all source pickers', () => {
  const first = row('dice', 'Slash');
  const second = row('dice', 'Bite');
  const listeners = new Map();
  const queryCounts = new Map();
  const root = {
    querySelectorAll(selector) {
      queryCounts.set(selector, (queryCounts.get(selector) ?? 0) + 1);
      if (selector === '[data-item-dice-row]') return [first, second];
      return [];
    },
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type) { listeners.delete(type); }
  };
  const ui = createItemRuleEditor(root);
  const initialChoices = queryCounts.get('select[data-buxa-search-picker]');
  const initialSecondTitle = second.fields['data-buxa-rule-title'].textContent;
  const initialSecondSummary = second.fields['data-buxa-rule-summary'].textContent;
  first.fields['data-item-dice-label'].value = 'Rapid strike';
  for (let i=0; i<100; i++) listeners.get('input')({target:{closest:()=>first}});
  assert.equal(first.fields['data-buxa-rule-title'].textContent, 'Rapid strike');
  assert.equal(second.fields['data-buxa-rule-title'].textContent, initialSecondTitle);
  assert.equal(second.fields['data-buxa-rule-summary'].textContent, initialSecondSummary);
  assert.equal(queryCounts.get('select[data-buxa-search-picker]'), initialChoices,
    'editing a number or label must never rebuild expensive searchable selects');
  ui.refresh();
  assert.equal(queryCounts.get('select[data-buxa-search-picker]'), initialChoices + 1,
    'structural refresh still discovers newly inserted choices');
  ui.destroy();
  assert.equal(listeners.size, 0);
});

test('storage occupancy mode is prominent and independent from pouch outline in existing and new compartments', () => {
  const html = read('templates/item-config.hbs');
  const editor = read('scripts/apps/item-storage-editor.js');
  const css = read('styles/161-item-config-navigation.css');
  assert.equal((html.match(/<select data-storage-item-mode\s/g) ?? []).length, 2);
  assert.equal((html.match(/data-storage-mode-setting/g) ?? []).length, 2);
  assert.equal((html.match(/data-storage-item-mode-hint/g) ?? []).length, 2);
  assert.match(html, /STORAGE INVENTORY MODE/);
  assert.match(html, /Simple · 1 slot\/item/);
  assert.match(html, /Complex · item shape/);
  assert.match(html, /Items always keep their original shape when moved out/);
  assert.match(editor, /slotMode\?\.addEventListener\('change',syncMode\)/);
  assert.match(editor, /itemMode:row\.querySelector\('\[data-storage-item-mode\]'\)/);
  assert.match(css, /\.buxa-storage-mode-setting\s*\{/);
});
