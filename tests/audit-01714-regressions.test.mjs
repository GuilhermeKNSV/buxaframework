import test from 'node:test';
import assert from 'node:assert/strict';
import { encounterPlacements } from '../scripts/core/combat-encounter-model.js';
import { withInventoryMutation } from '../scripts/core/inventory.js';
import { planStackTransfer, sameStackType } from '../scripts/core/stack-capacity.js';
import { DEFAULT_SHEET_CONFIG, MODULE_ID } from '../scripts/core/constants.js';
import { collectGalleryTree } from '../scripts/core/asset-browser-scan.js';
import { normalizeHotbarState } from '../scripts/core/hotbar-state.js';
import { createItemDice, createTooltipDecoration } from '../scripts/core/item-dice-config.js';
import { normalizeHudResource } from '../scripts/core/resource-hud.js';
import { syncRangePair } from '../scripts/apps/document-editor-preview.js';

const stack = (flags = {}, equipped = false) => ({
  id: 'arrows', name:'Arrows',type:'loot',img:'arrow.png',system:{quantity:3,equipped},
  flags:{[MODULE_ID]:{item:{multiple:{enabled:true,maxStack:20,stackKey:'arrows'}}},...flags},
  getFlag(scope,key){return this.flags?.[scope]?.[key];}
});

test('stacks with unrelated module flags or native equipped state never merge', () => {
  const normal=stack(), cursed=stack({enchantment:{value:2}}), emptyFlags=stack();
  assert.equal(sameStackType(normal,emptyFlags,DEFAULT_SHEET_CONFIG),true);
  assert.equal(sameStackType(normal,cursed,DEFAULT_SHEET_CONFIG),false);
  assert.equal(sameStackType(normal,stack({},true),DEFAULT_SHEET_CONFIG),false);
  assert.equal(sameStackType(stack({},true),stack({},true),DEFAULT_SHEET_CONFIG),false);
});

test('zero stack is displayable but cannot initiate a physical transfer', () => {
  const source=stack();source.system.quantity=0;
  assert.throws(()=>planStackTransfer(source,1,[],DEFAULT_SHEET_CONFIG),/invalid source stack quantity/i);
});

test('two equipment-like occupied rectangles reserve all intersected off-grid cells', () => {
  const placed=encounterPlacements(1,{x:100,y:100},100,
    [{x:100.5,y:100.5,width:1,height:1}], {maxWidth:1000,maxHeight:1000});
  assert.equal(placed.length,1);
  assert.notDeepEqual(placed[0],{x:100,y:100});
  assert.notDeepEqual(placed[0],{x:200,y:100});
  assert.notDeepEqual(placed[0],{x:100,y:200});
  assert.notDeepEqual(placed[0],{x:200,y:200});
  assert.throws(()=>encounterPlacements(1,{x:0,y:0},100,[],{footprints:[{width:129}]}),/footprint exceeds/);
});

test('Actor inventory writes remain ordered, with rejection backpressure and recovery', async () => {
  const actor={id:'burst-actor'};
  let release;
  const gate=new Promise(resolve => {release=resolve;});
  const order=[];
  const promises=[];
  promises.push(withInventoryMutation(actor,async()=>{await gate;order.push(0);}));
  for(let i=1;i<128;i++)promises.push(withInventoryMutation(actor,async()=>{order.push(i);}));
  await assert.rejects(withInventoryMutation(actor,()=>{throw Error('must not run');}),/Too many pending inventory/);
  release();await Promise.all(promises);
  assert.deepEqual(order,Array.from({length:128},(_,i)=>i));
  assert.equal(await withInventoryMutation(actor,async()=>42),42);
});

test('gallery recursion has explicit folder and image budgets', async () => {
  const dirs=new Map([['icons',{files:['icons/a.png','icons/b.png'].map(path=>({path})),dirs:[{path:'icons/next'}]}],
    ['icons/next',{files:[{path:'icons/next/c.png'}],dirs:[]}]]);
  const result=await collectGalleryTree('icons',async path=>dirs.get(path),{maxFiles:1,maxFolders:10});
  assert.equal(result.truncated,true);
  assert.equal(result.files.length,1);
  const limited=await collectGalleryTree('icons',async path=>dirs.get(path),{maxFolders:1});
  assert.equal(limited.truncated,true);
  assert.equal(limited.folders,1);
  const single=await collectGalleryTree('icons',async()=>({files:[{path:'icons/a.png'},{path:'icons/b.png'}],dirs:[]}),{maxFiles:1});
  assert.equal(single.truncated,true);
});

test('valid hotbar tabs after 512 damaged entries are still recovered', () => {
  const invalid=Array.from({length:550},()=>({id:''}));
  const result=normalizeHotbarState({tabs:[...invalid,{id:'later',name:'Recovered'}]});
  assert.equal(result.tabs[0].id,'later');
});

test('generated dice and tooltip IDs do not rely only on same-millisecond indices', () => {
  const old=globalThis.foundry;
  let counter=0;
  try {
    globalThis.foundry={utils:{randomID:()=>`safe${++counter}`}};
    assert.notEqual(createItemDice(0).id,createItemDice(0).id);
    assert.notEqual(createTooltipDecoration(0).id,createTooltipDecoration(0).id);
  } finally {globalThis.foundry=old;}
});

test('resource HUD viewer whitelist is bounded', () => {
  const entries=Array.from({length:700},(_,i)=>`viewer-${i}`);
  assert.equal(normalizeHudResource({viewers:entries},{}).viewers.length,500);
});

test('slider keeps original configured maximum when typing a temporary large value', () => {
  const range={value:'2',min:'0',max:'10',style:{setProperty(){}},dataset:{}};
  const number={value:'250'};
  const field={querySelector(query){return query==='[data-buxa-range]'?range:number;}};
  syncRangePair(field,number);assert.equal(range.max,'250');
  number.value='3';syncRangePair(field,number);assert.equal(range.max,'10');
});

test('attribute and proficiency chat rolls pass serialized objects, not JSON strings', async () => {
  const {readFile} = await import('node:fs/promises');
  for (const file of ['../scripts/apps/attribute-roll.js', '../scripts/apps/proficiency-roll.js']) {
    const source=await readFile(new URL(file,import.meta.url),'utf8');
    assert.match(source,/rolls: results\.map\(\(entry\) => entry\.roll\.toJSON\(\)\)/);
    assert.doesNotMatch(source,/JSON\.stringify\(entry\.roll\.toJSON\(\)\)/);
  }
});

test('cyclic nested storage cannot hang the visible compartment resolver', async () => {
  const {visibleEquippedCompartments}=await import('../scripts/core/item-storage.js');
  const compartments=[
    {storageId:'A',providerId:'pa',active:false},
    {storageId:'B',providerId:'pb',active:false},
    {storageId:'C',providerId:'pc',active:true}
  ];
  const placements={pa:{area:'storage',storageId:'B'},pb:{area:'storage',storageId:'A'},
    pc:{area:'main'}};
  const visible=visibleEquippedCompartments(compartments,placements);
  assert.deepEqual(visible.map(row=>row.storageId),['C']);
});
