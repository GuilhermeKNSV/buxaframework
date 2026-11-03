import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeItemShape, rotatedCells, shapeBounds, canPlaceShape, firstFitShape, packShapes, occupiedCells} from '../scripts/core/inventory-shapes.js';
import {normalizeInventoryConfig} from '../scripts/core/inventory-config.js';
import {actorGhostPlacement} from '../scripts/apps/actor-token-ghost.js';
const read = path => fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const shape={cells:[{x:0,y:0},{x:0,y:1},{x:1,y:1}]};
test('L-shape stays normalized and rotates in four unique orientations',()=>{
  assert.deepEqual(rotatedCells(shape,0),[{x:0,y:0},{x:0,y:1},{x:1,y:1}]);
  const positions=Array.from({length:4},(_,i)=>JSON.stringify(rotatedCells(shape,i)));
  assert.equal(new Set(positions).size,4);
  assert.deepEqual(rotatedCells(shape,4),rotatedCells(shape,0));
  assert.equal(shapeBounds(rotatedCells(shape,1)).width,2);
});
test('invalid/duplicate cell coordinates are normalized and never empty',()=>{
  const item=normalizeItemShape({cells:[{x:7,y:7},{x:7,y:7},{x:8,y:7}],imageScale:500,imageX:-20});
  assert.deepEqual(item.cells,[{x:0,y:0}]);
  assert.equal(item.imageScale,300);assert.equal(item.imageX,0);
  assert.deepEqual(normalizeItemShape({cells:[]}).cells,[{x:0,y:0}]);
});
test('shaped items cannot overlap existing occupied cells or spill beyond board',()=>{
  const shapes={a:shape,b:shape,c:normalizeItemShape(null)};
  const placements={a:{area:'inventory',index:0}};
  const dimensions={columns:4,rows:4};
  assert.equal(canPlaceShape(placements,shapes,'b',0,0,dimensions),false);
  assert.equal(canPlaceShape(placements,shapes,'b',1,0,dimensions),false);
  assert.equal(canPlaceShape(placements,shapes,'b',2,0,dimensions),true);
  assert.equal(canPlaceShape(placements,shapes,'b',3,0,dimensions),false);
  assert.equal(occupiedCells(placements,shapes,dimensions).size,3);
  assert.equal(firstFitShape(placements,shapes,'c',0,dimensions),1);
});
test('auto pack largest-first retains non-overlapping items and cleanly overflows',()=>{
  const shapes={a:shape,b:shape,c:{cells:[{x:0,y:0}]}};
  const grid={columns:2,rows:3};
  const placements=packShapes(['c','a','b'],shapes,grid);
  assert.equal(Object.keys(placements).length,2);
  assert.ok(placements.a);
  const occupied=occupiedCells(placements,shapes,grid);
  assert.equal(occupied.size,4);
  for(const [id,position] of Object.entries(placements)){
    assert.ok(canPlaceShape({...placements,[id]:undefined},shapes,id,position.index,position.rotation||0,grid));
  }
});
test('simple remains default; complex can disable auto-sort',()=>{
  const old=normalizeInventoryConfig({slots:50});assert.equal(old.mode,'simple');
  assert.equal(old.slots,50);assert.equal(old.equipmentLayout.tabs[0].label,'Main');
  const cfg=normalizeInventoryConfig({mode:'complex',complex:{columns:12,rows:6,autoSort:false}});
  assert.deepEqual(cfg.complex,{columns:12,rows:6,autoSort:false});
});
test('equipment tabs preserve independent grid size and slot placement',()=>{
  const layout=normalizeInventoryConfig({equipmentLayout:{columns:10,rows:6,tabs:[
    {id:'main',label:'Gear',columns:10,rows:6},{id:'bag',label:'Backpacks',columns:18,rows:9}
  ],slots:[{id:'weapon-1',type:'weapon',tabId:'main',x:2,y:2},{id:'bag-1',type:'backpack',tabId:'bag',x:15,y:5}]}}).equipmentLayout;
  assert.equal(layout.tabs.length,2);assert.equal(layout.slots[0].tabId,'main');
  assert.equal(layout.slots[1].x,15);assert.equal(layout.slots[1].tabId,'bag');
});
test('gridless scenes bypass native snapping when placing actor ghosts',()=>{
  const actor={prototypeToken:{width:1,height:1}};
  const makeCanvas=type=>({ready:true,scene:{grid:{type}},dimensions:{size:100},
    canvasCoordinatesFromClient:c=>({...c}),
    clientCoordinatesFromCanvas:c=>({...c}),
    tokens:{getSnappedPoint:()=>({x:0,y:0})}});
  const gridless=actorGhostPlacement(actor,makeCanvas(0),{x:153,y:167});
  assert.equal(gridless.x,103);assert.equal(gridless.y,117);
  const snapped=actorGhostPlacement(actor,makeCanvas(1),{x:153,y:167});
  assert.equal(snapped.x,0);assert.equal(snapped.y,0);
});
test('size editor, complex sheet and rotate-key handler all included',()=>{
  assert.match(read('templates/item-config.hbs'),/data-item-config-panel="size"/);
  assert.match(read('templates/player-sheet.hbs'),/data-complex-item/);
  assert.match(read('scripts/apps/inventory-controls.js'),/e\.key\.toLowerCase\(\)\s*!==\s*'r'/);
  assert.match(read('templates/equipment-layout.hbs'),/data-tab-add/);
  assert.match(read('templates/layout-config.hbs'),/data-inventory-mode/);
});
