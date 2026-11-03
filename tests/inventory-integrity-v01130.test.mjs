import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeItemSystemConfig} from '../scripts/core/item-config.js';
import {canStackItems,stackActorItems} from '../scripts/core/item-runtime.js';
import {getActorStorage, getInventoryState, moveInventoryItem} from '../scripts/core/inventory.js';
import {canPlaceShape} from '../scripts/core/inventory-shapes.js';

const getProperty = (obj, path) => String(path).split('.').reduce((value, key) => value?.[key], obj);
globalThis.foundry = {utils:{
  getProperty, hasProperty: (obj, path) => getProperty(obj,path) !== undefined,
  deepClone: structuredClone, equals: (a,b)=>JSON.stringify(a)===JSON.stringify(b)
}};
globalThis.game = {system:{id:'test'},i18n:{lang:'en'}};
globalThis.Hooks = {callAll(){}};
const cfg = () => ({items:normalizeItemSystemConfig(),resources:[],inventory:{mode:'complex',slots:8,
  complex:{columns:4,rows:2,autoSort:false},equipmentLayout:{
    tabs:[{id:'main',label:'Main',columns:5,rows:4}],
    slots:[{id:'weapon-1',type:'weapon',label:'Weapon',capacity:1,tabId:'main',x:0,y:0}]
  }}});
function makeItem(id, rules, quantity=1) {
  return {id,uuid:`Actor.actor.Item.${id}`,name:id,type:'loot',img:'icon.png',system:{quantity},
    getFlag:(scope,key)=>scope==='buxaframework' && key==='item'?rules:undefined,
    async update(changes){if ('system.quantity' in changes) this.system.quantity=changes['system.quantity'];}};
}
function actorFor(items, state, deleteItem=async()=>{}) {
  items.get=id=>items.find(item=>item.id===id);
  const actor={id:'actor',documentName:'Actor',isOwner:true,items,_state:structuredClone(state),
    getFlag:(_scope,key)=>key==='inventory'?this._state:undefined,
    async update(payload){if(payload['flags.buxaframework.inventory'])this._state=structuredClone(payload['flags.buxaframework.inventory']);},
    async deleteEmbeddedDocuments(type,ids){return deleteItem(type,ids,items);}};
  // Explicit method rather than an arrow so the actor itself is used.
  actor.getFlag=function(_scope,key){return key==='inventory'?this._state:undefined;};
  items.forEach(item=>item.parent=actor);
  return actor;
}
const stackRule = {multiple:{enabled:true,stackKey:'potion'}};

test('failed stack deletion restores original target quantity; no phantom units',async()=>{
  const a=makeItem('source',stackRule,2),b=makeItem('target',stackRule,4);
  const actor=actorFor([a,b],{},async()=>{throw new Error('Delete denied');});
  await assert.rejects(()=>stackActorItems(actor,a,b,{config:cfg()}),/Delete denied/);
  assert.equal(b.system.quantity,4);
  assert.equal(a.system.quantity,2);
  assert.ok(actor.items.get('source'));
});

test('failed deletion returning without removing source is rolled back',async()=>{
  const a=makeItem('source',stackRule,2),b=makeItem('target',stackRule,4);
  const actor=actorFor([a,b],{},async()=>[]);
  await assert.rejects(()=>stackActorItems(actor,a,b,{config:cfg()}),/Could not remove/);
  assert.equal(b.system.quantity,4);
});

test('post-delete hook failure never destroys merged quantity when source is already gone',async()=>{
  const a=makeItem('source',stackRule,2),b=makeItem('target',stackRule,4);
  const actor=actorFor([a,b],{},async(_type,ids,items)=>{
    items.splice(items.findIndex(item=>item.id===ids[0]),1);
    throw new Error('After delete hook');
  });
  const log=console.warn;console.warn=()=>{};
  try {assert.equal(await stackActorItems(actor,a,b,{config:cfg()}),b);}
  finally {console.warn=log;}
  assert.equal(b.system.quantity,6);
  assert.equal(actor.items.get('source'),undefined);
});

test('removed and out-of-range equipment slots cannot grant storage',()=>{
  const bag=makeItem('bag',{storage:{slots:{add:7,external:[{id:'pouch',mode:'simple',columns:2,rows:2}]}}});
  const state={placements:{bag:{area:'equipment',slotId:'removed-slot',position:0}},equipmentActive:{'removed-slot':0}};
  const actor=actorFor([bag],state);
  const config=cfg();
  assert.equal(getActorStorage(actor,config).additional,0);
  assert.equal(getActorStorage(actor,config).compartments.length,0);
  actor._state.placements.bag={area:'equipment',slotId:'weapon-1',position:4};
  actor._state.equipmentActive={'weapon-1':4};
  assert.equal(getActorStorage(actor,config).additional,0);
  actor._state.placements.bag.position=0;
  actor._state.equipmentActive['weapon-1']=0;
  assert.equal(getActorStorage(actor,config).additional,7);
});

function swapHarness(cells) {
  const mover=makeItem('mover',{equip:{enabled:true,any:true},shape:{cells:[{x:0,y:0}]}});
  const other=makeItem('other',{equip:{enabled:true,any:true},shape:{cells}});
  const state={version:4,tracked:['mover','other'],autoSort:false,sortMode:'alphabetic',
    placements:{mover:{area:'inventory',index:3},other:{area:'equipment',slotId:'weapon-1',position:0}},
    equipmentActive:{'weapon-1':0}};
  return {mover,other,actor:actorFor([mover,other],state),config:cfg()};
}

test('equipment swap preserves a valid edge-aligned item footprint',async()=>{
  // A 1×2 item can occupy the right edge without wrapping horizontally.
  const {actor,config}=swapHarness([{x:0,y:0},{x:0,y:1}]);
  // Equipment has no separate rotation state; its original shape is used.
  const next=await moveInventoryItem(actor,'mover',{area:'equipment',slotId:'weapon-1',position:0},config);
  assert.equal(next.placements.mover.area,'equipment');
  assert.equal(next.placements.other.area,'inventory');
  assert.equal(next.placements.other.index,3);
  assert.equal(getInventoryState(actor,config).placements.other.index,3);
  assert.ok(canPlaceShape({}, {other:{cells:[{x:0,y:0},{x:0,y:1}]}},'other',3,0,config.inventory.complex));
});



test('equipment swap validates the same rotation it actually saves for the displaced shape',async()=>{
  const {actor,config}=swapHarness([{x:0,y:0},{x:1,y:0}]);
  // At the far right edge the horizontal footprint does NOT fit; the saved
  // quarter-turn does fit vertically. Validating rotation 0 moves it away.
  actor._state.placements.mover={area:'inventory',index:3,rotation:1};
  const next=await moveInventoryItem(actor,'mover',{area:'equipment',slotId:'weapon-1',position:0},config);
  assert.equal(next.placements.other.index,3);
  assert.equal(next.placements.other.rotation,1);
  assert.equal(getInventoryState(actor,config).placements.other.index,3);
});

test('swapping a pouch item into occupied equipment reuses the vacated pouch cell',async()=>{
  const bag=makeItem('bag',{equip:{enabled:true,any:true},storage:{slots:{external:[{id:'pouch',columns:3,rows:2,mode:'simple'}]}}});
  const stored=makeItem('stored',{equip:{enabled:true,any:true}});
  const equipped=makeItem('equipped',{equip:{enabled:true,any:true}});
  const config=cfg();
  config.inventory.mode='simple';
  config.inventory.slots=6;
  config.inventory.equipmentLayout.slots.push({id:'bag-slot',type:'backpack',label:'Bag',capacity:1,tabId:'main',x:2,y:0});
  const state={version:4,tracked:['bag','stored','equipped'],autoSort:false,sortMode:'alphabetic',
    placements:{bag:{area:'equipment',slotId:'bag-slot',position:0},
      stored:{area:'storage',storageId:'bag:pouch',index:2},
      equipped:{area:'equipment',slotId:'weapon-1',position:0}},
    equipmentActive:{'weapon-1':0,'bag-slot':0}};
  const actor=actorFor([bag,stored,equipped],state);
  const result=await moveInventoryItem(actor,'stored',{area:'equipment',slotId:'weapon-1',position:0},config);
  assert.equal(result.placements.stored.area,'equipment');
  assert.deepEqual(result.placements.equipped,{area:'storage',storageId:'bag:pouch',index:2,rotation:0});
  assert.equal(getInventoryState(actor,config).placements.equipped.storageId,'bag:pouch');
});

test('complex pouch mask rejects a displaced 2×1 item that cannot fit',async()=>{
  const bag=makeItem('bag',{equip:{enabled:true,any:true},storage:{slots:{external:[
    {id:'pouch',columns:2,rows:2,mode:'complex',cells:[0,2]}
  ]}}});
  const stored=makeItem('stored',{equip:{enabled:true,any:true},shape:{cells:[{x:0,y:0}]}});
  const equipped=makeItem('equipped',{equip:{enabled:true,any:true},shape:{cells:[{x:0,y:0},{x:1,y:0}]}});
  const config=cfg();
  config.inventory.equipmentLayout.slots.push({id:'bag-slot',type:'backpack',label:'Bag',capacity:1,tabId:'main',x:2,y:0});
  const state={version:4,tracked:['bag','stored','equipped'],autoSort:false,sortMode:'alphabetic',
    placements:{bag:{area:'equipment',slotId:'bag-slot',position:0},
      stored:{area:'storage',storageId:'bag:pouch',index:0},
      equipped:{area:'equipment',slotId:'weapon-1',position:0}},
    equipmentActive:{'weapon-1':0,'bag-slot':0}};
  const actor=actorFor([bag,stored,equipped],state);
  const result=await moveInventoryItem(actor,'stored',{area:'equipment',slotId:'weapon-1',position:0},config);
  assert.equal(result.placements.stored.area,'equipment');
  assert.equal(result.placements.equipped.area,'inventory');
  assert.equal(getInventoryState(actor,config).placements.equipped.area,'inventory');
});


test('a Foundry onUpdate hook throwing after applying quantity is rolled back',async()=>{
  const source=makeItem('source',stackRule,2), target=makeItem('target',stackRule,4);
  target.update=async function(payload){
    this.system.quantity=payload['system.quantity'];
    if (this.system.quantity===6) throw new Error('Post-update hook');
  };
  const actor=actorFor([source,target],{},async()=>{throw Error('Must not delete source');});
  await assert.rejects(()=>stackActorItems(actor,source,target,{config:cfg()}),/Post-update hook/);
  assert.equal(source.system.quantity,2);
  assert.equal(target.system.quantity,4);
});

test('zero-quantity stacks never manufacture one unit during merge',async()=>{
  const source=makeItem('source',stackRule,0), target=makeItem('target',stackRule,4);
  const actor=actorFor([source,target],{});
  assert.equal(canStackItems(source,target,cfg()),false);
  assert.equal(await stackActorItems(actor,source,target,{config:cfg()}),null);
  assert.equal(target.system.quantity,4);
});

test('manual stack merge does not reuse Foundry-mutated options for source operations',async()=>{
 const source=makeItem('source',stackRule,4), target=makeItem('target',stackRule,98);
 const actor=actorFor([source,target],{});
 for(const item of [source,target]){
  const update=item.update.bind(item);
  item.update=async(changes,options)=>{
   assert.ok(options && !('parent' in options) && !('pack' in options));
   options.parent=actor;options.pack='stale';
   return update(changes);
  };
 }
 const result=await stackActorItems(actor,source,target,{config:cfg()});
 assert.equal(result,target);
 assert.equal(target.system.quantity,99);
 assert.equal(source.system.quantity,3);
});
