import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeItemStorage, fitsExternalStorage } from '../scripts/core/item-storage.js';
import { normalizeItemSystemConfig } from '../scripts/core/item-config.js';
import { getActorStorage, getInventoryState, moveInventoryItem } from '../scripts/core/inventory.js';
import { prepareInventoryContext } from '../scripts/apps/inventory-context.js';
import { resolveAutomaticStorageDrop } from '../scripts/core/external-storage-placement.js';
import { groundCompartments, groundPlacement, classifyGroundPlacements } from '../scripts/core/ground-container.js';
import { groundMarkupItem } from '../scripts/apps/ground-container-view.js';

const prop = (obj, path) => String(path).split('.').reduce((v, k) => v?.[k], obj);
globalThis.foundry = { utils: { getProperty: prop, hasProperty: (obj, path) => prop(obj, path) !== undefined,
  deepClone: structuredClone, equals: (a,b) => JSON.stringify(a) === JSON.stringify(b) } };
globalThis.Hooks = { callAll() {} };
globalThis.game = { system: { id: 'dnd5e' }, user: {id: 'gm', isGM: true}, i18n: {lang: 'en'} };
const file = file => readFileSync(new URL(file, import.meta.url), 'utf8');
const weaponShape = { cells: [{x:0,y:0},{x:1,y:0},{x:2,y:0}] };
const allRules = (itemMode='simple', mode='simple', extra={}) => ({storage:{slots:{external:[{
  id:'pocket',label:'Pocket',mode,itemMode,columns:4,rows:3,cells:[0,1,4,5,8,9],...extra
}]}}});
function build({inventoryMode='complex',itemMode='simple',pouchMode='simple',contents=false}={}) {
  const rules=allRules(itemMode,pouchMode);
  const bag={id:'bag',name:'Backpack',img:'icons/svg/item-bag.svg',flags:{buxaframework:{item:rules}},
    type:'loot',system:{quantity:1},getFlag:(_scope,key)=>key==='item'?rules:undefined};
  const axe={id:'axe',name:'Long sword',img:'icons/svg/sword.svg',type:'weapon',
    system:{quantity:1},flags:{buxaframework:{item:{shape:weaponShape}}},
    getFlag:(_scope,key)=>key==='item'?{shape:weaponShape}:undefined};
  const coin={id:'coin',name:'Coin',img:'icons/svg/coins.svg',type:'loot',system:{quantity:1},
    flags:{buxaframework:{item:{}}},getFlag:(_scope,key)=>key==='item'?{}:undefined};
  const list=[bag,axe,coin];
  list.get=id=>list.find(entry=>entry.id===id);
  const current={version:4,tracked:list.map(i=>i.id),autoSort:false,sortMode:'alphabetic',
    placements:{bag:{area:'equipment',slotId:'bagslot',position:0},
      axe:contents?{area:'storage',storageId:'bag:pocket',index:0,rotation:0}:{area:'inventory',index:0,rotation:0},
      coin:{area:'inventory',index:6}},equipmentActive:{bagslot:0}};
  const actor={id:'actor',isOwner:true,items:list,_state:structuredClone(current),
    getFlag(_scope,key){return key==='inventory'?this._state:undefined;},
    async update(update){if(update['flags.buxaframework.inventory'])this._state=structuredClone(update['flags.buxaframework.inventory']);}
  };
  const config={items:normalizeItemSystemConfig(),resources:[],inventory:{mode:inventoryMode,slots:16,
    complex:{columns:6,rows:4,autoSort:false},equipmentLayout:{tabs:[{id:'main',label:'Main',columns:3,rows:3}],
      slots:[{id:'bagslot',type:'backpack',label:'Bag',capacity:1,tabId:'main',x:0,y:0}]}}};
  return {actor,config,bag,axe,coin};
}

test('storage normalization keeps geometry mode and item mode independent, with legacy inheritance',()=>{
  const data=normalizeItemStorage(allRules('simple','complex').storage).slots.external[0];
  assert.equal(data.mode,'complex');assert.equal(data.itemMode,'simple');assert.deepEqual(data.cells,[0,1,4,5,8,9]);
  const legacy=allRules('simple','simple').storage; delete legacy.slots.external[0].itemMode;
  const unset=normalizeItemStorage(legacy).slots.external[0];
  assert.equal(unset.itemMode,'inherit');
  const invalid=normalizeItemStorage(allRules('random','simple').storage).slots.external[0];
  assert.equal(invalid.itemMode,'inherit');
  assert.equal(normalizeItemStorage(allRules('complex','simple').storage).slots.external[0].itemMode,'complex');
});

test('Complex Actor can store a 3-cell item in exactly ONE Simple pouch slot and take it out unchanged',async()=>{
  const {actor,config,axe}=build();
  const initialShape=structuredClone(axe.flags.buxaframework.item.shape);
  const pocket=getActorStorage(actor,config).compartments[0];
  assert.equal(pocket.itemMode,'simple');
  const arrived=await moveInventoryItem(actor,'axe',{area:'storage',storageId:pocket.storageId,index:0},config);
  assert.equal(arrived.placements.axe.area,'storage');
  const inside=prepareInventoryContext(actor,config,true).externalStorage[0];
  assert.equal(inside.isComplex,false);
  assert.equal(inside.cells[0].item.id,'axe');
  assert.equal(inside.cells.filter(cell=>cell.item).length,1);
  assert.deepEqual(axe.flags.buxaframework.item.shape,initialShape);
  const moved=await moveInventoryItem(actor,'axe',{area:'inventory',index:1,rotation:0},config);
  assert.equal(moved.placements.axe.area,'inventory');
  const outside=prepareInventoryContext(actor,config,true);
  assert.equal(outside.complexItems.find(item=>item.id==='axe').pieces.length,3);
  assert.deepEqual(axe.flags.buxaframework.item.shape,initialShape);
});

test('independent Simple pouch enforces collision and custom mask even in Complex main grid',async()=>{
  const {actor,config}=build({pouchMode:'complex'});
  const bag=getActorStorage(actor,config).compartments[0];
  assert.equal(bag.itemMode,'simple');
  assert.equal(fitsExternalStorage(bag,getInventoryState(actor,config).placements,{},'axe',2),false);
  assert.equal((await moveInventoryItem(actor,'axe',{area:'storage',storageId:bag.storageId,index:5},config)).placements.axe.index,5);
  assert.equal(await moveInventoryItem(actor,'coin',{area:'storage',storageId:bag.storageId,index:5},config),null);
  assert.equal((await moveInventoryItem(actor,'coin',{area:'storage',storageId:bag.storageId,index:4},config)).placements.coin.index,4);
  assert.equal(getInventoryState(actor,config).placements.axe.index,5);
  assert.equal(prepareInventoryContext(actor,config,true).externalStorage[0].cells.filter(c=>c.enabled).length,6);
});

test('Complex pouch still respects multi-cell footprint regardless of Actor inventory mode',()=>{
  const {actor,config}=build({inventoryMode:'simple',itemMode:'complex'});
  const bag=getActorStorage(actor,config).compartments[0];
  assert.equal(bag.itemMode,'complex');
  const state=getInventoryState(actor,config);
  assert.equal(fitsExternalStorage(bag,state.placements,{axe:weaponShape},'axe',0),true);
  assert.equal(fitsExternalStorage(bag,state.placements,{axe:weaponShape},'axe',2),false);
});

test('Simple Actor with Complex pouch validates saved shapes instead of accepting overlapping items',()=>{
  const {actor,config}=build({inventoryMode:'simple',itemMode:'complex',contents:true});
  // The first 3-cell item occupies cells 0,1,2. A later item cannot share cell 1.
  actor._state.placements.coin={area:'storage',storageId:'bag:pocket',index:1,rotation:0};
  const state=getInventoryState(actor,config);
  assert.equal(state.placements.axe.area,'storage');
  assert.equal(state.placements.coin,undefined);
  const view=prepareInventoryContext(actor,config,true).externalStorage[0];
  assert.equal(view.isComplex,true);
  assert.equal(view.items.find(i=>i.id==='axe').pieces.length,3);
});

test('automatic pouch placement knows Simple item occupancy and preserves direct slot placement',()=>{
  const {actor,config}=build({contents:true});
  const state=getInventoryState(actor,config);
  const bag=getActorStorage(actor,config).compartments[0];
  const placement=resolveAutomaticStorageDrop({area:'storage',storageId:bag.storageId,auto:true},
    {compartments:[bag],placements:state.placements,shapes:{axe:weaponShape},itemId:'coin'});
  assert.equal(placement.index,1);
});

test('changing the global inventory mode does not alter an explicitly Simple pouch',()=>{
  const {actor,config}=build({itemMode:'simple',contents:true});
  assert.equal(getInventoryState(actor,config).placements.axe.area,'storage');
  config.inventory.mode='simple';
  assert.equal(getActorStorage(actor,config).compartments[0].itemMode,'simple');
  assert.equal(getInventoryState(actor,config).placements.axe.area,'storage');
  assert.equal(prepareInventoryContext(actor,config,true).externalStorage[0].cells[0].item.id,'axe');
});

test('ground containers retain explicit Simple physics when moved off the Actor',()=>{
  const {bag,axe}=build();
  const data={flags:{buxaframework:{item:bag.flags.buxaframework.item}}};
  const record={data};
  const ground=groundCompartments(record)[0];
  assert.equal(ground.itemMode,'simple');
  assert.equal(groundPlacement(record,axe.flags.buxaframework.item && {flags:{buxaframework:{item:axe.flags.buxaframework.item}}},ground.storageId,0,0),0);
  const child={sourceId:'axe',providerId:'root',compartmentId:ground.id,index:0,rotation:0,
    data:{name:axe.name,img:axe.img,system:axe.system,flags:axe.flags}};
  const classified=classifyGroundPlacements([ground],[child]);
  assert.equal(classified.valid.length,1);
  const markup=groundMarkupItem(child,ground);
  assert.match(markup,/--buxa-shape-w:1;--buxa-shape-h:1/);
});

test('item editor exposes independent occupancy controls for saved and newly added pouches',()=>{
  const template=file('../templates/item-config.hbs');
  const editor=file('../scripts/apps/item-storage-editor.js');
  assert.equal((template.match(/data-storage-item-mode(?=\s|=)/g)||[]).length,2);
  assert.match(editor,/itemMode:row\.querySelector\('\[data-storage-item-mode\]'\)/);
  assert.match(template,/Simple · 1 slot\/item/);
  assert.match(template,/Complex · item shape/);
});

test('ground pointer placement into Simple compartment aligns a grabbed long item with the hovered tile',async()=>{
  const {bag,axe}=build({itemMode:'simple'});
  const {planGroundContainerPlacement,groundRejectedFootprint}=await import('../scripts/core/ground-drop-intent.js');
  const record={data:{flags:{buxaframework:{item:bag.flags.buxaframework.item}}}};
  const incoming={flags:axe.flags};
  const plan=planGroundContainerPlacement(record,incoming,{storageId:'root:pocket',hoverIndex:1,rotation:0,gripX:.95,gripY:.5});
  assert.equal(plan.index,1,'simple placement is a single slot, regardless of grabbed complex-cell index');
  assert.deepEqual(plan.grabbed,{x:0,y:0});
  const bagSpec=groundCompartments(record)[0];
  assert.equal(groundRejectedFootprint({bag:bagSpec,column:1,row:1},incoming,{gripX:.99}).index,5);
});

test('Simple pouch drag ghost is compact only while inside that compartment',async()=>{
  const {transitionStorageOccupancyGhost}=await import('../scripts/apps/inventory-occupancy-ghost.js');
  const classes=new Set(['is-complex-ghost']);
  const children=[];
  const ghost={classList:{contains:key=>classes.has(key),add:(...names)=>names.forEach(x=>classes.add(x)),
    remove:(...names)=>names.forEach(x=>classes.delete(x))},
    style:{},replaceChildren(){children.length=0;},ownerDocument:{createElement:()=>({})},append(child){children.push(child);}};
  const compartments=[{storageId:'bag:pocket',itemMode:'simple'},{storageId:'bag:other',itemMode:'complex'}];
  let restored=0;
  const props={ghost,compartments,image:'icons/svg/sword.svg',cellSize:58,shaped:true,
    restoreShape:()=>{restored++;classes.add('is-complex-ghost');},offsets:()=>({offsetX:85,offsetY:29})};
  assert.deepEqual(transitionStorageOccupancyGhost({...props,destination:{area:'storage',storageId:'bag:pocket'}}),
    {offsetX:29,offsetY:29});
  assert.equal(ghost.style.width,'58px');
  assert.equal(classes.has('is-complex-ghost'),false);
  assert.equal(children.length,1);
  assert.equal(transitionStorageOccupancyGhost({...props,destination:{area:'storage',storageId:'bag:pocket'}}),null);
  assert.deepEqual(transitionStorageOccupancyGhost({...props,destination:{area:'storage',storageId:'bag:other'}}),
    {offsetX:85,offsetY:29});
  assert.equal(restored,1);
  assert.equal(classes.has('is-complex-ghost'),true);
});
