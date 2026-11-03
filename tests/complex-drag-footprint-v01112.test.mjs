import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { rotatedCells, createPlacementScanner } from '../scripts/core/inventory-shapes.js';
import { InventoryFootprintPreview, projectFootprint } from '../scripts/apps/inventory-footprint-preview.js';

const L = { cells:[{ x:0,y:0 },{ x:0,y:1 },{ x:1,y:1 }] };

function boardStub(columns, rows) {
  const makeCell = () => {
    const values = new Set();
    return { values, classList: {
      add(name) { values.add(name); }, remove(name) { values.delete(name); },
      contains(name) { return values.has(name); }
    }};
  };
  const cells = Array.from({length:columns*rows},makeCell);
  const states = new Set();
  const board = {
    classList: { add(s) { states.add(s); }, remove(s) { states.delete(s); } },
    querySelectorAll: () => cells
  };
  return { board, cells, states };
}

const highlighted = cells => cells.map((cell, i) => [...cell.values].length ? i : -1).filter(x => x >= 0);

test('all occupied squares of an L item are projected as a single footprint', () => {
  const cells = rotatedCells(L);
  assert.deepEqual(projectFootprint(6,cells,5,4), {indexes:[6,11,12],fitsBounds:true});
  assert.deepEqual(projectFootprint(6,rotatedCells(L,1),5,4), {indexes:[6,7,11],fitsBounds:true});
  assert.deepEqual(projectFootprint(4,rotatedCells(L),5,4), {indexes:[4,9],fitsBounds:false});
  assert.deepEqual(projectFootprint(-1,rotatedCells(L),5,4), {indexes:[],fitsBounds:false});
});

test('full valid footprint highlights, rotates, and cleans up without affecting original items', () => {
  const {board,cells,states} = boardStub(5,4);
  const scanner = createPlacementScanner({moving:L},{columns:5,rows:4});
  const preview = new InventoryFootprintPreview(board,scanner,'moving');
  assert.ok(states.has('is-footprint-preview-active'));
  assert.equal(preview.update(6,0),true);
  assert.deepEqual(highlighted(cells),[6,11,12]);
  for (const index of [6,11,12]) assert.ok(cells[index].values.has('is-footprint-valid'));
  assert.equal(preview.update(6,1),true);
  assert.deepEqual(highlighted(cells),[6,7,11]);
  assert.equal(preview.update(6,1),true); // cached validity must remain stable without repeated DOM writes
  preview.destroy();
  assert.deepEqual(highlighted(cells),[]);
  assert.equal(states.size,0);
});

test('collision and edge preview is red across the attempted shape', () => {
  const {board,cells} = boardStub(5,4);
  const scanner = createPlacementScanner({moving:L,blocker:{cells:[{x:0,y:0}]}},{columns:5,rows:4});
  scanner.occupy('blocker',11,0);
  const preview = new InventoryFootprintPreview(board,scanner,'moving');
  assert.equal(preview.update(6,0),false);
  assert.deepEqual(highlighted(cells),[6,11,12]);
  assert.ok(cells[11].values.has('is-footprint-collision'));
  assert.ok(cells[6].values.has('is-footprint-invalid'));
  assert.equal(preview.update(4,0),false);
  assert.deepEqual(highlighted(cells),[4,9]);
  assert.ok(cells[4].values.has('is-footprint-invalid'));
  preview.update(null,0);
  assert.deepEqual(highlighted(cells),[]);
  preview.destroy();
});

test('drag ghost dimensions use rotated shape bounds and never enforce a one-square ratio',async()=>{
  const code=await readFile(new URL('../scripts/apps/inventory-controls.js',import.meta.url),'utf8');
  const css=await readFile(new URL('../styles/135-complex-drag-footprint.css',import.meta.url),'utf8');
  assert.match(code,/ghost\.style\.width\s*=\s*`\$\{bounds\.width\s*\*\s*cell\}px`/);
  assert.match(code,/ghost\.style\.height\s*=\s*`\$\{bounds\.height\s*\*\s*cellHeight\}px`/);
  assert.match(code,/InventoryFootprintPreview\(board, collisionScanner, itemId\)/);
  const dropTarget=await readFile(new URL('../scripts/apps/inventory-drop-target.js',import.meta.url),'utf8');
  assert.match(dropTarget,/return null;\s*}\s*const position/);
  assert.match(css,/aspect-ratio: auto !important/);
  assert.match(css,/is-footprint-valid/);
  assert.match(css,/is-footprint-collision/);
});
