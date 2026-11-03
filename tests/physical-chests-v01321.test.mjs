import test from 'node:test';
import assert from 'node:assert/strict';
import { setStorageOpen, isStorageOpen, visibleOpenedCompartments } from '../scripts/core/storage-open-state.js';
import { groundCompartments, groundPlacement, groundAddBranch, groundDirectItems, groundRemoveBranch } from '../scripts/core/ground-container.js';
import { groundItemLootDisabled } from '../scripts/core/physical-items.js';
import { normalizeItemRules } from '../scripts/core/item-config.js';
import { positionPhysicalItemFx } from '../scripts/integrations/physical-item-fx.js';
const id='buxaframework';
const rules={storage:{slots:{external:[{id:'chest',mode:'complex',columns:4,rows:2,cells:[0,1,2,3,4,5,6,7]}]}}};
const data=(name,shape)=>({name,system:{quantity:1},flags:{[id]:{item:{shape:shape||{cells:[{x:0,y:0}]}}}}});
const box=()=>({id:'worldBox',size:80,data:{name:'Chest',flags:{[id]:{item:{...rules,disableLooting:true}}}}});
test('OPEN on an unequipped backpack is UI state; closing never changes saved placements',()=>{
 const actor={uuid:'Actor.test'};
 const bags=[{storageId:'backpack:main',providerId:'backpack',active:false},{storageId:'pouch:inner',providerId:'pouch',active:false}];
 const positions={backpack:{area:'inventory',index:4},pouch:{area:'storage',storageId:'backpack:main',index:1}};
 assert.equal(visibleOpenedCompartments(actor,bags,positions).length,0);
 setStorageOpen(actor,'backpack',true);
 assert.equal(isStorageOpen(actor,'backpack'),true);
 assert.deepEqual(visibleOpenedCompartments(actor,bags,positions).map(b=>b.storageId),['backpack:main','pouch:inner']);
 setStorageOpen(actor,'backpack',false);
 assert.equal(visibleOpenedCompartments(actor,bags,positions).length,0);
 assert.equal(positions.pouch.index,1);
});
test('locked world chest can be opened but its own loot flag is normalized',()=>{
 assert.equal(groundItemLootDisabled(box()),true);
 assert.equal(normalizeItemRules({disableLooting:true}).disableLooting,true);
 assert.equal(normalizeItemRules({}).disableLooting,false);
 assert.equal(groundCompartments(box()).length,1);
});
test('chest items preserve shape, exact index and nested descendants through store/take',()=>{
 const chest=box(),shape={cells:[{x:0,y:0},{x:1,y:0}]};
 const saber=data('Saber',shape);
 assert.equal(groundPlacement(chest,saber,'root:chest',0,3),4); // too wide at last column, nearest cell 0
 const nested=[{sourceId:'gem',providerId:'root',compartmentId:'tiny',index:2,rotation:1,data:data('Gem')}];
 const stored=groundAddBranch(chest,saber,nested,'root:chest',0,0,(()=>{let n=0;return ()=>`new${++n}`;})());
 assert.equal(groundDirectItems(stored).length,1);
 assert.equal(groundDirectItems(stored)[0].index,0);
 assert.equal(groundPlacement(stored,data('Other',shape),'root:chest',0,0),2);
 const {next,data:withdrawn}=groundRemoveBranch(stored,'new1');
 assert.equal(groundDirectItems(next).length,0);
 assert.equal(withdrawn.flags[id].backpackContents[0].providerId,'root');
 assert.equal(withdrawn.flags[id].backpackContents[0].index,2);
 assert.equal(withdrawn.flags[id].backpackContents[0].rotation,1);
});
test('wrong storage cell rejects overlap, preserving original state',()=>{
 const chest=box();const other=data('Item');
 const stored=groundAddBranch(chest,other,[],'root:chest',0,0,()=> 'one');
 assert.throws(()=>groundAddBranch(stored,other,[],'root:chest',0,0,()=> 'two'),/does not fit/);
 assert.equal(groundDirectItems(stored).length,1);
});
test('large artwork beams stay below visual cap and marker follows short/wide icon bottom',()=>{
 const points=[];
 const fx={position:{set(x,y){points.push({x,y});}}};
 positionPhysicalItemFx(fx,{size:450},{width:450,height:30,rotation:0});
 assert.deepEqual(points[0],{x:225,y:240});
});
