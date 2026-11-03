import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPlacementScanner } from '../scripts/core/inventory-shapes.js';
import { resolveInventoryContainerDrop } from '../scripts/core/inventory-container-drop.js';
import { createInventoryContainerHit } from '../scripts/apps/inventory-container-hit.js';
import { fitsExternalStorage } from '../scripts/core/item-storage.js';

const source={cells:[{x:0,y:0},{x:0,y:1}]};
const bagShape={cells:[{x:0,y:0},{x:1,y:0},{x:0,y:1}]};
const glove={cells:[{x:0,y:0}]};
const shapes={source,bag:bagShape,glove};
const pocket=(id='bag:main',overrides={})=>({storageId:id,providerId:'bag',mode:'simple',itemMode:'complex',
  columns:3,rows:3,cells:[],...overrides});

// A named target with no storage grant remains an ordinary inventory move.
test('only an item with configured external compartments is a storage drop target',()=>{
  const args={movingId:'source',hoveredId:'bag',shapes,placements:{},rotation:0};
  assert.equal(resolveInventoryContainerDrop({...args,compartments:[]}),null);
  assert.equal(resolveInventoryContainerDrop({...args,hoveredId:'source',compartments:[pocket()]}),null);
  assert.equal(resolveInventoryContainerDrop({...args,hoveredId:'glove',compartments:[pocket()]}),null);
});

test('dropping directly on inventory backpack picks a real free compartment footprint',()=>{
  const result=resolveInventoryContainerDrop({movingId:'source',hoveredId:'bag',
    compartments:[pocket()],placements:{glove:{area:'storage',storageId:'bag:main',index:0}},shapes});
  assert.equal(result.valid,true);
  assert.deepEqual(result.destination,{area:'storage',storageId:'bag:main',index:1,rotation:0,containerDrop:true});
  assert.equal(fitsExternalStorage(pocket(),{glove:{area:'storage',storageId:'bag:main',index:0}},shapes,
    'source',result.destination.index,result.destination.rotation),true);
});

test('masked cells and odd rotations use exact storage geometry, not inventory hitbox',()=>{
  const mask=pocket('bag:side',{mode:'complex',columns:3,rows:3,cells:[1,2,4,5,7,8]});
  const result=resolveInventoryContainerDrop({movingId:'source',hoveredId:'bag',
    compartments:[mask],placements:{},shapes,rotation:1});
  assert.equal(result.valid,true);
  assert.equal(result.destination.index,1);
  assert.equal(result.destination.rotation,1);
});

test('if the first pouch is full, next pouch is considered without dumping in main inventory',()=>{
  const full=pocket('bag:one',{columns:1,rows:1});
  const open=pocket('bag:two');
  const result=resolveInventoryContainerDrop({movingId:'source',hoveredId:'bag',
    compartments:[full,open],shapes,placements:{glove:{area:'storage',storageId:'bag:one',index:0}}});
  assert.equal(result.destination.storageId,'bag:two');
});

test('full or blocked backpack never falls through to an inventory relocation',()=>{
  const result=resolveInventoryContainerDrop({movingId:'source',hoveredId:'bag',
    compartments:[pocket('bag:tiny',{columns:1,rows:1})],placements:{},shapes});
  assert.equal(result.valid,false);
  assert.equal(result.destination.area,'storage');
  assert.equal(result.destination.index,-1);
});

test('nested backpack cannot be inserted into itself or one of its descendants',()=>{
  const inside=pocket('child:inner',{providerId:'child'});
  const result=resolveInventoryContainerDrop({movingId:'bag',hoveredId:'child',
    compartments:[inside],placements:{child:{area:'storage',storageId:'bag:main',index:0}},
    shapes:{bag:glove,child:glove}});
  assert.equal(result.valid,false);
});

test('Complex hit testing hits every occupied backpack cell but not its empty bounding corners',()=>{
  const scanner=createPlacementScanner(shapes,{columns:5,rows:4});
  scanner.occupy('bag',6,0); // occupied 6,7,11; empty bounding cell 12
  const geometry={left:0,top:0,right:250,bottom:200,columns:5,rows:4,cellSize:50,cellHeight:50};
  const resolver=createInventoryContainerHit({itemId:'source',isComplex:true,
    geometry:()=>geometry,scanner:()=>scanner,grants:()=>({compartments:[pocket()]}),
    state:()=>({placements:{bag:{area:'inventory',index:6}}}),shapes:()=>shapes});
  for(const index of [6,7,11]) {
    const x=(index%5+.5)*50, y=(Math.floor(index/5)+.5)*50;
    assert.equal(resolver.at(x,y,null,0)?.valid,true);
  }
  assert.equal(resolver.at(125,125,null,0),null); // cell 12
  resolver.clear();
});

test('Simple inventory container selection uses the hovered item tile',()=>{
  const resolver=createInventoryContainerHit({itemId:'source',isComplex:false,
    grants:()=>({compartments:[pocket()]}),state:()=>({placements:{}}),shapes:()=>shapes});
  const pointer={closest(selector){return selector==='[data-item-id]'
    ? {dataset:{itemId:'bag'},closest(s){return s==='[data-inventory-index]'?{}:null;}}:null;}};
  assert.equal(resolver.at(0,0,pointer)?.valid,true);
});

test('pointer release honors backpack destination and skips stack merging',()=>{
  const controls=readFileSync(new URL('../scripts/apps/inventory-controls.js',import.meta.url),'utf8');
  assert.match(controls,/const container=inventoryContainerHit\.at\(x,y,pointerTarget,rotation\)/);
  assert.match(controls,/const mergeId = destination\?\.containerDrop \? null/);
  assert.match(controls,/const targetId = destination\?\.containerDrop \? null/);
  assert.match(controls,/commitEquipmentDropMotion\(equipMotion, \(\) => handleInternalDrop\(sheet, itemId, underPointer, destination, \{ stackTargetId: mergeId \}\)\)/);
});

test('actual Actor move stores a Complex item in the backpack, without moving the backpack',async()=>{
  const {getInventoryState,getActorStorage,moveInventoryItem}=await import('../scripts/core/inventory.js');
  const {normalizeItemSystemConfig}=await import('../scripts/core/item-config.js');
  globalThis.foundry={utils:{deepClone:structuredClone,
    equals:(a,b)=>JSON.stringify(a)===JSON.stringify(b),
    getProperty:(data,path)=>path.split('.').reduce((v,k)=>v?.[k],data)}};
  globalThis.Hooks={callAll:()=>{}};
  const rules={storage:{slots:{external:[{id:'main',columns:3,rows:3,mode:'simple'}]}} ,shape:bagShape};
  const list=[{id:'bag',name:'Backpack',flags:{buxaframework:{item:rules}},
    getFlag:(_scope,key)=>key==='item'?rules:null},
    {id:'source',name:'Axe',flags:{buxaframework:{item:{shape:source}}},
    getFlag:(_scope,key)=>key==='item'?{shape:source}:null}]
    .map(item=>({...item,type:'loot',system:{quantity:1},img:'icons/svg/item-bag.svg'}));
  const placements={bag:{area:'inventory',index:8,rotation:0},source:{area:'inventory',index:0,rotation:0}};
  const state={version:4,autoSort:false,sortMode:'alphabetic',tracked:['bag','source'],placements,equipmentActive:{}};
  const actor={id:'actor',isOwner:true,items:{get:id=>list.find(x=>x.id===id),
    [Symbol.iterator]:function*(){yield* list;}},getFlag:(_scope,key)=>key==='inventory'?state:null,
    async update(payload){Object.assign(state,structuredClone(payload['flags.buxaframework.inventory']));}};
  const config={items:normalizeItemSystemConfig(),resources:[],inventory:{mode:'complex',
    complex:{columns:6,rows:4,autoSort:false},slots:24}};
  const grants=getActorStorage(actor,config).compartments;
  assert.equal(grants.length,1);
  const plan=resolveInventoryContainerDrop({movingId:'source',hoveredId:'bag',
    compartments:grants,placements:getInventoryState(actor,config).placements,shapes,rotation:0});
  assert.equal(plan.valid,true);
  const moved=await moveInventoryItem(actor,'source',plan.destination,config);
  assert.ok(moved);
  assert.equal(moved.placements.source.area,'storage');
  assert.equal(moved.placements.source.storageId,'bag:main');
  assert.equal(moved.placements.source.index,0);
  assert.equal(moved.placements.bag.index,8);
  assert.equal(moved.placements.bag.area,'inventory');
});
