import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeItemSystemConfig } from '../scripts/core/item-config.js';
import { getActorStorage, getEffectiveInventoryConfig, getInventoryState, moveInventoryItem,
  setInventoryAutoSort, setInventorySortMode } from '../scripts/core/inventory.js';
import { fitsExternalStorage } from '../scripts/core/item-storage.js';
import { simpleStoragePickupCell } from '../scripts/core/inventory-pickup-target.js';
import { resolveAutomaticStorageDrop } from '../scripts/core/external-storage-placement.js';
import { prepareInventoryContext } from '../scripts/apps/inventory-context.js';
import { getInventoryDropDestination, compatibleStorageStackTarget } from '../scripts/apps/inventory-drop-target.js';

const getProperty = (object, path) => String(path).split('.').reduce((value, part) => value?.[part], object);
globalThis.foundry = { utils: { getProperty, hasProperty: (o, p) => getProperty(o, p) !== undefined,
  deepClone: structuredClone, equals: (a, b) => JSON.stringify(a) === JSON.stringify(b) } };
globalThis.Hooks = { callAll() {} };
globalThis.game = { system: { id: 'dnd5e' }, user: { id: 'gm', isGM: true }, i18n: { lang: 'en' } };

function item(id, rule = {}) {
  return {id, name:id, img:'icons/svg/item-bag.svg', type:'loot', system:{quantity:1},
    flags: { buxaframework: { item:rule } },
    getFlag: (scope, path) => scope==='buxaframework' && path==='item' ? rule : undefined};
}
const rules = { equip:{enabled:true,any:true}, storage:{slots:{add:2,
  external:[{id:'pouch',mode:'complex',columns:2,rows:2,cells:[1,3]}]}}};
function makeActor({slots=4,placements=null,mode='simple'}={}) {
  const items = [item('bag',rules),item('axe',{shape:{cells:[{x:0,y:0},{x:1,y:0}]}}),
    item('coin'),item('gem'),item('ruby')];
  items.get=id=>items.find(obj=>obj.id===id);
  const state={version:4,autoSort:false,sortMode:'alphabetic',tracked:items.map(obj=>obj.id),
    placements: placements ?? {bag:{area:'equipment',slotId:'bag-slot',position:0},
      axe:{area:'storage',storageId:'bag:pouch',index:1},
      coin:{area:'inventory',index:0},gem:{area:'inventory',index:1},ruby:{area:'inventory',index:2}},
    equipmentActive:{'bag-slot':0}};
  const actor={id:'actor',isOwner:true,items,_state:structuredClone(state),writes:[],
    getFlag(_scope,key){return key==='inventory'?this._state:undefined;},
    async update(payload) { this.writes.push(payload); if (payload['flags.buxaframework.inventory'])
      this._state=structuredClone(payload['flags.buxaframework.inventory']); }
  };
  const config={items:normalizeItemSystemConfig(),resources:[],inventory:{mode,slots,
    complex:{columns:3,rows:3,autoSort:false},equipmentLayout:{
      tabs:[{id:'main',label:'Main',columns:4,rows:4}],
      slots:[{id:'bag-slot',type:'backpack',label:'Bag',capacity:1,tabId:'main',x:0,y:0}]
    }}};
  return {actor,config};
}

test('Simple storage pickup uses its actual one-cell slot, not the Item complex shape',()=>{
  const board={matches:query=>query==='[data-storage-board]',classList:{contains:()=>false}};
  const slot={closest:()=>board};
  const element={closest:query=>query==='[data-storage-index]'?slot:null};
  assert.deepEqual(simpleStoragePickupCell(element,board),{x:0,y:0});
  assert.equal(simpleStoragePickupCell({closest:()=>null},board),null);
  assert.equal(simpleStoragePickupCell(element,{...board,classList:{contains:()=>true}}),null);
  assert.equal(simpleStoragePickupCell(element,null),null);
});

test('Simple mode grants equipped bonus cells and 1x1 slots inside shaped pouches',()=>{
  const {actor,config}=makeActor();
  const effective=getEffectiveInventoryConfig(actor,config);
  assert.equal(effective.mode,'simple');assert.equal(effective.slots,6);
  const grants=getActorStorage(actor,config);
  assert.equal(grants.compartments[0].itemMode,'simple');
  const state=getInventoryState(actor,config);
  assert.equal(state.placements.axe.index,1);
  const view=prepareInventoryContext(actor,config,true);
  assert.equal(view.inventorySlots.length,6);
  assert.equal(view.externalStorage.length,1);
  assert.equal(view.externalStorage[0].isComplex,false);
  assert.equal(view.externalStorage[0].cells.filter(c=>c.enabled).length,2);
  assert.equal(view.externalStorage[0].cells[1].item.id,'axe');
  assert.equal(view.externalStorage[0].cells[3].item,undefined);
  assert.equal(view.used,3);
});

test('Simple storage cannot overlap or target a masked-out square even for a big item',async()=>{
  const {actor,config}=makeActor();
  const pouch=getActorStorage(actor,config).compartments[0];
  assert.equal(fitsExternalStorage(pouch,getInventoryState(actor,config).placements,{},'gem',0),false);
  assert.equal(fitsExternalStorage(pouch,getInventoryState(actor,config).placements,{},'gem',1),false);
  assert.equal(fitsExternalStorage(pouch,getInventoryState(actor,config).placements,{},'gem',3),true);
  assert.equal(await moveInventoryItem(actor,'gem',{area:'storage',storageId:'bag:pouch',index:0},config),null);
  assert.equal(await moveInventoryItem(actor,'gem',{area:'storage',storageId:'bag:pouch',index:1},config),null);
  assert.equal(actor.writes.length,0);
  const result=await moveInventoryItem(actor,'gem',{area:'storage',storageId:'bag:pouch',index:3},config);
  assert.equal(result.placements.gem.index,3);
  assert.equal(getInventoryState(actor,config).placements.gem.storageId,'bag:pouch');
});

test('dropping onto the Simple pouch header resolves first free masked slot, never a blocked origin',async()=>{
  const {actor,config}=makeActor();
  const destination={area:'storage',storageId:'bag:pouch',index:0,auto:true};
  const context={compartments:getActorStorage(actor,config).compartments,
    placements:getInventoryState(actor,config).placements,shapes:{},itemId:'gem'};
  assert.deepEqual(resolveAutomaticStorageDrop(destination,context),
    {area:'storage',storageId:'bag:pouch',index:3,rotation:0});
  const result=await moveInventoryItem(actor,'gem',destination,config);
  assert.equal(result.placements.gem.index,3);
  const nextContext={...context,placements:getInventoryState(actor,config).placements,itemId:'ruby'};
  assert.equal(resolveAutomaticStorageDrop(destination,nextContext),null);
  assert.equal(await moveInventoryItem(actor,'ruby',destination,config),null);
});

test('Simple pouch contents can swap with occupied inventory cells without loss',async()=>{
  const {actor,config}=makeActor();
  const moved=await moveInventoryItem(actor,'axe',{area:'inventory',index:1},config);
  assert.equal(moved.placements.axe.index,1);
  assert.deepEqual(moved.placements.gem,{area:'storage',storageId:'bag:pouch',index:1,rotation:0});
  const view=prepareInventoryContext(actor,config,true);
  assert.equal(view.externalStorage[0].cells[1].item.id,'gem');
  assert.equal(view.inventorySlots[1].item.id,'axe');
  assert.equal(getInventoryState(actor,config).tracked.length,5);
});

test('a bag cannot be placed into itself and packed pouch stays intact when unequipped',async()=>{
  const {actor,config}=makeActor();
  assert.equal(await moveInventoryItem(actor,'bag',{area:'storage',storageId:'bag:pouch',index:3},config),null);
  const moved=await moveInventoryItem(actor,'bag',{area:'inventory',index:3},config);
  assert.equal(moved.placements.bag.area,'inventory');
  assert.equal(getActorStorage(actor,config).additional,0);
  assert.equal(getEffectiveInventoryConfig(actor,config).slots,4);
  assert.equal(getInventoryState(actor,config).placements.axe.storageId,'bag:pouch');
  assert.equal(prepareInventoryContext(actor,config,true).externalStorage.length,0);
});

test('sorting Simple inventory never moves stored contents or equipped items',async()=>{
  const {actor,config}=makeActor();
  await setInventorySortMode(actor,'alphabetic',config);
  await setInventoryAutoSort(actor,true,config);
  const state=getInventoryState(actor,config);
  assert.equal(state.placements.axe.storageId,'bag:pouch');
  assert.equal(state.placements.bag.area,'equipment');
  assert.equal(state.placements.coin.area,'inventory');
  assert.equal(state.placements.gem.area,'inventory');
  assert.equal(state.placements.ruby.area,'inventory');
});

test('switching Simple and Complex changes pouch item physics, not its mask',()=>{
  const {actor,config}=makeActor();
  assert.equal(getInventoryState(actor,config).placements.axe.area,'storage');
  config.inventory.mode='complex';
  const complex=getActorStorage(actor,config).compartments[0];
  assert.equal(complex.itemMode,'complex');
  assert.equal(getInventoryState(actor,config).placements.axe,undefined,
    'the 2-wide axe cannot fit in the vertical 2-cell pouch and must be Overflow');
  config.inventory.mode='simple';
  assert.equal(getInventoryState(actor,config).placements.axe.area,'storage',
    'switching views must never rewrite saved placement data');
});

test('pouch header drop is explicitly automatic and never silently enters the main grid',()=>{
  const board={dataset:{storageBoard:'bag:pouch'}};
  const card={dataset:{storageId:'bag:pouch'}};
  const header={closest:selector=>selector==='[data-storage-board]'?null:
    selector==='.buxa-storage-compartment[data-storage-id]'?card:null};
  assert.deepEqual(getInventoryDropDestination({target:header,clientX:20,clientY:30}),
    {area:'storage',storageId:'bag:pouch',index:0,auto:true});
});

test('Simple storage occupied tiles permit stacking only into the exact matching compartment',()=>{
  const {actor,config}=makeActor();
  const destination={area:'storage',storageId:'bag:pouch',index:1};
  const pointer={closest:selector=>selector==='[data-item-id]'?{dataset:{itemId:'axe'}}:null};
  let calls=0;
  const accept=(source,target)=>{calls++;return source.id==='gem' && target.id==='axe';};
  const placements=getInventoryState(actor,config).placements;
  assert.equal(compatibleStorageStackTarget(destination,pointer,actor,'gem',placements,config,accept),'axe');
  assert.equal(calls,1);
  assert.equal(compatibleStorageStackTarget({...destination,storageId:'other:bag'},pointer,actor,'gem',placements,config,accept),null);
  assert.equal(compatibleStorageStackTarget(destination,pointer,actor,'axe',placements,config,accept),null);
  assert.equal(compatibleStorageStackTarget(destination,pointer,actor,'ruby',placements,config,()=>false),null);
  assert.equal(compatibleStorageStackTarget({area:'inventory',index:1},pointer,actor,'gem',placements,config,accept),null);
});
