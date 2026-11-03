import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeItemRules, normalizeItemSystemConfig } from '../scripts/core/item-config.js';
import { normalizeItemStorage, normalizeStorageTooltip } from '../scripts/core/item-storage.js';
import { buildStorageTooltip } from '../scripts/core/storage-tooltip.js';
import { presentationColor } from '../scripts/core/item-presentation.js';
import { getInventoryState, moveInventoryItem } from '../scripts/core/inventory.js';
import { createPlacementScanner } from '../scripts/core/inventory-shapes.js';
import { resolveAnchoredComplexPlacement } from '../scripts/core/complex-grid-anchor.js';
const read = path => readFileSync(new URL('../'+path, import.meta.url),'utf8');

test('new items are not equippable and have no storage tooltip unless toggled',()=>{
  const rules = normalizeItemRules({});
  assert.equal(rules.equip.enabled,false);
  assert.equal(rules.storage.tooltip.enabled,false);
  assert.equal(normalizeStorageTooltip({}).enabled,false);
  assert.equal(normalizeItemStorage({slots:{external:[]}}).tooltip.enabled,false);
  assert.equal(normalizeItemRules({equip:{enabled:true,any:true},storage:{tooltip:{enabled:true}}}).equip.enabled,true);
  assert.equal(normalizeStorageTooltip({enabled:true}).enabled,true);
});

test('storage tooltip may use any configured rarity without changing parent rarity',()=>{
  const rarities=[{id:'common',color:'#777777'},{id:'rare',color:'#123abc'},{id:'epic',color:'#ff00dd'}];
  const bag={slots:{external:[{id:'b',label:'Pouch',columns:3,rows:2}]},tooltip:{enabled:true,style:'rarity',rarityId:'epic'}};
  const view=buildStorageTooltip(bag,'#777777',rarities);
  assert.equal(view.accent,'#ff00dd');
  assert.equal(view.capacity,6);
  assert.equal(normalizeItemStorage(bag).tooltip.rarityId,'epic');
  assert.equal(buildStorageTooltip({...bag,tooltip:{enabled:true,style:'rarity',rarityId:'missing'}},'#777777',rarities).accent,'#777777');
});

test('item effect lines use the chosen custom or other-rarity color on the sheet',()=>{
  assert.equal(presentationColor({style:'custom',color:'#ff0000'},null,{}),'#ff0000');
  assert.equal(presentationColor({style:'rarity',rarityId:'rare'},null,{items:normalizeItemSystemConfig()}),'#4d98f0');
  const itemSheet=read('scripts/apps/item-sheet.js');
  assert.match(itemSheet,/diceLines: presentation\.diceLines/);
  assert.match(itemSheet,/increaseLines: presentation\.increaseLines/);
  const css=read('styles/112-item-effect-display.css');
  assert.match(css,/\.buxa-item-sheet \.buxa-item-tooltip-line \.buxa-item-effect-value,[\s\S]*?color: var\(--buxa-tooltip-color/);
});

test('display case is preserved and stack controls are scroll-safe',()=>{
  const css=read('styles/96-item-fantasy.css');
  assert.match(css,/\.buxa-item-title-row h1 \{[\s\S]*?text-transform: none/);
  const stack=read('styles/98-item-config-layout.css');
  assert.match(stack,/\.buxa-item-stack-config > \.buxa-segmented/);
  assert.match(stack,/label\.buxa-stack-max-setting[\s\S]*?grid-template-columns:minmax\(0,1fr\)/);
});

test('image gallery commits directly on dblclick, only once per selection',()=>{
  const file=read('scripts/apps/asset-browser.js');
  assert.match(file,/addEventListener\("dblclick"/);
  assert.match(file,/if \(this\._committing\) return/);
  assert.match(file, /#commit\(tile\.dataset\.assetPreviewPath\)/);
});

test('L-shaped neighbors never intercept a logical vacant occupied grid cell',()=>{
  const shapes={gloves:{cells:[{x:0,y:0},{x:0,y:1}]},axe:{cells:[{x:0,y:0},{x:0,y:1},{x:1,y:1}]}};
  const scanner=createPlacementScanner(shapes,{columns:6,rows:6});
  scanner.occupy('gloves',7,0);
  const geometry={left:0,top:0,right:348,bottom:348,columns:6,rows:6,cellSize:58,cellHeight:58};
  // Hand holds the lower tile of the axe while its arm fits flush beside gloves.
  const hit=resolveAnchoredComplexPlacement(geometry,2.5*58,3.5*58,{x:0,y:1},scanner,'axe');
  assert.equal(hit.index,2*6+2);
  assert.equal(hit.valid,true);
  // Exactly one logical cell is authoritative for all pointer operations.
  const pointerCss=read('styles/132-complex-artwork-editor.css');
  assert.match(pointerCss,/\.buxa-complex-board > \.buxa-complex-item \*/);
  assert.match(pointerCss,/pointer-events: none !important/);
  assert.match(read('scripts/apps/inventory-board-hit-bindings.js'),/complexDragHandlers\.get\(itemId\)/);
});

test('v4 collision after resizing does not unexpectedly move adjacent saved item',()=>{
  const shapes={gloves:{cells:[{x:0,y:0},{x:0,y:1}]},axe:{cells:[{x:0,y:0},{x:1,y:0}]}};
  const entries=Object.entries(shapes).map(([id,shape])=>({id,name:id,img:'icons/svg/item-bag.svg',type:'loot',system:{quantity:1},getFlag:(scope,key)=>scope==='buxaframework'&&key==='item'?{shape}:null}));
  const items={get:id=>entries.find(e=>e.id===id),[Symbol.iterator]:function*(){yield* entries;}};
  const original={version:4,autoSort:false,sortMode:'alphabetic',tracked:['gloves','axe'],placements:{gloves:{area:'inventory',index:0},axe:{area:'inventory',index:0}},equipmentActive:{}};
  const actor={isOwner:true,items,getFlag:(_scope,key)=>key==='inventory'?original:null};
  const config={items:normalizeItemSystemConfig(),inventory:{mode:'complex',complex:{columns:6,rows:6,activeCells:36}}};
  const state=getInventoryState(actor,config);
  assert.equal(state.placements.gloves.index,0);
  assert.equal(state.placements.axe,undefined); // overflow, not silently relocated
  assert.deepEqual(original.placements.axe,{area:'inventory',index:0}); // saved state untouched
});
