import test from 'node:test';
import assert from 'node:assert/strict';
import { groundPlacementChecker,groundPlacement,groundMoveWithin } from '../scripts/core/ground-container.js';
import { attachPackedContents,stripPackedContents } from '../scripts/core/backpack-transfers.js';

const shape=cells=>({name:'Test',flags:{buxaframework:{item:{shape:{cells}}}},system:{quantity:1}});
const items=[shape([{x:0,y:0}]),shape([{x:0,y:0},{x:0,y:1}]),
  shape([{x:0,y:0},{x:1,y:0},{x:0,y:1}]),shape([{x:0,y:0},{x:1,y:0},{x:2,y:0},{x:1,y:1}])];
const mk=(cells,contents)=>({id:'chest',data:{name:'Chest',flags:{buxaframework:{
  item:{storage:{slots:{external:[{id:'main',mode:'complex',columns:5,rows:4,cells}]}}},
  backpackContents:contents
}}}});
const entry=(id,index,which,rotation=0)=>({sourceId:id,providerId:'root',compartmentId:'main',index,rotation,data:items[which]});
const full=Array.from({length:20},(_,i)=>i);

test('cached footprint checks agree with authoritative exact ground placement across masks, rotations and invalid legacy entries',()=>{
  const scenarios=[mk(full,[entry('axe',0,1),entry('sword',8,2,1)]),
    mk(full.filter(i=>i!==2 && i!==3 && i!==16),[entry('axe',4,1),entry('bad-legacy',16,3)]),
    mk([0,1,2,5,6,7,10,11,12,15,16,17],[entry('axe',5,1,1)])];
  for(const record of scenarios){
    for(const data of items){
      const fast=groundPlacementChecker(record,data);
      for(let rotation=0;rotation<4;rotation++)for(let index=0;index<20;index++){
        assert.equal(fast.fits('root:main',index,rotation),
          groundPlacement(record,data,'root:main',rotation,index)===index,
          `new item rotation ${rotation} at ${index}`);
      }
    }
    for(const entry of record.data.flags.buxaframework.backpackContents){
      const fast=groundPlacementChecker(record,null,entry.sourceId);
      const without=structuredClone(record);
      const rest=record.data.flags.buxaframework.backpackContents.filter(e=>e.sourceId!==entry.sourceId);
      without.data=attachPackedContents(stripPackedContents(without.data),rest);
      for(let rotation=0;rotation<4;rotation++)for(let index=0;index<20;index++){
        assert.equal(fast.fits('root:main',index,rotation),
          groundPlacement(without,entry.data,'root:main',rotation,index)===index,
          `moving ${entry.sourceId} rotation ${rotation} at ${index}`);
      }
    }
  }
});

test('repositioning uses cached geometry but keeps input immutable and nested children intact',()=>{
  const child={sourceId:'gem',providerId:'axe',compartmentId:'inner',index:0,rotation:0,data:items[0]};
  const src=mk(full,[entry('axe',0,1),child]);
  const snapshot=structuredClone(src);
  const result=groundMoveWithin(src,'axe','root:main',3,2);
  assert.deepEqual(src,snapshot);
  assert.equal(result.data.flags.buxaframework.backpackContents.find(e=>e.sourceId==='axe').rotation,2);
  assert.deepEqual(result.data.flags.buxaframework.backpackContents.find(e=>e.sourceId==='gem'),child);
});
