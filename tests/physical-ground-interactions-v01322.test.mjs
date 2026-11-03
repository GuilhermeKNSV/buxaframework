import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {findCanvasItemTargetAtPoint} from '../scripts/integrations/canvas-item-drop-target.js';
import {groundMoveWithin,groundPlacement,groundAddBranch,groundDirectItems} from '../scripts/core/ground-container.js';
const storage={slots:{external:[{id:'main',label:'PACK',columns:4,rows:3,mode:'complex',cells:[0,1,2,3,4,5,6,7,8,9,10,11]}]}};
const base=()=>({id:'chest',x:100,y:100,size:76,data:{name:'Chest',flags:{buxaframework:{item:{storage},backpackContents:[]}}}});
const item=(name,cells)=>({name,flags:{buxaframework:{item:{shape:{cells}}}},system:{quantity:1}});
const makeId=(()=>{let index=0;return()=>`content-${++index}`})();
test('canvas item hits storage first, then Actor token, ignores hidden scene containers',()=>{
  const scene={id:'scene-1',grid:{size:100}};
  const chest=base();
  const token={document:{id:'tok',x:100,y:100,width:1,height:1},actor:{id:'hero'}};
  const opts={scene,tokens:[token],records:[chest],user:{id:'gm',isGM:true}};
  assert.deepEqual(findCanvasItemTargetAtPoint({x:130,y:130},{...opts,visible:()=>true}),{kind:'ground-container',containerId:'chest',sceneId:'scene-1'});
  assert.deepEqual(findCanvasItemTargetAtPoint({x:130,y:130},{...opts,visible:()=>false}),{kind:'actor',actorId:'hero',targetTokenId:'tok',sceneId:'scene-1',position:null});
  assert.equal(findCanvasItemTargetAtPoint({x:500,y:500},opts),null);
});
test('shaped chest items move between cells without shifting other items or losing nested data',()=>{
  let chest=base();
  const axe=item('Axe',[{x:0,y:0},{x:0,y:1}]);
  const gem=item('Gem',[{x:0,y:0}]);
  chest=groundAddBranch(chest,axe,[],'root:main',0,0,makeId);
  chest=groundAddBranch(chest,gem,[],'root:main',3,0,makeId);
  const before=groundDirectItems(chest);
  assert.equal(before.length,2);
  assert.throws(()=>groundMoveWithin(chest,before[0].sourceId,'root:main',3,0),/does not fit/);
  const moved=groundMoveWithin(chest,before[0].sourceId,'root:main',1,1);
  const after=groundDirectItems(moved);
  assert.equal(after.find(e=>e.sourceId===before[0].sourceId).index,1);
  assert.equal(after.find(e=>e.sourceId===before[0].sourceId).rotation,1);
  assert.equal(after.find(e=>e.sourceId===before[1].sourceId).index,3);
  assert.equal(groundPlacement(moved,item('Big',Array.from({length:12},(_,i)=>({x:i%4,y:Math.floor(i/4)}))),'root:main'),null);
});
test('ground container UI is grid and pointer drag only, with no actor selector or Store button',()=>{
  const source=fs.readFileSync(new URL('../scripts/apps/ground-container-window.js',import.meta.url),'utf8')+
    fs.readFileSync(new URL('../scripts/apps/ground-container-view.js',import.meta.url),'utf8');
  assert.match(source,/buxa-storage-grid is-complex/);
  assert.match(source,/createComplexDecorationSvg/);
  assert.match(source,/pointerdown/);
  assert.match(source,/direction:'reposition'/);
  assert.match(source,/direction:'export'/);
  assert.doesNotMatch(source,/data-ground-actor|data-ground-item|data-store|Store selected item/);
});
test('board drop routing includes containers, actors, world items, and inventory-origin transfers',()=>{
  const read=file=>fs.readFileSync(new URL(file,import.meta.url),'utf8');
  const canvas=read('../scripts/integrations/physical-item-canvas.js');
  const handoff=read('../scripts/integrations/physical-item-handoff.js');
  const transfers=read('../scripts/integrations/physical-item-transfers.js');
  assert.match(canvas,/canvasItemDropTarget/);
  assert.match(canvas,/direction:'store'/);
  assert.match(canvas,/destination:'actor'/);
  assert.match(handoff,/direction:'import'/);
  assert.match(transfers,/payload\.direction==='shift'/);
  assert.match(transfers,/groundMoveWithin/);
  assert.match(transfers,/createPlacedActorItem/);
});
