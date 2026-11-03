import test from 'node:test';
import assert from 'node:assert/strict';
import {planGroundContainerPlacement,groundRejectedFootprint} from '../scripts/core/ground-drop-intent.js';
import {groundAddBranch,groundCompartments,groundDirectItems,groundDropDestination,classifyGroundPlacements} from '../scripts/core/ground-container.js';
import {groundNoFitMessage} from '../scripts/apps/ground-container-window.js';

const NS='buxaframework';
const shape=(name,cells)=>({name,img:'icons/svg/item-bag.svg',type:'loot',system:{quantity:1},flags:{[NS]:{item:{shape:{cells}}}}});
const axe=shape('Lumberjack Axe',[{x:0,y:0},{x:1,y:0},{x:0,y:1},{x:0,y:2}]);
const gloves=shape('Golden Gloves',[{x:0,y:0},{x:0,y:1}]);
const coin=shape('Silver',[{x:0,y:0}]);
const sword=shape('Demon Killer Sword',Array.from({length:6},(_,i)=>({x:i%2,y:Math.floor(i/2)})));
const child=(sourceId,index,data)=>({sourceId,providerId:'root',compartmentId:'crate',index,rotation:0,data});
const record=()=>({id:'crate123',data:{name:'Crate',flags:{[NS]:{
 item:{storage:{slots:{external:[{id:'crate',mode:'complex',columns:5,rows:4,
   cells:Array.from({length:20},(_,i)=>i).filter(i=>i!==0&&i!==4)}]}}},
 backpackContents:[child('axe',5,axe),child('gloves',11,gloves),child('coin',17,coin)]
}}}});
test('screenshot layout accepts the sword in the real shaped/rotated remaining cells',()=>{
  const chest=record();
  assert.equal(classifyGroundPlacements(groundCompartments(chest),groundDirectItems(chest)).unplaced.length,0);
  for(const hoverIndex of [2,3,7,8,12,13,18]){
    const result=planGroundContainerPlacement(chest,sword,{storageId:'root:crate',hoverIndex,
      rotation:0,gripX:.5,gripY:.5});
    assert.ok(result,`visible cell ${hoverIndex} must not falsely claim the chest is full`);
    assert.deepEqual(groundDropDestination(chest,sword,{storageId:result.storageId,index:result.index,rotation:result.rotation}),
      {storageId:result.storageId,index:result.index,rotation:result.rotation});
  }
  const plan=planGroundContainerPlacement(chest,sword,{storageId:'root:crate',hoverIndex:8});
  const next=groundAddBranch(chest,sword,[],plan.storageId,plan.index,plan.rotation,()=> 'sword');
  const contents=groundDirectItems(next);
  assert.equal(contents.length,4);
  assert.deepEqual(classifyGroundPlacements(groundCompartments(next),contents).unplaced,[]);
  assert.deepEqual(groundDirectItems(chest).map(e=>e.index),[5,11,17]);
});
test('a genuinely oversized footprint is identified, not mislabeled as a full chest',()=>{
  const oversized=shape('Large sail',Array.from({length:12},(_,i)=>({x:i%3,y:Math.floor(i/3)})));
  assert.equal(planGroundContainerPlacement(record(),oversized,{storageId:'root:crate',hoverIndex:8}),null);
  assert.match(groundNoFitMessage(oversized),/3×4 configured footprint \(12 cells\)/);
  assert.match(groundNoFitMessage(sword),/2×3 configured footprint \(6 cells\)/);
});

test('invalid preview retains the rejected item bounds without altering storage',()=>{
 const chest=record(),bag=groundCompartments(chest)[0];
 const target={bag,column:4,row:3};
 const visual=groundRejectedFootprint(target,sword,{rotation:0,gripX:.5,gripY:.5});
 assert.deepEqual({index:visual.index,rotation:visual.rotation},{index:13,rotation:0});
 assert.equal(groundDropDestination(chest,sword,{storageId:'root:crate',index:visual.index,rotation:visual.rotation}),null,
   'red rejected preview may cross mask/other items, but can never be committed');
 assert.equal(groundDirectItems(chest).length,3);
});
