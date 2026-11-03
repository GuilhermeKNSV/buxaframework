import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeItemSystemConfig} from '../scripts/core/item-config.js';
import {getInventoryState,getActorStorage,moveInventoryItem} from '../scripts/core/inventory.js';
import {prepareInventoryContext} from '../scripts/apps/inventory-context.js';

globalThis.foundry={utils:{getProperty:(obj,path)=>path.split('.').reduce((value,key)=>value?.[key],obj)}};
function harness({storage, mode='simple', placements, hidden=false}={}) {
 const rules={storage,rarityId:'rare',equip:{enabled:true,any:true}};
 const makeItem=(id,rule={})=>({id,name:id==='bag'?'Satchel':id,img:'icons/svg/item-bag.svg',type:'loot',system:{quantity:1},getFlag:(m,k)=>k==='item'?rule:null});
 const bag=makeItem('bag',rules),coin=makeItem('coin'),gem=makeItem('gem');
 const arr=[bag,coin,gem];
 const items={get:id=>arr.find(e=>e.id===id),[Symbol.iterator]:function*(){yield* arr;}};
 const state={version:4,autoSort:false,sortMode:'alphabetic',tracked:['bag','coin','gem'],placements:placements||{bag:{area:'equipment',slotId:'weapon-1',position:0},coin:{area:'storage',storageId:'bag:pouch',index:0},gem:{area:'inventory',index:0}},equipmentActive:{'weapon-1':0}};
 const actor={id:'actor',isOwner:true,items,getFlag:(_,key)=>key==='inventory'?state:null,update:async()=>{throw Error('Unexpected write');}};
 const config={items:normalizeItemSystemConfig(),inventory:{mode,slots:6,complex:{columns:4,rows:3,autoSort:false},equipmentLayout:{slots:[{id:'weapon-1',type:'weapon',size:'long',tabId:'main',capacity:2,x:0,y:0}, {id:'gloves-hidden',type:'gloves',size:'small',hidden,tabId:'main',capacity:1,x:2,y:0}],tabs:[{id:'main',label:'Main',columns:6,rows:5}]}}};
 return {actor,config,bag,coin,gem,state};
}

test('equipped satchel adds main capacity and preserves external item placement',()=>{
 const h=harness({storage:{slots:{add:5,external:[{id:'pouch',mode:'simple',columns:2,rows:2}]}}});
 const grants=getActorStorage(h.actor,h.config);
 assert.equal(grants.additional,5);
 const state=getInventoryState(h.actor,h.config);
 assert.equal(state.placements.coin.storageId,'bag:pouch');
 const view=prepareInventoryContext(h.actor,h.config,true);
 assert.equal(view.slots,11);
 assert.equal(view.externalStorage.length,1);
 assert.equal(view.externalStorage[0].cells[0].item.id,'coin');
 assert.equal(view.showEquipmentTabs,false);
});

test('hidden slots stay hidden until activated by another equipped item',()=>{
 const h=harness({hidden:true,storage:{equipped:{slotIds:['gloves-hidden']}}});
 assert.ok(getActorStorage(h.actor,h.config).unlocked.has('gloves-hidden'));
 assert.ok(prepareInventoryContext(h.actor,h.config,true).equipmentSlots.some(s=>s.id==='gloves-hidden'));
 h.bag.getFlag=()=>({});
 assert.ok(!prepareInventoryContext(h.actor,h.config,true).equipmentSlots.some(s=>s.id==='gloves-hidden'));
});

test('unequipping provider removes equipment bonus but keeps contained items in their original slots',()=>{
 const h=harness({storage:{slots:{add:3,external:[{id:'pouch',mode:'simple',columns:2,rows:2}]}}});
 h.state.placements.bag={area:'inventory',index:1};
 const view=prepareInventoryContext(h.actor,h.config,true);
 assert.equal(view.slots,6);assert.equal(view.hasExternalStorage,false);
 assert.equal(view.externalStorage.length,0,'the unequipped bag panel is hidden, not deleted');
 assert.equal(getInventoryState(h.actor,h.config).placements.coin.storageId,'bag:pouch');
 assert.ok(!view.overflow.some(item=>item.id==='coin'));
});

test('invalid move into inactive external storage is rejected before writing',async()=>{
 const h=harness({storage:{slots:{external:[{id:'pouch',mode:'complex',columns:2,rows:2,cells:[0,2]}]}}});
 assert.equal(await moveInventoryItem(h.actor,'gem',{area:'storage',storageId:'bag:pouch',index:1},h.config),null);
});

test('Complex bonus adds exactly requested capacity and hides unused row cells',()=>{
 const h=harness({mode:'complex',storage:{slots:{add:1,external:[]}},placements:{bag:{area:'equipment',slotId:'weapon-1',position:0},coin:{area:'inventory',index:0},gem:{area:'inventory',index:1}}});
 const view=prepareInventoryContext(h.actor,h.config,true);
 assert.equal(view.slots,13);
 assert.equal(view.complexRows,4);
 assert.equal(view.complexCells.filter(cell=>cell.enabled).length,13);
 assert.equal(view.complexCells.filter(cell=>!cell.enabled).length,3);
});

test('dropping into external pouch persists the exact compartment location',async()=>{
 const h=harness({storage:{slots:{external:[{id:'pouch',mode:'simple',columns:2,rows:2}]}}});
 globalThis.foundry.utils.deepClone=value=>structuredClone(value);
 globalThis.foundry.utils.equals=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 globalThis.Hooks={callAll:()=>{}};
 let updates=[];
 h.actor.update=async payload=>{
   updates.push(payload);
   const saved=payload['flags.buxaframework.inventory'];
   if(saved)Object.assign(h.state,structuredClone(saved));
 };
 h.config.resources=[];
 const result=await moveInventoryItem(h.actor,'gem',{area:'storage',storageId:'bag:pouch',index:2},h.config);
 assert.equal(result.placements.gem.area,'storage');
 assert.equal(result.placements.gem.index,2);
 assert.equal(updates.length,1);
 assert.deepEqual(getInventoryState(h.actor,h.config).placements.gem,{area:'storage',storageId:'bag:pouch',index:2,rotation:0});
});
