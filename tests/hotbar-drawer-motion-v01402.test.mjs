import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setHotbarAttributeDrawerState } from '../scripts/apps/hotbar-view.js';

function harness() {
  const attrs = {};
  const classes = new Set();
  const tray = { inert: true, setAttribute: (k, v) => { attrs[`tray-${k}`] = v; } };
  const toggle = { title: 'Show attribute rolls', setAttribute: (k, v) => { attrs[`toggle-${k}`] = v; } };
  const drawer = {
    classList: { toggle: (name, on) => { if (on) classes.add(name); else classes.delete(name); } },
    querySelector: selector => selector === '.buxa-hb-attributes' ? tray : selector === '[data-hb-action="attributes"]' ? toggle : null
  };
  const root = { querySelector: selector => selector === '.buxa-hb-attribute-drawer' ? drawer : null };
  return { root, attrs, classes, tray, toggle };
}

test('attribute drawer opens and closes IN PLACE without detaching roll tiles', () => {
  const h = harness();
  assert.equal(setHotbarAttributeDrawerState(h.root, true), true);
  assert.equal(h.classes.has('is-open'), true);
  assert.equal(h.tray.inert, false);
  assert.equal(h.attrs['tray-aria-hidden'], 'false');
  assert.equal(h.attrs['toggle-aria-expanded'], 'true');
  assert.equal(h.toggle.title, 'Hide attribute rolls');
  assert.equal(setHotbarAttributeDrawerState(h.root, false), true);
  assert.equal(h.classes.has('is-open'), false);
  assert.equal(h.tray.inert, true);
  assert.equal(h.attrs['tray-aria-hidden'], 'true');
  assert.equal(h.attrs['toggle-aria-expanded'], 'false');
  assert.equal(h.toggle.title, 'Show attribute rolls');
  assert.equal(setHotbarAttributeDrawerState(h.root, true), true, 'rapid reversal uses the same drawer');
  assert.equal(h.classes.has('is-open'), true);
  assert.equal(setHotbarAttributeDrawerState({}, true), false);
});

test('closed drawer retreats behind the slot board; handle remains accessible and square', () => {
  const css = readFileSync(new URL('../styles/163-hotbar.css', import.meta.url), 'utf8');
  const controller = readFileSync(new URL('../scripts/apps/hotbar.js', import.meta.url), 'utf8');
  const view = readFileSync(new URL('../scripts/apps/hotbar-view.js', import.meta.url), 'utf8');
  assert.match(css, /\.buxa-hb-attribute-drawer\s*\{[^}]*transform:translate\(-50%,calc\(100% - 1px\)\);[^}]*transition:transform/s);
  assert.match(css, /\.buxa-hb-attribute-drawer\.is-open\s*\{transform:translate\(-50%,0\)/);
  assert.match(css, /\.buxa-hb-attribute-toggle\s*\{[^}]*bottom:calc\(100% - 1px\);[^}]*border-radius:0;/s);
  assert.match(css, /\.buxa-hb-board-frame\s*\{[^}]*z-index:2/);
  assert.match(css, /\.buxa-hb-rail\s*\{[^}]*pointer-events:none/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(view, /drawer\.append\(tray, toggle\)/);
  assert.match(view, /tray\.inert = !attributesOpen/);
  assert.match(controller, /setHotbarAttributeDrawerState\(root, this\.attributesOpen\)/);
});
