import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hotbarAttributeColumns } from '../scripts/apps/hotbar-attributes.js';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('attribute rail has balanced columns without a full-width vacant slab', () => {
  assert.equal(hotbarAttributeColumns(0), 1);
  assert.equal(hotbarAttributeColumns(1), 1);
  assert.equal(hotbarAttributeColumns(5), 5);
  assert.equal(hotbarAttributeColumns(8), 8);
  assert.equal(hotbarAttributeColumns(9), 5);
  assert.equal(hotbarAttributeColumns(10), 5);
  assert.equal(hotbarAttributeColumns(14), 7);
  assert.equal(hotbarAttributeColumns(17), 6);
  assert.equal(hotbarAttributeColumns(24), 8);
});

test('attribute rail centers content and never spans the entire action bar by default', () => {
  const css = read('styles/163-hotbar.css');
  assert.match(css, /\.buxa-hb-attribute-drawer\s*\{[^}]*left:50%;[^}]*width:max-content;/s);
  assert.match(css, /\.buxa-hb-attribute-list\s*\{[^}]*--buxa-hb-roll-tile:48px;[^}]*--buxa-hb-roll-columns/s);
  assert.match(css, /\.buxa-hb-attribute-toggle\s*\{[^}]*left:50%;[^}]*bottom:calc\(100% - 1px\)/s);
  assert.match(css, /@media \(max-width:520px\)/);
});

test('nonstandard dice are indicated subtly; normal dice remain available in the tooltip', () => {
  const code = read('scripts/apps/hotbar-attributes.js');
  const css = read('styles/163-hotbar.css');
  assert.match(code, /dice > 1 \? 'buxa-hb-attribute has-extra-dice'/);
  assert.match(code, /tile\.title = .*\$\{dice\}d20/);
  assert.match(css, /\.buxa-hb-attr-dice \{display:none;/);
  assert.match(css, /\.buxa-hb-attribute\.has-extra-dice \.buxa-hb-attr-dice \{display:block;/);
});

test('the drawer remains mounted for smooth open and close without replaying on refresh', () => {
  const view = read('scripts/apps/hotbar-view.js');
  const code = read('scripts/apps/hotbar.js');
  const css = read('styles/163-hotbar.css');
  assert.match(view, /drawer\.append\(tray, toggle\)/);
  assert.match(view, /tray\.inert = !attributesOpen/);
  assert.match(view, /setHotbarAttributeDrawerState/);
  assert.match(code, /setHotbarAttributeDrawerState\(root, this\.attributesOpen\)/);
  assert.doesNotMatch(code, /previouslyExpanded|is-revealing/);
  assert.match(css, /\.buxa-hb-attribute-drawer\.is-open\s*\{transform:translate\(-50%,0\)/);
  assert.match(css, /transform:translate\(-50%,calc\(100% - 1px\)\)/);
  assert.match(css, /border-radius:0;/);
});
