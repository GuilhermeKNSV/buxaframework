import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeItemSystemConfig } from '../scripts/core/item-config.js';
import { moveInventoryItem, getInventoryState, getActorStorage } from '../scripts/core/inventory.js';
import { fitsExternalStorage } from '../scripts/core/item-storage.js';
import { resolveAutomaticStorageDrop } from '../scripts/core/external-storage-placement.js';
import { sameStackType, stackRoom, maxStackOf, planStackTransfer } from '../scripts/core/stack-capacity.js';
import { canStackItems } from '../scripts/core/item-runtime.js';
import { groundCompartments, classifyGroundPlacements } from '../scripts/core/ground-container.js';
import { preservePortableStorageMode } from '../scripts/core/backpack-transfers.js';
import { pointerStorageDestination, storageDragShapes } from '../scripts/apps/inventory-storage-drop.js';

const prop = (object, path) => String(path).split('.').reduce((value, part) => value?.[part], object);
globalThis.foundry = { utils: { getProperty: prop,
  hasProperty: (object, path) => prop(object, path) !== undefined,
  deepClone: structuredClone, equals: (a,b) => JSON.stringify(a) === JSON.stringify(b) } };
globalThis.Hooks = { callAll() {} };
globalThis.game = { system: { id: 'dnd5e' }, user: { id:'gm', isGM:true }, i18n: { lang: 'en' } };

function item(id, rules = {}, type = 'loot') {
  return { id, name: id, img:'icons/svg/item-bag.svg', type, system:{quantity:1},
    flags: { buxaframework: { item: rules } },
    getFlag(scope, key) { return scope === 'buxaframework' && key === 'item' ? rules : undefined; } };
}
function world({ columns=4, rows=3, itemMode='complex', storedCoinIndex=1, weaponCells=[{x:0,y:0},{x:1,y:0},{x:2,y:0}] } = {}) {
  const bag = item('bag',{storage:{slots:{external:[{
    id:'pouch', label:'Pouch', mode:'simple', itemMode, columns, rows
  }]}}});
  const axe = item('axe',{shape:{cells:weaponCells}},'weapon');
  const coin = item('coin');
  const items=[bag,axe,coin]; items.get=id=>items.find(entry=>entry.id===id);
  const placements={bag:{area:'equipment',slotId:'pack',position:0},axe:{area:'inventory',index:0}};
  if (storedCoinIndex !== null) placements.coin={area:'storage',storageId:'bag:pouch',index:storedCoinIndex,rotation:0};
  const actor={id:'hero',isOwner:true,items,updated:[],
    _state:{version:4,tracked:items.map(x=>x.id),autoSort:false,sortMode:'alphabetic',placements,equipmentActive:{pack:0}},
    getFlag(_scope,key) { return key === 'inventory' ? this._state : undefined; },
    async update(changes) { this.updated.push(changes); if(changes['flags.buxaframework.inventory'])
      this._state=structuredClone(changes['flags.buxaframework.inventory']); }
  };
  const config={items:normalizeItemSystemConfig(), resources:[], inventory:{mode:'simple',slots:12,
    complex:{columns:4,rows:3,autoSort:false}, equipmentLayout:{
      tabs:[{id:'main',label:'Main',columns:3,rows:3}],
      slots:[{id:'pack',type:'pack',label:'Pack',capacity:1,tabId:'main',x:0,y:0}]
    }}};
  return {actor,config,bag,axe,coin};
}

test('automatic header drop from Simple Actor respects a shaped Item in a Complex pouch', async () => {
  const {actor,config,axe}=world();
  const destination={area:'storage',storageId:'bag:pouch',index:0,auto:true};
  const state=getInventoryState(actor,config);
  assert.equal(state.placements.coin.index,1);
  assert.equal(fitsExternalStorage(getActorStorage(actor,config).compartments[0],state.placements,
    {axe:axe.flags.buxaframework.item.shape},'axe',0,0),false);
  const moved=await moveInventoryItem(actor,'axe',destination,config);
  assert.equal(moved?.placements?.axe?.area,'storage');
  assert.equal(moved.placements.axe.index,4,'the first actual three-cell fit is on the second row');
  assert.equal(moved.placements.coin.index,1,'existing stored item must never be displaced');
  assert.equal(actor.items.get('axe').flags.buxaframework.item.shape.cells.length,3);
});

test('automatic pouch drop tries rotations only when an Item cannot fit otherwise', async () => {
  const {actor,config,axe}=world({columns:2,rows:3,storedCoinIndex:null});
  const pouch=getActorStorage(actor,config).compartments[0];
  const shapes={axe:axe.flags.buxaframework.item.shape};
  assert.equal(fitsExternalStorage(pouch,{},shapes,'axe',0,0),false);
  const plan=resolveAutomaticStorageDrop({area:'storage',storageId:pouch.storageId,auto:true},
    {compartments:[pouch],placements:{},shapes,itemId:'axe'});
  assert.equal(plan?.rotation,1);
  const moved=await moveInventoryItem(actor,'axe', {area:'storage',storageId:pouch.storageId,auto:true},config);
  assert.equal(moved?.placements?.axe?.rotation,1);
  assert.equal(moved?.placements?.axe?.area,'storage');
  assert.equal(axe.flags.buxaframework.item.shape.cells.length,3,'rotation must not rewrite the item shape');
});

test('automatic drops into Simple pouches keep one-slot physics for large Items', async () => {
  const {actor,config,axe}=world({columns:2,rows:2,itemMode:'simple'});
  const moved=await moveInventoryItem(actor,'axe',{area:'storage',storageId:'bag:pouch',auto:true},config);
  assert.equal(moved?.placements?.axe?.index,0);
  assert.equal(moved?.placements?.axe?.rotation,0);
  assert.equal(moved?.placements?.coin?.index,1);
});

test('normal loot remains stackable but storage-providing Items cannot merge and orphan contents', () => {
  const config={items:normalizeItemSystemConfig()};
  const stack={multiple:{enabled:true,stackKey:'same',maxStack:20}};
  const first=item('a',stack),second=item('b',structuredClone(stack));
  assert.equal(sameStackType(first,second,config),true);
  assert.equal(stackRoom(first,second,config),19);
  assert.equal(canStackItems(first,second,config),true);
  for (const storage of [
    {slots:{external:[{id:'main',columns:2,rows:2}]}},
    {slots:{add:5}},
    {equipped:{slotIds:['ring']}}
  ]) {
    const source=item('source',{...stack,storage});
    const target=item('target',{...stack,storage:structuredClone(storage)});
    assert.equal(sameStackType(source,target,config),false);
    assert.equal(stackRoom(source,target,config),0);
    assert.equal(canStackItems(source,target,config),false);
    assert.equal(maxStackOf(source,config),1,'a provider Item must own its own independent compartments');
    assert.deepEqual(planStackTransfer(source,3,[],config).chunks,[1,1,1]);
  }
});


test('pointer header drop lazily resolves correct Complex footprints while the Actor inventory is Simple', () => {
  const {actor,config}=world();
  const destination={area:'storage',storageId:'bag:pouch',auto:true};
  const actual=pointerStorageDestination(destination,'axe',
    () => getActorStorage(actor,config),()=>getInventoryState(actor,config),()=>storageDragShapes(actor));
  assert.equal(actual.index,4);
  assert.equal(actual.rotation,0);
});

test('ground transfer preserves the inherited Simple occupancy of a full backpack', () => {
  const root={name:'Backpack',flags:{buxaframework:{item:{storage:{slots:{external:[
    {id:'pouch',mode:'simple',itemMode:'inherit',columns:3,rows:1}
  ]}}}}}};
  const data=structuredClone(root);
  const weapon={name:'Sword',flags:{buxaframework:{item:{shape:{cells:[{x:0,y:0},{x:1,y:0},{x:2,y:0}]}}}}};
  const coin={name:'Coin',flags:{buxaframework:{item:{}}}};
  const contents=[
    {sourceId:'sword',providerId:'root',compartmentId:'pouch',index:0,rotation:0,data:weapon},
    {sourceId:'coin',providerId:'root',compartmentId:'pouch',index:2,rotation:0,data:coin}
  ];
  assert.equal(classifyGroundPlacements(groundCompartments({data}),contents).valid.length,1,
    'legacy ground default Complex conflicts with a one-slot-per-item packed arrangement');
  preservePortableStorageMode(data,{inventory:{mode:'simple'}});
  assert.equal(data.flags.buxaframework.item.storage.slots.external[0].itemMode,'inherit',
    'the real Item rule must not be rewritten by portable storage');
  const bags=groundCompartments({data});
  assert.equal(bags[0].itemMode,'simple');
  const result=classifyGroundPlacements(bags,contents);
  assert.equal(result.valid.length,2);
  assert.equal(result.unplaced.length,0);
  // Explicitly Complex pouches ignore the portability fallback.
  data.flags.buxaframework.item.storage.slots.external[0].itemMode='complex';
  assert.equal(groundCompartments({data})[0].itemMode,'complex');
  const fresh=structuredClone(root);
  preservePortableStorageMode(fresh,{inventory:{mode:'complex'}});
  assert.equal(groundCompartments({data:fresh})[0].itemMode,'complex');
});
