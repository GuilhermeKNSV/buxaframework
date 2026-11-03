import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_SHEET_CONFIG,MODULE_ID} from '../scripts/core/constants.js';
import {createPlacementScanner,occupiedCells,canPlaceShape} from '../scripts/core/inventory-shapes.js';
import {fitsExternalStorage} from '../scripts/core/item-storage.js';
import {createGroundFootprintChecker} from '../scripts/core/ground-footprint-checker.js';
import {groundCellAtPoint,groundVisibleCellAtPoint} from '../scripts/core/ground-window-hit-geometry.js';
import {groundDropDestination,groundPlacement,groundAddBranch} from '../scripts/core/ground-container.js';
import {resolveInventoryContainerDrop} from '../scripts/core/inventory-container-drop.js';
import {planStackTransfer} from '../scripts/core/stack-capacity.js';
import {normalizeItemResourceEffects,normalizeItemLimits,rechargeItemUsage} from '../scripts/core/item-use-config.js';
import {applyCombatRecharge,combatTurnAdvance} from '../scripts/integrations/combat-item-recharge.js';
import {compositeStackArtwork} from '../scripts/core/stack-artwork-canvas.js';
import {collectGalleryTree} from '../scripts/core/asset-browser-scan.js';
import {visibleAssetFolders} from '../scripts/core/asset-browser-model.js';
import {preflightItemUse} from '../scripts/core/item-use-runtime.js';

const config=structuredClone(DEFAULT_SHEET_CONFIG);
const one={cells:[{x:0,y:0}]};
const wide={cells:[{x:0,y:0},{x:1,y:0}]};
const tall={cells:[{x:0,y:0},{x:0,y:1}]};
const grid={columns:3,rows:2,activeCells:4};
const pos=index=>({area:'inventory',index});
const scan=(placements,shapes={a:one,b:one})=>occupiedCells(placements,shapes,grid);
for(const [label,index] of [['null origin',null],['empty origin',''],['whitespace origin','  '],['boolean origin',false],['negative origin',-1],['fractional origin',1.5],['missing origin',undefined]]){
  test(`inventory geometry rejects ${label} without phantom occupancy`,()=>{
    assert.equal(scan({a:pos(index)}).size,0);
    assert.equal(canPlaceShape({a:pos(index)},{a:one,b:one},'b',0,0,grid),true);
  });
}
test('inventory ignores placements in capacity-disabled tail cells',()=>{
  assert.equal(scan({a:pos(4)}).size,0);
  assert.equal(canPlaceShape({a:pos(4)},{a:one,b:one},'b',3,0,grid),true);
});
test('inventory ignores shapes partly crossing into inactive cells',()=>{
  assert.equal(scan({a:pos(3)},{a:wide}).size,0);
});
test('inventory still blocks a legitimate occupied cell',()=>{
  assert.equal(canPlaceShape({a:pos(0)},{a:one,b:one},'b',0,0,grid),false);
});
const bag={columns:2,rows:2,mode:'simple',itemMode:'complex',storageId:'chest:bag',providerId:'chest',cells:[]};
for(const rotation of [-2,-1,4,5,1.5]) {
  test(`storage rejects invalid rotation ${rotation} before saving`,()=>{
    assert.equal(fitsExternalStorage(bag,{}, {s:one},'s',0,rotation),false);
    const checker=createGroundFootprintChecker([bag],{}, {},{flags:{buxaframework:{item:{shape:one}}}},'s');
    assert.equal(checker.fits(bag.storageId,0,rotation),false);
  });
}
test('valid storage rotations remain available',()=>{
  assert.equal(fitsExternalStorage(bag,{}, {s:one},'s',0,3),true);
});
const rectangle={left:0,top:0,width:100,height:100};
const windowBag={columns:2,rows:2,mode:'simple'};
for(const value of [NaN,Infinity,-Infinity]){
  test(`pointer mapping rejects nonfinite x ${String(value)}`,()=>{
    assert.equal(groundCellAtPoint(value,10,rectangle,windowBag),null);
    assert.equal(groundVisibleCellAtPoint(value,10,{viewportRect:{...rectangle,right:100,bottom:100},boardRect:rectangle,bag:windowBag}),null);
  });
  test(`pointer mapping rejects nonfinite y ${String(value)}`,()=>{
    assert.equal(groundCellAtPoint(10,value,rectangle,windowBag),null);
    assert.equal(groundVisibleCellAtPoint(10,value,{viewportRect:{...rectangle,right:100,bottom:100},boardRect:rectangle,bag:windowBag}),null);
  });
}
test('incomplete viewport rectangle cannot create a virtual drop cell',()=>{
  assert.equal(groundVisibleCellAtPoint(30,30,{viewportRect:{left:0,top:0},boardRect:rectangle,bag:windowBag}),null);
});
test('masked empty storage cells remain non-droppable',()=>{
  assert.equal(groundCellAtPoint(75,25,rectangle,{...windowBag,mode:'complex',cells:[0]}),null);
});
const crate=(external, contents=[])=>({data:{flags:{buxaframework:{item:{storage:{slots:{external}}},backpackContents:contents}}}});
const picture={name:'Sword',type:'loot',flags:{buxaframework:{item:{shape:wide}}}};
test('explicit chest drop tries later compartments when the first masks the cell',()=>{
  const record=crate([{id:'blocked',mode:'complex',columns:2,rows:1,cells:[0]},
    {id:'open',mode:'simple',columns:2,rows:1}]);
  assert.deepEqual(groundDropDestination(record,{flags:{buxaframework:{item:{shape:one}}}},{index:1,rotation:0}),
    {storageId:'root:open',index:1,rotation:0});
});
for(const index of ['',false,' ',1.5,-1,NaN]){
  test(`manual chest placement rejects malformed index ${String(index)}`,()=>{
    assert.equal(groundDropDestination(crate([{id:'one',mode:'simple',columns:2,rows:1}]),
      {flags:{buxaframework:{item:{shape:one}}}},{storageId:'root:one',index,rotation:0}),null);
  });
}
test('chest placement refuses a corrupt contents bundle rather than hiding it',()=>{
  const invalid=[{sourceId:'broken',providerId:'missing',compartmentId:'one',index:0,rotation:0,data:{}}];
  assert.throws(()=>groundPlacement(crate([{id:'one',mode:'simple',columns:2,rows:2}],invalid),
    {flags:{buxaframework:{item:{shape:one}}}},'root:one'),/parent/);
});
test('chest addition rejects rotations that would be corrupt on the next read',()=>{
  assert.throws(()=>groundAddBranch(crate([{id:'one',mode:'simple',columns:2,rows:2}]),
    {flags:{buxaframework:{item:{shape:one}}}},[],'root:one',0,4,()=> 'fresh'),/fit/);
});
test('auto-drop on another item rotates a tall shape to fit a wide-only pouch',()=>{
  const compartments=[{storageId:'bag:s',providerId:'bag',columns:2,rows:1,mode:'simple',itemMode:'complex'}];
  const result=resolveInventoryContainerDrop({movingId:'sword',hoveredId:'bag',compartments,
    placements:{bag:pos(9)},shapes:{sword:tall},rotation:0});
  assert.equal(result.valid,true);
  assert.equal(result.destination.rotation,1);
});
test('full backpack shortcut cannot move the item to another inventory cell',()=>{
  const compartments=[{storageId:'bag:s',providerId:'bag',columns:1,rows:1,mode:'simple',itemMode:'complex'}];
  const result=resolveInventoryContainerDrop({movingId:'sword',hoveredId:'bag',compartments,
    placements:{occupant:{area:'storage',storageId:'bag:s',index:0}},shapes:{sword:one,occupant:one}});
  assert.equal(result.valid,false);
});
const stack=(id,quantity)=>({id,name:'Coin',type:'loot',img:'coin.png',system:{quantity},flags:{buxaframework:{item:{multiple:{enabled:true,maxStack:10,stackKey:'gold'}}}},getFlag(scope,key){return this.flags[scope]?.[key];}});
for(const quantity of [-2,1.5,Infinity,NaN]){
  test(`stack planning rejects invalid transfer quantity ${String(quantity)}`,()=>{
    assert.throws(()=>planStackTransfer(stack('source',2),quantity,[stack('t',1)],config),/quantity/);
  });
}
test('stack planner ignores a duplicate target ID instead of double-spending room',()=>{
  const t=stack('t',8);
  const plan=planStackTransfer(stack('source',7),7,[t,t],config);
  assert.equal(plan.merges.length,1);
  assert.equal(plan.merges[0].amount,2);
  assert.deepEqual(plan.chunks,[5]);
});
test('stack planner still fills separate partial stacks',()=>{
  const plan=planStackTransfer(stack('source',7),7,[stack('t',8),stack('u',7)],config);
  assert.deepEqual(plan.merges.map(m=>m.amount),[2,3]);
  assert.deepEqual(plan.chunks,[2]);
});
for(const progress of [NaN,Infinity,-3,3.5]){
  test(`combat recharge rejects corrupt progress ${String(progress)}`,()=>{
    assert.deepEqual(applyCombatRecharge({used:4},progress,{everyTurns:2,charges:1},1),
      {usage:{used:4},progress:1,triggers:0});
  });
}
for(const [period,charges] of [[0,2],[2,NaN],[-4,-1],[Infinity,Infinity]]){
  test(`combat recharge normalizes invalid rule (${String(period)},${String(charges)})`,()=>{
    const result=applyCombatRecharge({used:4},0,{everyTurns:period,charges},1);
    assert.ok(Number.isSafeInteger(result.usage.used)&&result.usage.used>=0);
    assert.ok(Number.isSafeInteger(result.progress)&&result.progress>=0);
    assert.ok(Number.isSafeInteger(result.triggers)&&result.triggers>=0);
  });
}
test('combat invalid delta cannot add charges',()=>{
  assert.equal(applyCombatRecharge({used:4},0,{everyTurns:1,charges:1},Infinity).usage.used,4);
});
test('combat correctly advances across a round',()=>{
  assert.equal(combatTurnAdvance({round:1,turn:2},{round:2,turn:1},3),2);
});
test('recharge does not charge a decreased Max Uses limit as an invisible debt',()=>{
  assert.deepEqual(rechargeItemUsage(normalizeItemLimits({enabled:true,maxUses:4}),{used:60},2),{used:2});
});
test('resource-effect normalized duplicate IDs remain unique and bounded',()=>{
  const name='x'.repeat(60);const effects=normalizeItemResourceEffects(Array.from({length:32},()=>({id:name})));
  assert.equal(new Set(effects.map(e=>e.id)).size,32);
  assert.ok(effects.every(e=>e.id.length<=60));
});
const listing=async path=>({files:path==='icon'?[{path:'icon/gold.png'},{path:'secret.png'},{path:'icon/../secret.png'}]:[],
  dirs:path==='icon'?[{path:'icon/armor'},{path:'icon/../secret'},{path:'outside'}]:[]});
test('recursive gallery excludes sibling files and attempted parent traversal',async()=>{
  const visited=[];const result=await collectGalleryTree('icon',async path=>{visited.push(path);return listing(path);});
  assert.deepEqual(result.files.map(file=>file.path),['icon/gold.png']);
  assert.deepEqual(visited,['icon','icon/armor']);
});
test('folder tree safely handles an unloaded listing without a dirs property',()=>{
  assert.doesNotThrow(()=>visibleAssetFolders('icon',new Map([['icon',{}]]),new Set(['icon']),'icon'));
});
test('folder tree cannot follow a parent reference into another branch',()=>{
  const tree=visibleAssetFolders('icon',new Map([['icon',{dirs:[{path:'icon/../other'},{path:'outside'}]}]]),new Set(['icon']),'icon');
  assert.equal(tree.length,1);
});
test('image composite cache distinguishes distinct fallbacks for identical missing layers',async()=>{
  const before={document:globalThis.document,Image:globalThis.Image};
  try {
    globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({})})};
    globalThis.Image=class {set src(_){this.onerror?.();}};
    const layers=[{img:'missing-uniq-audit.png',x:50,y:50,size:50,rotation:0,opacity:1}];
    const a=await compositeStackArtwork({custom:true,img:'first.png',layers});
    const b=await compositeStackArtwork({custom:true,img:'second.png',layers});
    assert.equal(a,'first.png');assert.equal(b,'second.png');
  } finally {globalThis.document=before.document;globalThis.Image=before.Image;}
});
test('corrupt image layer drawing falls back instead of caching a permanent rejection',async()=>{
  const before={document:globalThis.document,Image:globalThis.Image};
  try {
    globalThis.document={createElement:()=>({getContext:()=>({save(){},restore(){},translate(){},rotate(){},drawImage(){throw Error('bad pixel');}})})};
    globalThis.Image=class {set src(_){this.onload?.();}};
    const layers=[{img:'bad-unique-audit.png',x:50,y:50,size:NaN,rotation:0,opacity:1}];
    assert.equal(await compositeStackArtwork({custom:true,img:'fallback.png',layers}),'fallback.png');
  } finally {globalThis.document=before.document;globalThis.Image=before.Image;}
});

// Item-level Foundry transaction fixtures: deliberately mutate documents mid-await.
const getPath=(object,path)=>String(path).split('.').reduce((part,key)=>part?.[key],object);
const setPath=(object,path,value)=>{let node=object;const keys=String(path).split('.');for(const key of keys.slice(0,-1))node=node[key]??={};node[keys.at(-1)]=structuredClone(value);};
const {rechargeItem,canRechargeWithItem}=await import('../scripts/core/item-recharge.js');
function rechargeFixture({materials=1,used=3}={}){
  globalThis.foundry={utils:{getProperty:getPath,setProperty:setPath,deepClone:structuredClone,hasProperty:(o,p)=>getPath(o,p)!==undefined}};
  globalThis.game={system:{id:'dnd5e'},user:{id:'gm',isGM:true}};
  const cfg=structuredClone(config);
  cfg.resources=[{id:'mp',label:'MP',link:'buxa',startMax:20}];
  const items=new Map();
  const actor={id:'a',isOwner:true,items,flags:{buxaframework:{resources:{mp:{value:14,max:20}}}},
    getFlag(ns,key){return getPath(this.flags?.[ns],key);},
    async update(values){for(const [path,value]of Object.entries(values))setPath(this,path,value);},
    async deleteEmbeddedDocuments(_kind,ids){for(const id of ids)items.delete(id);}
  };
  const rules={limits:{enabled:true,maxUses:4,recharge:{button:{enabled:true,charges:2,resourceId:'mp',cost:3},
    item:{enabled:true,templateId:'battery',charges:2},combat:{enabled:false}}}};
  const create=(id,rule=rules,quantity=1,origin='')=>{
    const obj={id,documentName:'Item',parent:actor,name:id,type:'loot',img:'icon.png',system:{quantity},
      flags:{buxaframework:{item:rule,itemUsage:{used},itemInstance:{originUuid:origin}}},
      getFlag(ns,key){return getPath(this.flags?.[ns],key);},
      async update(values){for(const [path,value]of Object.entries(values))setPath(this,path,value);}};
    items.set(id,obj);return obj;
  };
  const a=create('a'),b=create('b'),source=create('battery-instance',{},materials,'Item.battery');
  return {actor,a,b,source,cfg};
}
test('two target Items cannot concurrently consume the same recharge material',async()=>{
  const {actor,a,b,source,cfg}=rechargeFixture();
  let release;
  const waiting=new Promise(resolve=>{release=resolve;});
  const original=a.update;
  a.update=async values=>{await waiting;return original.call(a,values);};
  const first=rechargeItem(a,{actor,config:cfg,method:'item',source});
  await assert.rejects(rechargeItem(b,{actor,config:cfg,method:'item',source}),/already in progress/);
  release();await first;
  assert.equal(actor.items.has(source.id),false);
  assert.equal(b.getFlag('buxaframework','itemUsage').used,3);
});
test('World Item templates cannot be treated as owned recharge targets',()=>{
  const {a,source,cfg}=rechargeFixture();
  const fakeTarget={...a,parent:null};const fakeSource={...source,parent:null};
  assert.equal(canRechargeWithItem(fakeSource,fakeTarget,cfg),false);
});
test('a changed resource maximum invalidates payment and rolls back charges',async()=>{
  const {actor,a,cfg}=rechargeFixture();
  const original=a.update;
  a.update=async values=>{await original.call(a,values);actor.flags.buxaframework.resources.mp.max=25;};
  await assert.rejects(rechargeItem(a,{actor,config:cfg}),/maximum changed/);
  assert.equal(a.getFlag('buxaframework','itemUsage').used,3);
  assert.equal(actor.flags.buxaframework.resources.mp.value,14);
});
test('material changing mid-recharge cannot be charged twice',async()=>{
  const {actor,a,source,cfg}=rechargeFixture({materials:2});
  const original=a.update;let changed=false;
  a.update=async values=>{await original.call(a,values);if(!changed){source.system.quantity=1;changed=true;}};
  await assert.rejects(rechargeItem(a,{actor,config:cfg,method:'item',source}),/material changed/);
  assert.equal(a.getFlag('buxaframework','itemUsage').used,3);
  assert.equal(source.system.quantity,1,'external edit is not overwritten');
});
test('recharge reports only visible charges gained after Max Uses is lowered',async()=>{
  const {actor,a,cfg}=rechargeFixture({used:60});
  const result=await rechargeItem(a,{actor,config:cfg});
  assert.equal(result.added,2);
  assert.equal(result.remaining,2);
  assert.equal(a.getFlag('buxaframework','itemUsage').used,2);
});
const {withPhysicalTransaction,acknowledgePhysicalTransaction}=await import('../scripts/core/physical-transaction-ledger.js');
test('transaction IDs that resemble prototype keys are treated as new requests',async()=>{
  const saved=globalThis.game;
  let journal={version:1,records:{}};
  try {
    globalThis.game={settings:{settings:{has:()=>true},get:()=>journal,set:async(_ns,_key,v)=>{journal=structuredClone(v);}},user:{isGM:true}};
    const result=await withPhysicalTransaction({id:'__proto__',userId:'user',payload:{action:'diagnose'}},async()=>({ok:true}));
    assert.equal(result.ok,true);
    assert.ok(Object.hasOwn(journal.records,'__proto__'));
  } finally {globalThis.game=saved;}
});
test('transaction reconciliation cannot acknowledge an inherited object property',async()=>{
  const saved=globalThis.game;
  try {
    globalThis.game={settings:{settings:{has:()=>true},get:()=>({version:1,records:{}})},user:{isGM:true}};
    await assert.rejects(acknowledgePhysicalTransaction('__proto__'),/Unknown physical transfer ID/);
  } finally {globalThis.game=saved;}
});
test('final item use cannot destroy a chest holding other Actor Items',()=>{
  const item={id:'chest',name:'Chest',type:'loot',parent:null,system:{quantity:1},
    flags:{buxaframework:{item:{limits:{enabled:true,maxUses:1,onExhaust:'destroy'}},itemUsage:{used:0}}},
    getFlag(ns,key){return this.flags?.[ns]?.[key];}};
  const actor={id:'owner',isOwner:true,flags:{buxaframework:{inventory:{placements:{coin:{area:'storage',storageId:'chest:bag',index:0}}}}},
    getFlag(ns,key){return this.flags?.[ns]?.[key];}};
  item.parent=actor;
  assert.throws(()=>preflightItemUse(item,actor,config),/Empty this container/);
});
test('last use of an empty consumable container remains allowed',()=>{
  const item={id:'chest',name:'Chest',type:'loot',parent:null,system:{quantity:1},
    flags:{buxaframework:{item:{limits:{enabled:true,maxUses:1,onExhaust:'destroy'}},itemUsage:{used:0}}},
    getFlag(ns,key){return this.flags?.[ns]?.[key];}};
  const actor={id:'owner',isOwner:true,getFlag:()=>({placements:{}})};
  item.parent=actor;
  assert.doesNotThrow(()=>preflightItemUse(item,actor,config));
});

const {registerCombatItemRecharge}=await import('../scripts/integrations/combat-item-recharge.js');
let combatTestId=0;
function combatFixture({itemCount=1,used=5,round=1,turn=0}={}) {
  const handlers={};
  const old={game:globalThis.game,Hooks:globalThis.Hooks};
  const items=[];
  const actor={id:'combat-actor',uuid:'Actor.combat',items};
  for(let i=0;i<itemCount;i++) {
    const item={id:`combat-item-${i}`,parent:actor,type:'loot',system:{quantity:1},
      flags:{buxaframework:{item:{limits:{enabled:true,maxUses:6,recharge:{combat:{enabled:true,everyTurns:1,charges:1}}}},itemUsage:{used}}},
      getFlag(ns,k){return getPath(this.flags?.[ns],k);},
      async update(changes){for(const [path,value]of Object.entries(changes))setPath(this,path,value);}};
    items.push(item);
  }
  const scene={id:`combat-audit-${++combatTestId}`,started:true,round,turn,
    turns:[{actor},{actor:{id:'enemy',items:[]}}],previous:{round,turn},flags:{buxaframework:{}},
    getFlag(ns,k){return getPath(this.flags?.[ns],k);},
    async setFlag(ns,k,v){setPath(this.flags,`${ns}.${k}`,v);}};
  globalThis.game={user:{isGM:true,id:'gm'},users:{activeGM:{id:'gm'}},
    settings:{get:()=>config},system:{id:'dnd5e'}};
  globalThis.Hooks={on:(name,fn)=>{handlers[name]=fn;}};
  registerCombatItemRecharge();
  const tick=async(nextRound,nextTurn,slots=scene.turns.length)=>{
    scene.previous={round:scene.round,turn:scene.turn};
    scene.round=nextRound;scene.turn=nextTurn;
    scene.turns=Array.from({length:slots},(_,i)=>i===0?{actor}:{actor:{id:`enemy-${i}`,items:[]}});
    handlers.updateCombat(scene,{round:nextRound,turn:nextTurn});
    await new Promise(r=>setTimeout(r,20));
  };
  return {items,actor,scene,tick,handlers,restore(){globalThis.game=old.game;globalThis.Hooks=old.Hooks;}};
}
test('rewinding Combat never rewrites an Item recharge high-water cursor backward',async()=>{
  const f=combatFixture();
  try {
    await f.tick(1,1);
    await f.tick(2,0);
    const before=f.items[0].getFlag(MODULE_ID,'combatRecharge');
    await f.tick(1,1);
    assert.deepEqual(f.items[0].getFlag(MODULE_ID,'combatRecharge'),before);
  } finally {f.restore();}
});
test('partial GM save failure does not recharge earlier successful Items twice',async()=>{
  const f=combatFixture({itemCount:2});
  try {
    const original=f.items[1].update;let fail=true;
    f.items[1].update=async changes=>{if(fail){fail=false;throw Error('Foundry save failed');}return original.call(f.items[1],changes);};
    await f.tick(1,1);
    assert.equal(f.items[0].getFlag(MODULE_ID,'itemUsage').used,4);
    assert.equal(f.items[1].getFlag(MODULE_ID,'itemUsage').used,5);
    await f.tick(2,0);
    assert.equal(f.items[0].getFlag(MODULE_ID,'itemUsage').used,3);
    assert.equal(f.items[1].getFlag(MODULE_ID,'itemUsage').used,3);
  } finally {f.restore();}
});
test('changing combatant count does not reset historical high round and grant replay charges',async()=>{
  const f=combatFixture();
  try {
    setPath(f.scene.flags,'buxaframework.rechargeCursor',
      {round:5,turn:1,combatants:2,highRound:5,highTurn:1});
    await f.tick(1,0,3);
    assert.equal(f.scene.getFlag(MODULE_ID,'rechargeCursor').highRound,5);
    assert.equal(f.items[0].getFlag(MODULE_ID,'itemUsage').used,5);
  } finally {f.restore();}
});


test('same-size initiative reorder resets recharge progression instead of granting phantom turns',async()=>{
  const f=combatFixture();
  try {
    await f.tick(1,1);
    const previous=f.items[0].getFlag(MODULE_ID,'itemUsage').used;
    const signature=f.scene.getFlag(MODULE_ID,'rechargeCursor').orderSignature;
    f.scene.turns.reverse();
    f.scene.previous={round:1,turn:1};
    f.scene.round=2;f.scene.turn=0;
    f.handlers.updateCombat(f.scene,{round:2,turn:0});
    await new Promise(resolve=>setTimeout(resolve,25));
    assert.notEqual(f.scene.getFlag(MODULE_ID,'rechargeCursor').orderSignature,signature);
    assert.equal(f.items[0].getFlag(MODULE_ID,'itemUsage').used,previous);
  } finally {f.restore();}
});
