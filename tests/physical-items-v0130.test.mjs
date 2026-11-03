import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizePhysicalSettings, nearestLinkedToken, canInteractPhysical, validDropQuantity,
  scenePhysicalItems, physicalDistanceFt, toPhysicalItem } from '../scripts/core/physical-items.js';

const scene={grid:{size:100,distance:5},width:1000,height:800};
const user={id:'player-1',isGM:false};
const gm={id:'gm',isGM:true};
const actors=[{id:'a',getFlag:(ns,key)=>key==='linkedUsers'?['player-1']:null},
  {id:'b',getFlag:(ns,key)=>key==='linkedUsers'?['player-2']:null}];
const tokens=[{actorId:'a',x:100,y:100,width:1,height:1,hidden:false},
  {actorId:'b',x:800,y:400,width:1,height:1,hidden:false}];
const item={id:'a1',x:200,y:100,size:76};

test('scene physical policies clamp distances, default to GM-only movement',()=>{
  assert.deepEqual(normalizePhysicalSettings({lootDistance:-4,moveDistance:Infinity,maxMoveDistance:99999}),{
    lootEnabled:true,lootDistance:0,playerMoveEnabled:false,moveDistance:10,maxMoveDistance:10000,
    playerDropRangeEnabled:false,dropDistance:10,showDropRangeOutline:true,visualMode:'beam',alwaysShowLoot:false,gmItemView:true
  });
  assert.equal(normalizePhysicalSettings({playerMoveEnabled:1}).playerMoveEnabled,false);
  assert.equal(validDropQuantity(2,5),true);
  for(const n of [0,-1,2.1,6,NaN]) assert.equal(validDropQuantity(n,5),false);
});
test('explicit Actor links, not implicit GM ownership, determine loot destination',()=>{
  assert.equal(nearestLinkedToken(user,scene,item,actors,tokens)?.actorId,'a');
  assert.equal(nearestLinkedToken(gm,scene,item,actors,tokens),null);
  assert.equal(nearestLinkedToken({id:'not-linked'},scene,item,actors,tokens),null);
});
test('range and movement validation use scene grid feet, linked live token and configured rules',()=>{
  const settings={lootDistance:6,playerMoveEnabled:true,moveDistance:6,maxMoveDistance:5};
  assert.equal(physicalDistanceFt({x:0,y:0},{x:300,y:0},scene),15);
  assert.equal(canInteractPhysical({user,scene,item,actors,tokens,settings,operation:'loot'}).allowed,true);
  assert.equal(canInteractPhysical({user,scene,item,actors,tokens,settings:{...settings,lootDistance:1},operation:'loot'}).allowed,false);
  assert.equal(canInteractPhysical({user,scene,item,actors,tokens,settings:{...settings,lootEnabled:false},operation:'loot'}).allowed,false);
  assert.equal(canInteractPhysical({user,scene,item,actors,tokens,settings,operation:'move',destination:{x:400,y:100}}).allowed,false);
  assert.equal(canInteractPhysical({user,scene,item,actors,tokens,settings,operation:'move',destination:{x:260,y:100}}).allowed,true);
  assert.equal(canInteractPhysical({user:gm,scene,item,actors,tokens,settings:{playerMoveEnabled:false},operation:'move',destination:{x:400,y:100}}).allowed,true);
});
test('scene records persist plain Item snapshot and copied quantities without embedding document identity',()=>{
  const source={toObject:()=>({_id:'old',name:'Sword',type:'loot',img:'sword.png',system:{quantity:9,equipped:true},flags:{buxaframework:{item:{rarityId:'epic'}}}})};
  const dropped=toPhysicalItem(source,3,{x:72,y:117},75,'world-1');
  assert.equal(dropped.data._id,undefined);
  assert.equal(dropped.data.system.quantity,3);
  assert.equal(dropped.data.system.equipped,false);
  assert.equal(dropped.data.flags.buxaframework.item.rarityId,'epic');
  assert.deepEqual(scenePhysicalItems({flags:{buxaframework:{physicalItems:[dropped,{id:'bad',x:NaN,y:0}]}}}),[dropped]);
});
test('native drag and sheet pointer drop are wired to board actions; socket manifest enabled',()=>{
  const base=new URL('../',import.meta.url);
  const read=p=>readFileSync(new URL(p,base),'utf8');
  assert.equal(JSON.parse(read('module.json')).socket,true);
  assert.match(read('scripts/apps/inventory-controls.js'),/dropInventoryItemOnBoard/);
  assert.match(read('scripts/integrations/physical-item-canvas.js'),/addChild\(container\)/);
  assert.match(read('scripts/integrations/physical-item-canvas.js'),/document\.addEventListener\('drop'/);
  assert.match(read('scripts/integrations/physical-item-transfers.js'),/scenePhysicalItems\(scene\)/);
});
