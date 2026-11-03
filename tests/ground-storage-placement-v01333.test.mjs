import test from 'node:test';
import assert from 'node:assert/strict';
import { groundPlacement,groundDropDestination,groundAddBranch,groundMoveWithin,
  groundDirectItems, groundCompartments } from '../scripts/core/ground-container.js';
import { classifyGroundContents } from '../scripts/apps/ground-container-view.js';
import { fitsExternalStorage } from '../scripts/core/item-storage.js';

const MODULE='buxaframework';
const shape=cells=>({name:'Object',img:'icons/svg/item-bag.svg',system:{quantity:1},
  flags:{[MODULE]:{item:{shape:{cells}}}}});
const square=shape([{x:0,y:0}]);
const tee=shape([{x:0,y:0},{x:1,y:0},{x:2,y:0},{x:1,y:1}]);
const potion=shape([{x:0,y:0},{x:0,y:1}]);
const elbow=shape([{x:0,y:0},{x:0,y:1},{x:1,y:1}]);
const complex=(id,cells)=>({id,label:id,mode:'complex',columns:5,rows:5,cells});
const root=(compartments,contents=[])=>({id:'box',data:{name:'Box',flags:{[MODULE]:{
  item:{storage:{slots:{external:compartments}}},backpackContents:contents
}}}});
const child=(id,index,data,compartmentId='main',rotation=0)=>({
  sourceId:id,providerId:'root',compartmentId,index,rotation,data
});
const mask=[2,7,10,11,12,13,14,16,18,23];
const bag=complex('main',mask);
const occupied=[child('potion',2,potion),child('gem',10,tee)];

test('same valid occupancy calculation drives visible chest cells and authoritative placement',()=>{
 const corrupted=child('legacy-invalid',13,shape([{x:0,y:0},{x:1,y:0},{x:0,y:1},{x:1,y:1}]));
 const chest=root([bag],[...occupied,corrupted]);
 const spec=groundCompartments(chest);
 const visible=classifyGroundContents(spec,[...occupied,corrupted]);
 assert.deepEqual(visible.valid.map(e=>e.sourceId),['potion','gem']);
 assert.deepEqual(visible.unplaced.map(e=>e.sourceId),['legacy-invalid']);
 assert.equal(groundPlacement(chest,square,'root:main',0,13),13,'unplaced old data must not block cell 13');
 const placed=groundAddBranch(chest,square,[],'root:main',13,0,()=> 'new-square');
 assert.equal(groundDirectItems(placed).at(-1).index,13);
 assert.equal(groundDirectItems(placed).length,4,'recovery item remains safely stored');
});

test('complex mask respects 1x1 open cells and tries rotations for automatic drops',()=>{
 const chest=root([bag],occupied);
 const direct=groundDropDestination(chest,square,{});
 assert.ok(direct);
 assert.equal(direct.index,13);
 assert.equal(groundDropDestination(chest,elbow,{index:13,rotation:0}),null,'explicit invalid rotation must not jump');
 const auto=groundDropDestination(chest,elbow,{});
 assert.deepEqual(auto,{storageId:'root:main',index:13,rotation:1});
 const stored=groundAddBranch(chest,elbow,[],auto.storageId,auto.index,auto.rotation,()=> 'corner');
 assert.equal(classifyGroundContents(groundCompartments(stored),groundDirectItems(stored)).unplaced.length,0);
});

test('automatic placement tries all compartments but explicit cell is exact',()=>{
 const blocked=complex('blocked',[0]);
 const free=complex('free',[5,6,10,11]);
 const chest=root([blocked,free],[child('used',0,square,'blocked')]);
 assert.deepEqual(groundDropDestination(chest,potion,{}),{storageId:'root:free',index:5,rotation:0});
 assert.equal(groundDropDestination(chest,potion,{storageId:'root:blocked'}),null);
 assert.equal(groundDropDestination(chest,potion,{storageId:'root:free',index:11}),null);
});

test('invalid historical masked occupancy cannot steal valid cells from a separate actor pouch',()=>{
 const comp={...bag,storageId:'root:main',providerId:'root',itemMode:'complex'};
 const shapes={stale:{cells:[{x:0,y:0},{x:1,y:0},{x:0,y:1},{x:1,y:1}]},new:square.flags[MODULE].item.shape};
 const placements={stale:{area:'storage',storageId:'root:main',index:13,rotation:0}};
 assert.equal(fitsExternalStorage(comp,placements,shapes,'new',13,0),true);
});

test('repositioning a recovery item into a true free slot preserves all other children',()=>{
 const stale=child('stale',13,elbow);
 const chest=root([bag],[...occupied,stale]);
 const moved=groundMoveWithin(chest,'stale','root:main',13,1);
 assert.equal(moved.data.flags[MODULE].backpackContents.length,3);
 assert.equal(groundDirectItems(moved).find(e=>e.sourceId==='stale').rotation,1);
});

test('GM-authoritative world-item import automatically rotates into actual remaining masked cells',async()=>{
 const {requestPhysicalAction}=await import('../scripts/integrations/physical-item-transfers.js');
 const {scenePhysicalItems,PHYSICAL_SCENE_STORE}=await import('../scripts/core/physical-items.js');
 const previous=Object.fromEntries(['game','foundry','Hooks'].map(key=>[key,globalThis[key]]));
 const chest={...root([bag],occupied),x:100,y:100,size:80,quantity:1};
 let current={scene:[chest]};let seq=0;
 const gm={id:'gm',isGM:true,active:true};
 const scene={id:'scene',grid:{size:100,distance:5},width:800,height:800,tokens:{contents:[]},getFlag(){return null;}};
 const template={id:'elbow',system:{quantity:1},testUserPermission(){return true;},toObject(){return {...elbow,type:'tool'};}};
 try {
  globalThis.foundry={utils:{randomID:()=>`ground-test-${++seq}`}};
  globalThis.Hooks={callAll(){}};
  globalThis.game={user:gm,users:[gm],actors:{contents:[],get(){return null;}},
    scenes:{get:id=>id==='scene'?scene:null},items:{get:id=>id==='elbow'?template:null},
    settings:{get(_ns,key){return key===PHYSICAL_SCENE_STORE?current:key==='physicalItemSettings'?{lootEnabled:true}:{};},
      async set(_ns,key,next){assert.equal(key,PHYSICAL_SCENE_STORE);current=structuredClone(next);return current;}}};
  const result=await requestPhysicalAction({action:'container',sceneId:'scene',containerId:'box',
    direction:'import',source:'world',itemId:'elbow',quantity:1});
  assert.equal(result.stored,true);
  const updated=scenePhysicalItems(scene)[0];
  const imported=groundDirectItems(updated).find(entry=>entry.data.name==='Object' && entry.sourceId.startsWith('ground-test-'));
  assert.ok(imported);
  assert.equal(imported.index,13);
  assert.equal(imported.rotation,1);
  assert.equal(groundDirectItems(updated).length,3);
  assert.equal(template.id,'elbow','world template stays unchanged');
 }finally{for(const [key,value] of Object.entries(previous))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
});
