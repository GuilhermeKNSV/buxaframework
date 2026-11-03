import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fitsExternalStorage} from '../scripts/core/item-storage.js';
import {getActorStorage,getInventoryState} from '../scripts/core/inventory.js';
import {normalizeItemSystemConfig} from '../scripts/core/item-config.js';
import {prepareInventoryContext} from '../scripts/apps/inventory-context.js';
const read=relative=>readFileSync(new URL(relative,import.meta.url),'utf8');
globalThis.foundry={utils:{getProperty:(obj,path)=>path.split('.').reduce((v,k)=>v?.[k],obj)}};

const shapes={bag:{cells:[{x:0,y:0}]},axe:{cells:[{x:0,y:0},{x:0,y:1}]},coin:{cells:[{x:0,y:0}]},other:{cells:[{x:0,y:0}]}};

test('compartment outline never changes inventory item physics',()=>{
  const rect={storageId:'bag:rect',providerId:'bag',mode:'simple',itemMode:'complex',columns:2,rows:3,cells:[]};
  assert.equal(fitsExternalStorage(rect,{},shapes,'axe',0),true); // rectangle stores multi-cell weapon
  assert.equal(fitsExternalStorage(rect,{},shapes,'axe',4),false); // footprint extends beyond board
  assert.equal(fitsExternalStorage(rect,{axe:{area:'storage',storageId:rect.storageId,index:0}},shapes,'coin',2),false);
  const custom={...rect,storageId:'bag:custom',mode:'complex',cells:[0,2,4],columns:2,rows:3};
  assert.equal(fitsExternalStorage(custom,{},shapes,'axe',0),true);
  assert.equal(fitsExternalStorage(custom,{},shapes,'axe',1),false); // blocked by mask
  assert.equal(fitsExternalStorage(custom,{},shapes,'axe',4),false);
});

test('Simple mode stores one item per painted cell, even for a multi-cell item',()=>{
 const bag={storageId:'bag:custom',providerId:'bag',mode:'complex',itemMode:'simple',columns:2,rows:3,cells:[0,2,4]};
 assert.equal(fitsExternalStorage(bag,{},shapes,'axe',4,3),true);
 assert.equal(fitsExternalStorage(bag,{},shapes,'axe',1),false);
 assert.equal(fitsExternalStorage(bag,{axe:{area:'storage',storageId:bag.storageId,index:4}},shapes,'coin',4),false);
 assert.equal(fitsExternalStorage(bag,{axe:{area:'storage',storageId:bag.storageId,index:4}},shapes,'coin',2),true);
});

function actorHarness(mode,pouchMode){
 const bagRules={storage:{slots:{external:[{id:'pouch',mode:pouchMode,columns:2,rows:3,cells:[0,2,4]}]}}};
 const itemsList=[{id:'bag',name:'Backpack',img:'icons/svg/item-bag.svg',type:'loot',system:{quantity:1},getFlag:(_m,k)=>k==='item'?bagRules:null},
   {id:'axe',name:'Axe',img:'icons/svg/item-bag.svg',type:'weapon',system:{quantity:1},getFlag:(_m,k)=>k==='item'?{shape:shapes.axe}:null}];
 const items={get:id=>itemsList.find(item=>item.id===id),[Symbol.iterator]:function*(){yield* itemsList;}};
 const inventory={tracked:['bag','axe'],autoSort:false,sortMode:'alphabetic',placements:{bag:{area:'equipment',slotId:'weapon',position:0},axe:{area:'storage',storageId:'bag:pouch',index:0}},equipmentActive:{weapon:0}};
 const actor={id:'a',items,getFlag:(_m,k)=>k==='inventory'?inventory:null};
 const config={items:normalizeItemSystemConfig(),inventory:{mode,slots:6,complex:{columns:4,rows:3,autoSort:false},equipmentLayout:{slots:[{id:'weapon',type:'weapon',size:'long',tabId:'main',capacity:1}],tabs:[{id:'main',label:'Main',columns:6,rows:4}]}}};
 return {actor,config};
}

test('Actor storage inherits Complex globally even with a full-rectangle pouch',()=>{
 const {actor,config}=actorHarness('complex','simple');
 assert.equal(getActorStorage(actor,config).compartments[0].itemMode,'complex');
 assert.equal(getInventoryState(actor,config).placements.axe.area,'storage');
 const context=prepareInventoryContext(actor,config,true);
 const pouch=context.externalStorage[0];
 assert.equal(pouch.isComplex,true);
 assert.equal(pouch.items[0].pieces.length,2);
 assert.ok(pouch.cells.every(c=>c.enabled));
});

test('Actor storage inherits Simple globally even with a custom outline',()=>{
 const {actor,config}=actorHarness('simple','complex');
 assert.equal(getActorStorage(actor,config).compartments[0].itemMode,'simple');
 assert.equal(getInventoryState(actor,config).placements.axe.area,'storage');
 const pouch=prepareInventoryContext(actor,config,true).externalStorage[0];
 assert.equal(pouch.isComplex,false);
 assert.equal(pouch.cells[0].item.id,'axe');
 assert.equal(pouch.cells.filter(c=>c.enabled).length,3);
});

test('compartment visual cell geometry matches the main inventory and preserves absolute origins',()=>{
 const css=read('../styles/142-item-storage.css');
 const hbs=read('../templates/player-sheet.hbs');
 assert.match(css,/--buxa-storage-columns\)\s*\*\s*58px/);
 assert.match(css,/grid-template-rows:repeat\(var\(--buxa-storage-rows\),58px\)/);
 assert.match(css,/left:calc\(var\(--buxa-shape-x\)\s*\*\s*100%\s*\/\s*var\(--buxa-storage-columns\)\)!important/);
 assert.match(css,/top:calc\(var\(--buxa-shape-y\)\s*\*\s*100%\s*\/\s*var\(--buxa-storage-rows\)\)!important/);
 assert.match(hbs,/buxa-storage-board-scroll/);
 assert.match(hbs,/buxa-storage-cell \{\{#unless enabled\}\}is-disabled/);
});
