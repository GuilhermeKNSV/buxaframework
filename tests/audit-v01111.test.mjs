import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {firstFitAdditionalShape, occupiedCells} from '../scripts/core/inventory-shapes.js';
import {buildComplexHitMap} from '../scripts/core/inventory-hit-map.js';

const pair = {cells:[{x:0,y:0},{x:1,y:0}]};
test('complex unstack checks all occupied cells of the original source stack', () => {
  const placements={old:{area:'inventory',index:0}};
  assert.equal(firstFitAdditionalShape(placements,{old:pair},'old',{columns:2,rows:1}),null);
});

test('splitting a multi-cell stack refuses a full board and finds a truly free footprint', () => {
  const placements={old:{area:'inventory',index:0}};
  assert.equal(firstFitAdditionalShape(placements,{old:pair},'old',{columns:2,rows:1}),null);
  assert.equal(firstFitAdditionalShape(placements,{old:pair},'old',{columns:4,rows:1}),2);
  assert.equal(firstFitAdditionalShape(placements,{old:pair},'old',{columns:3,rows:1}),null);
  assert.deepEqual([...occupiedCells({old:placements.old,copy:{area:'inventory',index:2}}, {old:pair,copy:pair},{columns:4,rows:1}).keys()], [0,1,2,3]);
});

test('a complex cell hit map references all occupied parts, including rotated and L shapes', () => {
  const occupancy = buildComplexHitMap([
    {id:'L',index:6,pieces:[{x:0,y:0},{x:0,y:1},{x:1,y:1}]},
    {id:'blade',index:2,pieces:[{x:0,y:0},{x:1,y:0}]}
  ],5);
  assert.deepEqual([...occupancy.entries()].sort((a,b)=>a[0]-b[0]),[[2,'blade'],[3,'blade'],[6,'L'],[11,'L'],[12,'L']]);
});

test('size editor hit testing does not scan Foundry actor flags when touching grid cells', async()=>{
  const input=await readFile(new URL('../scripts/apps/inventory-board-hit-bindings.js',import.meta.url),'utf8');
  const from=input.indexOf('const bindComplexBoardHits=(board,storage=false)=>');
  const end=input.indexOf('  const complexBoard=',from);
  const handler=input.slice(from,end);
  assert.ok(from>=0 && end>from);
  assert.match(handler,/dataset.hitItemId/);
  assert.match(handler,/resolveComplexPointerHit/);
  assert.doesNotMatch(handler,/getInventoryState|normalizeItemShape|rotatedCells/);
});

test('scanner ignores invalid stored origins instead of blocking unrelated cells',async()=>{
  const {createPlacementScanner}=await import('../scripts/core/inventory-shapes.js');
  const scan=createPlacementScanner({a:pair,b:pair},{columns:4,rows:1});
  scan.occupy('a',-1);
  scan.occupy('a',10);
  assert.equal(scan.occupied.size,0);
  assert.equal(scan.firstFit('b'),0);
});
