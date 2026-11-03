import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { InventoryFootprintPreview } from '../scripts/apps/inventory-footprint-preview.js';
import { createPlacementScanner, shapeBounds, firstFitAdditionalShape } from '../scripts/core/inventory-shapes.js';
import { getInventoryDropDestination } from '../scripts/apps/inventory-drop-target.js';

const L = { cells: [{x:0,y:0},{x:0,y:1},{x:1,y:1}] };
const makeBoard = () => {
  let writes = 0;
  const cells = Array.from({length:12}, () => ({ classList: {
    add() {writes++}, remove() {writes++}
  }}));
  return { board: {
    querySelectorAll:()=>cells,
    classList:{add(){},remove(){}}
  }, writes:()=>writes };
};

test('cached preview gives the same actual validity without touching DOM repeatedly', () => {
  const stub = makeBoard();
  const scanner = createPlacementScanner({item:L,blocker:{}},{columns:4,rows:3});
  const preview = new InventoryFootprintPreview(stub.board,scanner,'item');
  assert.equal(preview.update(0,0),true);
  const writes = stub.writes();
  assert.equal(preview.update(0,0),true);
  assert.equal(preview.update(0,0),true);
  assert.equal(stub.writes(),writes);
  scanner.occupy('blocker',11,0);
  assert.equal(preview.update(8,0),false);
  const otherWrites=stub.writes();
  assert.equal(preview.update(8,0),false);
  assert.equal(stub.writes(),otherWrites);
  preview.clear();
  assert.equal(preview.update(0,0),true);
  preview.destroy();
});

test('corrupted off-grid item placement cannot partially block an inventory cell', () => {
  const scanner = createPlacementScanner({L},{columns:3,rows:2});
  scanner.occupy('L',2,0); // extends across right edge
  scanner.occupy('L',5,0); // extends past last row
  assert.equal(scanner.occupied.size,0);
  assert.equal(scanner.firstFit('L',0),0);
  assert.deepEqual(shapeBounds([]),{width:0,height:0});
  assert.equal(firstFitAdditionalShape({L:{area:'inventory',index:2}},{L},'L',{columns:3,rows:2}),0);
});

test('complex grid reads declared rows rather than rounding a bordered DOM rectangle', () => {
  const board = {
    style:{getPropertyValue: name => name.endsWith('columns')?'4':name.endsWith('rows')?'2':''},
    getBoundingClientRect:()=>({left:20,top:30,width:200,height:124}),
  };
  const target={closest: selector => selector === '[data-complex-board]' ? board : null};
  const event = (x,y)=>({target,clientX:x,clientY:y,anchorX:x,anchorY:y});
  assert.deepEqual(getInventoryDropDestination(event(40,55)),{area:'inventory',index:0});
  assert.deepEqual(getInventoryDropDestination(event(100,105)),{area:'inventory',index:5});
  assert.equal(getInventoryDropDestination(event(40,145)),null); // visual third row is not real
});

test('equipment tab selection survives rerender without a forced Basic/default tab flash', async () => {
  const context = await readFile(new URL('../scripts/apps/player-sheet-context.js',import.meta.url),'utf8');
  const controls = await readFile(new URL('../scripts/apps/inventory-controls.js',import.meta.url),'utf8');
  const template = await readFile(new URL('../templates/player-sheet.hbs',import.meta.url),'utf8');
  assert.match(context,/sheet\._activeEquipmentTab = currentEquipmentTab/);
  assert.match(controls,/sheet\._activeEquipmentTab = id/);
  assert.match(template,/data-equipment-tab="{{id}}" class="{{#if selected}}is-active/);
  assert.match(template,/data-equipment-tab-panel="{{id}}" {{#unless selected}}hidden/);
});

test('complex inventory does not allocate simple slot views and full packing is not repeated during reconciliation', async () => {
  const inventory = await readFile(new URL('../scripts/apps/inventory-context.js',import.meta.url),'utf8');
  const state = await readFile(new URL('../scripts/core/inventory.js',import.meta.url),'utf8');
  assert.match(inventory,/length: complexMode \? 0 : inventoryConfig\.slots/);
  const reconcile = state.slice(state.indexOf('export async function reconcileInventoryState'));
  assert.doesNotMatch(reconcile,/sortInventoryState\(/);
});

test('drag only responds to its owning pointer and cancels unrelated touches safely', async () => {
  const code = await readFile(new URL('../scripts/apps/inventory-controls.js',import.meta.url),'utf8');
  assert.match(code,/if \(moveEvent\.pointerId !== pointerId\) return/);
  assert.match(code,/if \(endEvent\.pointerId !== pointerId\) return/);
  assert.match(code,/if \(cancelEvent\?\.pointerId != null && cancelEvent\.pointerId !== pointerId\) return/);
});
