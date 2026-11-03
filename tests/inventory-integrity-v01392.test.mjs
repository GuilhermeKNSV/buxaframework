import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SHEET_CONFIG } from '../scripts/core/constants.js';
import { normalizeItemSystemConfig } from '../scripts/core/item-config.js';
import { normalizeItemIncreases } from '../scripts/core/item-increase-config.js';
import { occupiedCells, packShapes, firstFitShape } from '../scripts/core/inventory-shapes.js';
import { getInventoryState, setInventoryAutoSort } from '../scripts/core/inventory.js';
import { setFullbodyImage, setTokenImage } from '../scripts/core/sync.js';
import { setSheetConfig } from '../scripts/core/config.js';

const clone=structuredClone;
globalThis.foundry ??= {utils:{deepClone:clone,equals:(a,b)=>JSON.stringify(a)===JSON.stringify(b),getProperty:(data,path)=>path.split('.').reduce((v,k)=>v?.[k],data)}};
const configFor=mode=>({ ...clone(DEFAULT_SHEET_CONFIG), items:normalizeItemSystemConfig(),
  inventory:{mode,slots:8,complex:{columns:4,rows:2,activeCells:8,autoSort:false},equipmentLayout:{slots:[],tabs:[]}} });

function inventoryActor(mode,index) {
  const state={version:4,autoSort:false,sortMode:'alphabetic',tracked:['gem'],
    placements:{gem:{area:'inventory',index}},equipmentActive:{}};
  const doc={id:'gem',name:'Gem',img:'',system:{quantity:1},getFlag:()=>({shape:{cells:[{x:0,y:0}]}})};
  const items={get: id=>id==='gem'?doc:null,*[Symbol.iterator](){yield doc}};
  return {id:'actorA',isOwner:true,items,state,getFlag:(_scope,key)=>key==='inventory'?state:null,
    update:async patch=>Object.assign(state, clone(patch['flags.buxaframework.inventory']??state))};
}

for (const bad of [null, '', ' ', ' \t ', false, true, [], {}, 'NaN', '-1', '-0.5', 1.5])
  for (const mode of ['simple','complex']) test(`corrupt ${mode} saved index ${JSON.stringify(bad)} never becomes a valid occupied cell`,()=>{
    const actor=inventoryActor(mode,bad);
    assert.equal(getInventoryState(actor,configFor(mode)).placements.gem,undefined);
  });

for (const input of ['false','FALSE','0','off','OFF','no',' No ']) test(`item increase tooltip disabled as ${JSON.stringify(input)} stays disabled`,()=>{
  const rules=normalizeItemIncreases([{target:'attribute:str:value',tooltip:{enabled:input}}]);
  assert.equal(rules[0].tooltip.enabled,false);
});

test('overlapping legacy shapes never reserve extra phantom cells',()=>{
  const shapes={first:{cells:[{x:0,y:0},{x:1,y:0}]},
    damaged:{cells:[{x:0,y:0},{x:1,y:0}]},new:{cells:[{x:0,y:0}]}};
  const positions={first:{area:'inventory',index:0},damaged:{area:'inventory',index:1}};
  const config={columns:4,rows:2,activeCells:8};
  const map=occupiedCells(positions,shapes,config);
  assert.deepEqual([...map.keys()].sort((a,b)=>a-b),[0,1]);
  assert.equal(firstFitShape(positions,shapes,'new',0,config),2);
});

test('packing normalizes legacy string rotations before exploring all orientations',()=>{
  const shapes={
    s0:{cells:[{x:0,y:0},{x:1,y:0},{x:0,y:1}]},
    s1:{cells:[{x:0,y:0},{x:0,y:1}]},s2:{cells:[{x:0,y:0},{x:1,y:0}]},
    s3:{cells:[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:2,y:1}]},
    s4:{cells:[{x:0,y:0},{x:0,y:1}]}
  };
  const ids=Object.keys(shapes), grid={columns:4,rows:3,activeCells:12};
  const numeric=packShapes(ids,shapes,grid,Object.fromEntries(ids.map(id=>[id,1])));
  const strings=packShapes(ids,shapes,grid,Object.fromEntries(ids.map(id=>[id,'1'])));
  assert.deepEqual(strings,numeric);
});

test('saved inventory observer throwing cannot invalidate a confirmed Actor write',async()=>{
  const actor=inventoryActor('simple',0);
  globalThis.Hooks={callAll(){throw Error('broken third-party listener')}};
  const result=await setInventoryAutoSort(actor,true,configFor('simple'));
  assert.equal(result.autoSort,true);
  assert.equal(actor.state.autoSort,true);
});

test('actor portrait save remains successful even if an observer throws',async()=>{
  let saved;
  globalThis.Hooks={callAll(){throw Error('broken third-party listener')}};
  const actor={isOwner:true,update:async patch=>{saved=patch}};
  assert.equal(await setFullbodyImage(actor,'portrait.png'),true);
  assert.deepEqual(saved,{img:'portrait.png'});
});

test('token prototype texture save remains successful even if an observer throws',async()=>{
  let saved;
  globalThis.Hooks={callAll(){throw Error('broken third-party listener')}};
  const actor={isOwner:true,prototypeToken:{},update:async patch=>{saved=patch}};
  assert.equal(await setTokenImage(actor,'token.png'),true);
  assert.deepEqual(saved,{'prototypeToken.texture.src':'token.png'});
});

test('saved world settings succeed even if a third-party observer throws',async()=>{
  let saved;
  globalThis.Hooks={callAll(){throw Error('broken third-party listener')}};
  globalThis.game={settings:{set:async(_scope,_id,value)=>{saved=value;return value}}};
  const result=await setSheetConfig(clone(DEFAULT_SHEET_CONFIG));
  assert.deepEqual(result,saved);
});

import { createGroundFootprintChecker } from '../scripts/core/ground-footprint-checker.js';
const smallChest={storageId:'root:pouch',providerId:'root',mode:'simple',itemMode:'complex',columns:3,rows:2};
const testShape={cells:[{x:0,y:0},{x:1,y:0}]};
const testItemData={flags:{buxaframework:{item:{shape:{cells:[{x:0,y:0}]}}}}};
for (const [label,positions] of [
  ['off-edge item',{broken:{area:'storage',storageId:'root:pouch',index:2}}],
  ['illegal rotation',{broken:{area:'storage',storageId:'root:pouch',index:0,rotation:99}}],
  ['missing index',{broken:{area:'storage',storageId:'root:pouch',index:null}}],
  ['blank index',{broken:{area:'storage',storageId:'root:pouch',index:''}}],
  ['negative index',{broken:{area:'storage',storageId:'root:pouch',index:-1}}]
]) test(`ground footprint checker ignores ${label} rather than inventing occupied cells`,()=>{
  const checker=createGroundFootprintChecker([smallChest],positions,{broken:testShape},testItemData,'moving');
  for(let index=0;index<6;index++) assert.equal(checker.fits('root:pouch',index),true);
});

test('ground footprint checker ignores later corrupted overlaps in full, not partially',()=>{
  const placements={good:{area:'storage',storageId:'root:pouch',index:0},
    collision:{area:'storage',storageId:'root:pouch',index:1}};
  const checker=createGroundFootprintChecker([smallChest],placements,{good:testShape,collision:testShape},testItemData,'moving');
  assert.equal(checker.fits('root:pouch',0),false);
  assert.equal(checker.fits('root:pouch',1),false);
  assert.equal(checker.fits('root:pouch',2),true);
});

import { setLinkedUsers } from '../scripts/core/permissions.js';
import { setDamageReduction } from '../scripts/core/other-stats.js';

test('linked user permissions are saved even if an optional observer throws',async()=>{
  globalThis.Hooks={callAll(){throw Error('broken third-party listener')}};
  globalThis.CONST={DOCUMENT_OWNERSHIP_LEVELS:{OWNER:3,NONE:0}};
  const gm={id:'gm',isGM:true},player={id:'player',isGM:false};
  const users=[gm,player];users.get=id=>users.find(u=>u.id===id);
  globalThis.game={user:gm,users};
  let committed;
  const actor={ownership:{},update:async data=>{committed=data}};
  assert.equal(await setLinkedUsers(actor,['player']),true);
  assert.deepEqual(committed['flags.buxaframework.linkedUsers'],['player']);
  assert.equal(committed.ownership.player,3);
});

test('damage-reduction saves cannot be undone by a third-party observer exception',async()=>{
  globalThis.Hooks={callAll(){throw Error('broken third-party listener')}};
  const raw=clone(DEFAULT_SHEET_CONFIG);
  globalThis.game={settings:{get:()=>raw}};
  let saved=0;
  const actor={isOwner:true,items:[],getFlag:(scope,key)=>key==='otherStats.damageReduction'?saved:null,
    update:async patch=>{saved=patch['flags.buxaframework.otherStats.damageReduction']}};
  assert.deepEqual(await setDamageReduction(actor,5),{before:0,after:5});
  assert.equal(saved,5);
});
