import test from 'node:test';
import assert from 'node:assert/strict';
import {nearestExternalComplexPlacement} from '../scripts/core/external-item-placement.js';
import {canPlaceShape} from '../scripts/core/inventory-shapes.js';
import {createPlacementScanner} from '../scripts/core/inventory-shapes.js';
import {readFileSync} from 'node:fs';
const grid={columns:7,rows:5,activeCells:35};
const shapes={
  blade:{cells:[{x:0,y:0},{x:1,y:0},{x:0,y:1},{x:1,y:1},{x:1,y:2}]},
  coin:{cells:[{x:0,y:0}]},
  lshape:{cells:[{x:0,y:0},{x:0,y:1},{x:1,y:1}]}
};
test('an external 2×3 item dropped on the right edge snaps to a nearby fitting origin',()=>{
  const index=nearestExternalComplexPlacement({placements:{},shapes,itemId:'blade',requestedIndex:6,grid});
  assert.equal(index,5);
  assert.equal(canPlaceShape({},shapes,'blade',index,0,grid),true);
});
test('complex ghost can occupy actual holes beside irregular masks',()=>{
  const placements={lshape:{area:'inventory',index:7}};
  const index=nearestExternalComplexPlacement({placements,shapes,itemId:'coin',requestedIndex:8,grid});
  assert.equal(index,8,'unoccupied top-right gap is not blocked by bounding box');
  const occupied=nearestExternalComplexPlacement({placements,shapes,itemId:'coin',requestedIndex:14,grid});
  assert.notEqual(occupied,14,'actually occupied square stays blocked');
});
test('incoming item never overlaps a rotated occupied shape',()=>{
  const placements={lshape:{area:'inventory',index:8,rotation:1},coin:{area:'inventory',index:20}};
  const idx=nearestExternalComplexPlacement({placements,shapes,itemId:'blade',requestedIndex:9,grid});
  assert.ok(idx!==null);
  const scan=createPlacementScanner(shapes,grid);
  for(const [id,placement] of Object.entries(placements))scan.occupy(id,placement.index,placement.rotation||0);
  assert.equal(scan.fits('blade',idx),true);
});
test('no available shape space refuses a transfer without manufacturing extra slots',()=>{
  const tiny={columns:2,rows:2,activeCells:4};
  assert.equal(nearestExternalComplexPlacement({placements:{},shapes,itemId:'blade',requestedIndex:0,grid:tiny}),null);
});
test('the live Actor sheet exposes its Actor ID as a document drop target',()=>{
  const src=readFileSync(new URL('../scripts/apps/player-sheet.js',import.meta.url),'utf8');
  assert.match(src,/this\.element\.dataset\.buxaDropActorId\s*=\s*this\.actor\.id/);
  assert.match(src,/this\.element\.dataset\.buxaDropTokenId/);
});
test('world Item native drag has a registered ghost preview and a capture-phase destination bridge',()=>{
  const src=readFileSync(new URL('../scripts/integrations/physical-item-handoff.js',import.meta.url),'utf8');
  assert.match(src,/document\.addEventListener\('dragstart'/);
  assert.match(src,/showPhysicalInventoryPreview\(item,target,event\.clientX,event\.clientY\)/);
  assert.match(src,/event\.stopImmediatePropagation\(\)/);
});
