import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {toggleFootprintCell, footprintBounds, connectedCells, neighboringCell} from '../scripts/core/shape-editor-model.js';
import {normalizeItemShape} from '../scripts/core/inventory-shapes.js';
const read = path => fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('shape editor grows directly from item, never fills disconnected cells',()=>{
  let cells=[{x:2,y:2}];
  assert.equal(toggleFootprintCell(cells,{x:4,y:4}),null);
  cells=toggleFootprintCell(cells,{x:3,y:2});
  cells=toggleFootprintCell(cells,{x:3,y:3});
  assert.deepEqual(footprintBounds(cells),{minX:2,minY:2,width:2,height:2});
  assert.equal(connectedCells(cells),true);
  assert.equal(neighboringCell({x:4,y:3},cells),true);
  assert.equal(toggleFootprintCell(cells,{x:5,y:3}),null);
});
test('shape editor cannot remove bridge cells or final cell',()=>{
  const cells=[{x:1,y:1},{x:2,y:1},{x:3,y:1}];
  assert.equal(toggleFootprintCell(cells,{x:2,y:1}),null);
  assert.deepEqual(toggleFootprintCell(cells,{x:3,y:1}),cells.slice(0,2));
  assert.equal(toggleFootprintCell([{x:2,y:2}],{x:2,y:2}),null);
});
test('shape geometry remains bounded and saving normalizes positions',()=>{
  const cells=Array.from({length:8},(_,i)=>({x:i,y:1}));
  assert.equal(toggleFootprintCell(cells,{x:8,y:1}),null);
  const saved=normalizeItemShape({cells:[{x:2,y:4},{x:2,y:5},{x:3,y:5}]});
  assert.deepEqual(saved.cells,[{x:0,y:0},{x:0,y:1},{x:1,y:1}]);
});
test('item size editor displays real item artwork directly in the footprint grid',()=>{
  const tpl=read('templates/item-config.hbs');
  const logic=read('scripts/apps/item-shape-editor.js');
  const css=read('styles/131-shape-editor-stability.css');
  assert.match(tpl,/data-item-shape-grid/);
  assert.doesNotMatch(tpl,/data-item-shape-preview/);
  assert.doesNotMatch(tpl,/<details class="buxa-footprint-art-controls">/);
  assert.match(logic,/toggleFootprintCell\(cells,\{x:Number\(tile/);
  assert.match(logic,/fragment\.append\(layer,controls\)/);
  assert.match(logic,/shapeArtworkStyle\(s\)/);
  assert.match(css,/\.buxa-shape-tile\.is-extendable/);
  assert.match(read('styles/133-direct-size-editor.css'),/grid-template-rows:repeat\(8,minmax\(0,1fr\)\)/);
});
test('active player-sheet tab is present before DOM insertion to prevent Basic flash',()=>{
  const app=read('scripts/apps/player-sheet.js');
  const tpl=read('templates/player-sheet.hbs');
  assert.match(app,/this\.#restoreUiState\(\);\s*const context = await super\._prepareContext/);
  assert.match(app,/prepared\.isInventoryTab=this\._activeTab==='inventory'/);
  assert.match(tpl,/data-sheet-panel="inventory" \{\{#unless isInventoryTab\}\}hidden/);
  assert.match(tpl,/data-sheet-panel="basic" \{\{#unless isBasicTab\}\}hidden/);
  assert.match(tpl,/data-sheet-tab="inventory"[^>]*aria-selected="\{\{isInventoryTab\}\}"/);
});
test('item configuration also paints the correct active tab before a redraw',()=>{
  const app=read('scripts/apps/item-config.js');
  const tpl=read('templates/item-config.hbs');
  assert.match(app,/activeConfigTabs:\s*Object\.fromEntries/);
  for(const name of ['info','basic','increase','dice','size','control']){
    assert.ok(tpl.includes(`data-item-config-panel="${name}" {{#unless activeConfigTabs.${name}}}hidden{{/unless}}`));
    assert.ok(tpl.includes(`aria-selected="{{activeConfigTabs.${name}}}"`));
  }
});
