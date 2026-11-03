import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const source = await readFile(new URL('scripts/apps/sidebar-edit-buttons.js',root),'utf8');
const dock = await readFile(new URL('scripts/apps/sidebar-edit-dock.js',root),'utf8');
const style = await readFile(new URL('styles/182-sidebar-dock-polish.css',root),'utf8');
const imports = await readFile(new URL('styles/buxa.css',root),'utf8');

test('sidebar edit has a narrow separate floating dock instead of the old grid panel',()=>{
  assert.match(dock,/buxa-sb-toolbar buxa-sb-dock/);
  assert.match(style,/--buxa-sbp-dock-width:\s*52px/);
  assert.match(style,/width:var\(--buxa-sbp-dock-width\)/);
  assert.doesNotMatch(source,/buxa-sb-toolbar-heading/);
  assert.match(source,/this\.dockCollapsed/);
  assert.match(style,/\.is-compact \.buxa-sb-dock-extras/);
  assert.match(imports, /181-sidebar-edit-buttons\.css[\s\S]*182-sidebar-dock-polish\.css/);
});
test('save and reset actions preserve personal and world persistence APIs',()=>{
  assert.match(source,/game\.user\.setFlag\(MODULE_ID,SIDEBAR_LAYOUT_KEY,layout\)/);
  assert.match(source,/game\.settings\.set\(MODULE_ID,SIDEBAR_WORLD_KEY,\{layout,visibility:this\.draftWorld\.visibility\}\)/);
  assert.match(source,/game\.user\.unsetFlag\(MODULE_ID,SIDEBAR_LAYOUT_KEY\)/);
  assert.match(dock,/this\.toggleDockMenu\('more'\)/);
  assert.match(dock,/this\.toggleDockMenu\(\)/);
});
test('floating editor menus use bubbles, no full-screen dialog backdrop',()=>{
  assert.match(source,/buxa-sb-context buxa-sb-bubbles/);
  assert.match(style,/--buxa-sbp-bubble-radius:\s*0\s*;/);
  assert.match(source,/buxa-sb-dialog buxa-sb-side-card/);
  assert.doesNotMatch(source,/make\('div','buxa-sb-dialog-backdrop'\)/);
  assert.match(source,/this\.positionSideCard\(modal,this\.dialogAnchor\)/);
  assert.match(style,/\.buxa-sb-side-card \.buxa-sb-player-list\[hidden\]\{display:none!important;\}/);
});
test('context actions remain protected and close on scroll / Escape',()=>{
  assert.match(source,/id==='settings'\)/);
  assert.match(source,/id==='settings'\);/);
  assert.match(source,/document\.addEventListener\('scroll', \(\) => \{ this\.closeMenu\(\); this\.closeDockMenu\(\); \}/);
  assert.match(source,/e\.key === 'Escape'/);
  assert.match(style, /\.buxa-sb-context\.buxa-sb-bubbles\.is-leaving \.buxa-sb-context-action/);
});
test('animations and palette support reduced motion and theme adjustments',()=>{
  for(const name of ['--buxa-sbp-radius','--buxa-sbp-speed','--buxa-sbp-accent','--buxa-sbp-glass','--buxa-sbp-bubble-size']) assert.ok(style.includes(name),name);
  assert.match(style,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(style,/buxa-sbp-dock-arrive/);
  assert.match(style,/buxa-sbp-bubble-in/);
  assert.match(style,/buxa-sbp-card-in/);
});
