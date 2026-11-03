import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { paintConfigRange, bindLayoutConfigPresentation } from '../scripts/apps/layout-config-presentation.js';

const rootPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(rootPath, relative), 'utf8');

function eventRoot() {
  const listeners = new Map();
  const classes = new Set();
  const ranges = [];
  const main = { querySelectorAll(selector) { return selector.includes('range') ? ranges : []; } };
  const node = {
    classList: { add(c) { classes.add(c); }, toggle(c, on) { if (on) classes.add(c); else classes.delete(c); } },
    querySelector(selector) { return selector === '.buxa-config-main' ? main : null; },
    contains() { return true; },
    addEventListener(name, handler) { listeners.set(name, handler); },
    removeEventListener(name, handler) { if (listeners.get(name) === handler) listeners.delete(name); }
  };
  return { node, listeners, classes, ranges };
}

test('module configuration CSS loads last and covers all named sections and controls', () => {
  const css = read('styles/30-module-config-system.css');
  const entry = read('styles/buxa.css');
  assert.ok(entry.trimEnd().endsWith('@import url("./30-module-config-system.css");'));
  for (const selector of [
    '[data-config-panel="inventory"]', '[data-config-panel="npc"]',
    '.buxa-config-resource-main', '.buxa-config-proficiency-main',
    '.buxa-rarity-config-main', '.buxa-config-rebirth-rule-head',
    '.buxa-addon-grid', '.buxa-warning-position-content',
    '.bc-select-trigger', '.buxa-config-main input[type="range"]',
    '.buxa-config-main input[type="checkbox"]', '.buxa-config-footer'
  ]) assert.ok(css.includes(selector), `missing coverage for ${selector}`);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /--bc-s4/);
  assert.match(css, /:focus-visible/);
});

test('module configuration data selectors and options remain in the existing Handlebars form', () => {
  const template = read('templates/layout-config.hbs');
  for (const id of ['player-sheet', 'inventory', 'npc', 'items', 'ui', 'addons'])
    assert.ok(template.includes(`data-config-section="${id}"`));
  for (const id of ['basic', 'resources', 'level', 'attributes', 'stats', 'proficiencies', 'rebirths'])
    assert.ok(template.includes(`data-config-tab="${id}"`));
  assert.match(template, /data-action="resetLayout"/);
  assert.match(template, /type="submit" class="buxa-primary"/);
});

test('range fill paints from original native value without writing it', () => {
  const styles = new Map();
  const slider = { type: 'range', min: '-10', max: '30', value: '0', style: { setProperty(key, val) { styles.set(key, val); } } };
  paintConfigRange(slider);
  assert.equal(styles.get('--bc-fill'), '25%');
  assert.equal(slider.value, '0');
  slider.value = '80';
  paintConfigRange(slider);
  assert.equal(styles.get('--bc-fill'), '100%');
  slider.value = '-80';
  paintConfigRange(slider);
  assert.equal(styles.get('--bc-fill'), '0%');
});

test('only editing marks configuration dirty; navigation leaves indicator clean', () => {
  const mock = eventRoot();
  const app = { element: { querySelector() { return mock.node; } }, _configPresentationDirty: false };
  bindLayoutConfigPresentation(app);
  mock.listeners.get('click')({ target: { closest() { return null; } } });
  assert.equal(mock.classes.has('has-unsaved-changes'), false);
  mock.listeners.get('input')({ target: { matches() { return true; }, type: 'text' } });
  assert.equal(mock.classes.has('has-unsaved-changes'), true);
  assert.equal(app._configPresentationDirty, true);
  assert.equal(mock.listeners.size, 3);
  app._configPresentationCleanup();
  assert.equal(mock.listeners.size, 0);
});

test('dynamic add/remove actions mark dirty without changing saved layout objects', () => {
  const mock = eventRoot();
  const app = { element: { querySelector() { return mock.node; } } };
  bindLayoutConfigPresentation(app);
  mock.listeners.get('click')({ target: { closest() { return { dataset: { action: 'addResource' }, hasAttribute() { return false; } }; } } });
  assert.equal(app._configPresentationDirty, true);
  bindLayoutConfigPresentation(app);
  assert.equal(mock.listeners.size, 3, 'rerender should replace rather than stack listeners');
});
