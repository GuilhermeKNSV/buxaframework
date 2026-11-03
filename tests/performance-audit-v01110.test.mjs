import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlacementScanner, rotatedCells, occupiedCells, packShapes, canPlaceShape } from '../scripts/core/inventory-shapes.js';
import { getSheetConfig, invalidateSheetConfigCache, normalizeSheetConfig } from '../scripts/core/config.js';

const cells = [{x:0,y:0},{x:1,y:0},{x:0,y:1}];

test('cached footprint variants represent exactly the same cells as public rotation', () => {
  const shapes = { a: { cells } };
  const scan = createPlacementScanner(shapes, {columns:10,rows:10});
  for (let i=-7;i<=7;i++) assert.deepEqual(scan.cellsFor('a',i), rotatedCells(shapes.a,i));
});

test('a drag collision scanner calculates shape geometry once per item', () => {
  let reads = 0;
  const shapes = {a: {get cells() { reads++; return cells; }}};
  const scan = createPlacementScanner(shapes,{columns:12,rows:12});
  for(let i=0;i<120;i++) {
    const point = i % 100;
    scan.fits('a',point,i%4);
  }
  assert.equal(reads,1,'avoid rereading and normalizing item flags for every pointer frame');
});

test('packed inventories keep all occupied cells unique with dozens of irregular shapes', () => {
  const shapes = Object.fromEntries(Array.from({length:55},(_,i)=>[`shape-${i}`,{
    cells: i%3===0 ? cells : i%3===1 ? [{x:0,y:0},{x:0,y:1}] : [{x:0,y:0}]
  }]));
  const grid={columns:15,rows:12};
  const placed = packShapes(Object.keys(shapes),shapes,grid);
  assert.equal(Object.keys(placed).length,55);
  const occupancy=occupiedCells(placed,shapes,grid);
  const expected = Object.entries(placed).reduce((n,[id,place])=>n+rotatedCells(shapes[id],place.rotation).length,0);
  assert.equal(occupancy.size,expected);
  for(const [id,place] of Object.entries(placed)) assert.ok(canPlaceShape(placed,shapes,id,place.index,place.rotation,grid));
});

test('world configuration is normalized only once for the same stored object, but invalidates', () => {
  const originalGame=globalThis.game,originalFoundry=globalThis.foundry;
  const raw={inventory:{mode:'complex',complex:{columns:8,rows:6}},resources:[]};
  globalThis.foundry={utils:{deepClone:structuredClone,randomID:()=> 'random'}};
  globalThis.game={settings:{get:()=>raw}};
  try {
    invalidateSheetConfigCache();
    const first=getSheetConfig();
    assert.strictEqual(getSheetConfig(),first);
    const next={...raw,inventory:{slots:44}};
    globalThis.game.settings.get=()=>next;
    const changed=getSheetConfig();
    assert.notStrictEqual(first,changed);
    assert.equal(changed.inventory.slots,44);
    invalidateSheetConfigCache();
    assert.notStrictEqual(getSheetConfig(),changed);
    assert.deepEqual(getSheetConfig(),normalizeSheetConfig(next));
  } finally {
    invalidateSheetConfigCache();
    globalThis.game=originalGame;globalThis.foundry=originalFoundry;
  }
});

test('drag does not scan actor item shapes until pointer movement starts', async () => {
  const {readFile} = await import('node:fs/promises');
  const source = await readFile(new URL('../scripts/apps/inventory-controls.js',import.meta.url),'utf8');
  const begin = source.indexOf('const beginDrag = (event) =>');
  const move = source.indexOf('const move = (moveEvent)',begin);
  assert.ok(begin>=0&&move>begin);
  assert.match(source.slice(begin,move),/const prepareComplexDrag = \(\) =>/);
  const beforeMove = source.slice(begin,move);
  const moveBody = source.slice(move,source.indexOf('const cleanup',move));
  assert.ok(!beforeMove.includes('prepareComplexDrag();'),'item shapes must not be scanned merely on pointerdown');
  assert.ok(moveBody.includes('prepareComplexDrag();'));
});
