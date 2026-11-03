import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeItemRules, normalizeItemSystemConfig } from '../scripts/core/item-config.js';
import { descriptionView, changeDiscoveryState } from '../scripts/core/item-discovery.js';
import { buildItemControlEntries } from '../scripts/core/item-control.js';

const conf = { items: normalizeItemSystemConfig(), attributes: { entries: [] }, proficiencies: { entries: [] }, resources: [] };
const part = { id: 'owner', text: 'unknown', revealedText: 'Loki', visibility: 'locked' };

test('standard description renders directly, without modular fragment changes', () => {
  const r = normalizeItemRules({ description: { enabled: true, mode: 'standard', text: 'An old sword.', parts: [part] } }, conf.items);
  assert.equal(r.description.mode, 'standard');
  assert.deepEqual(descriptionView(r.description).map(v => v.text), ['An old sword.']);
  assert.equal(r.description.parts[0].revealedText, 'Loki', 'modular fields are preserved on standard mode');
});

test('modular description restores saved discovery when switching back', () => {
  const raw = { description: { enabled: true, mode: 'modular', text: 'A normal description.', parts: [part] } };
  const modular = normalizeItemRules(raw, conf.items);
  assert.deepEqual(descriptionView(modular.description).map(v => v.text), ['unknown']);
  const standard = normalizeItemRules({ ...modular, description: { ...modular.description, mode: 'standard' } }, conf.items);
  assert.deepEqual(descriptionView(standard.description).map(v => v.text), ['A normal description.']);
  const returnToModular = normalizeItemRules({ ...standard, description: { ...standard.description, mode: 'modular' } }, conf.items);
  assert.deepEqual(descriptionView(returnToModular.description).map(v => v.text), ['unknown']);
  assert.deepEqual(descriptionView(changeDiscoveryState(returnToModular, 'description', 'owner', 'revealed').description).map(v => v.text), ['Loki']);
});

test('description disabled renders neither style and does not discard saved text', () => {
  const rules = normalizeItemRules({ description: { enabled: false, mode: 'standard', text: 'Keep me', parts: [part] } }, conf.items);
  assert.deepEqual(descriptionView(rules.description), []);
  assert.equal(rules.description.text, 'Keep me');
  assert.equal(rules.description.parts[0].text, 'unknown');
});

test('Control lists only active-mode descriptions plus dice and increases', () => {
  const rules = normalizeItemRules({ description: { enabled: true, mode: 'standard', text: 'Hello', parts: [part] }, dice: [{ id: 'd', label: 'Damage', visibility: 'hidden' }], increases: [{ id: 'i', target: 'stat:initiative:value', visibility: 'locked', value: 5 }] }, conf.items);
  let result = buildItemControlEntries(rules, conf);
  assert.deepEqual(result.map(e=>e.kind), ['increase','dice']);
  assert.deepEqual(result.map(e=>e.visibility), ['locked','hidden']);
  rules.description.mode='modular';
  result=buildItemControlEntries(rules,conf);
  assert.deepEqual(result.map(e=>e.kind), ['increase','dice','description']);
  rules.description.enabled=false;
  assert.deepEqual(buildItemControlEntries(rules,conf).map(e=>e.kind), ['increase','dice']);
});

test('normal sheet remains a single view and Control lives in item configuration', () => {
  const sheet = fs.readFileSync(new URL('../templates/item-sheet.hbs',import.meta.url),'utf8');
  const config = fs.readFileSync(new URL('../templates/item-config.hbs',import.meta.url),'utf8');
  const app = fs.readFileSync(new URL('../scripts/apps/item-config.js',import.meta.url),'utf8');
  const control = fs.readFileSync(new URL('../scripts/apps/item-control.js',import.meta.url),'utf8');
  assert.ok(!sheet.includes('data-buxa-item-view'));
  assert.ok(!sheet.includes('buxa-item-discovery-nav'));
  assert.ok(config.includes('data-item-config-panel="control"'));
  assert.ok(config.includes('data-item-description-mode'));
  assert.ok(config.includes('data-item-description-standard'));
  assert.ok(config.includes('data-item-description-modular'));
  assert.ok(control.includes('await saveItemRules'));
  assert.ok(control.includes('field.value = visibility'));
  assert.ok(app.includes('bindItemControl('));
});

test('inventory quantities have clear multiplier and a final pill stylesheet', () => {
  const sheet=fs.readFileSync(new URL('../templates/player-sheet.hbs',import.meta.url),'utf8');
  const style=fs.readFileSync(new URL('../styles/114-item-control-polish.css',import.meta.url),'utf8');
  assert.ok((sheet.match(/class="buxa-item-quantity">×/g)||[]).length>=3);
  assert.ok(style.includes('.buxa-inventory-item > .buxa-item-quantity'));
  assert.ok(style.includes('opacity: 1'));
});

test('GM Control click persists reveal and synchronizes matching editor field', async () => {
  const { bindItemControl } = await import('../scripts/apps/item-control.js');
  globalThis.game = {
    user: { isGM: true },
    settings: { get: () => ({ items: conf.items }) }
  };
  globalThis.foundry = {
    utils: { deepClone: value => structuredClone(value), randomID: () => 'testing' }
  };
  let raw = normalizeItemRules({ rarityId:'rare', increases: [{
    id: 'bonus', target:'stat:initiative:value', mode:'flat', activation:'passive', value: 5,
    visibility:'hidden', reveal: { rarityId:'epic' }
  }] }, conf.items);
  const item = { name:'Mystery', img:'icons/svg/item-bag.svg', parent:null,
    getFlag: (_scope, key) => key === 'item' ? raw : undefined,
    update: async payload => { raw = payload['flags.buxaframework.item']; }
  };
  let clickHandler;
  const panel = { addEventListener: (_event, fn) => { clickHandler = fn; } };
  const selected = new Set();
  const cls = {
    add: (...classes) => classes.forEach(v => selected.add(v)),
    remove: (...classes) => classes.forEach(v => selected.delete(v)),
    contains: key => selected.has(key),
    toggle: (key, value) => value ? selected.add(key) : selected.delete(key)
  };
  const button = { dataset:{visibility:'revealed'}, classList:cls, disabled:false,
    closest: selector => selector === '[data-item-control-set]' ? button : card, setAttribute:(key, value)=>{button[key]=value;} };
  const otherButton = { dataset:{visibility:'hidden'}, classList:{...cls, toggle:()=>{}}, disabled:false,
    setAttribute:()=>{} };
  const status = {textContent:''};
  const card = { dataset: {kind:'increase',entryId:'bonus'}, classList:cls,
    querySelectorAll:()=>[button, otherButton], querySelector:()=>status };
  const field={value:'hidden'}, rarity={value:'rare'};
  const root={querySelector:selector=>selector==='[data-item-config-panel=control]'?panel:selector==='[data-item-rarity]'?rarity:selector.includes('[data-item-increase-row]')?field:null};
  let notified = 0;
  bindItemControl(root, { item, onSave:()=>{ notified++; } });
  await clickHandler({target:button,preventDefault:()=>{}});
  assert.equal(raw.increases[0].visibility,'revealed');
  assert.equal(raw.rarityId,'epic');
  assert.equal(field.value,'revealed');
  assert.equal(rarity.value,'epic');
  assert.equal(status.textContent,'Revealed');
  assert.equal(button['aria-pressed'],'true');
  assert.equal(notified,1);
});
