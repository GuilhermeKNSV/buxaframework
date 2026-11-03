import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getLinkedUserIds, setLinkedUsers } from '../scripts/core/permissions.js';
import { nearestLinkedToken, canInteractPhysical } from '../scripts/core/physical-items.js';
import { bindPhysicalItemPointer } from '../scripts/integrations/physical-item-pointer.js';
const read = p => readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const scene={grid:{size:100,distance:5}};
const tokens=[{actorId:'a',x:0,y:0,width:1,height:1,hidden:false}];
const item={id:'drop',x:50,y:50,size:70};

test('GM implicit document ownership does not make them linked, but an explicit GM link is valid',async()=>{
  const before=Object.fromEntries(['game','CONST','Hooks'].map(k=>[k,globalThis[k]]));
  const gm={id:'gm',isGM:true},player={id:'player',isGM:false};
  const users=[gm,player];users.get=id=>users.find(u=>u.id===id);
  let flag=null;
  const actor={id:'a',ownership:{default:0,gm:3,player:3},getFlag(ns,key){return key==='linkedUsers'?flag:null;},async update(patch){flag=patch['flags.buxaframework.linkedUsers'];this.ownership=patch.ownership;}};
  globalThis.game={user:gm,users};globalThis.CONST={DOCUMENT_OWNERSHIP_LEVELS:{OWNER:3,NONE:0}};globalThis.Hooks={callAll(){}};
  try {
    assert.deepEqual(getLinkedUserIds(actor),[],'native ownership must not create loot links');
    assert.equal(nearestLinkedToken(gm,scene,item,[actor],tokens),null);
    assert.equal(await setLinkedUsers(actor,['gm','player']),true);
    assert.deepEqual(getLinkedUserIds(actor),['gm','player']);
    assert.equal(nearestLinkedToken(gm,scene,item,[actor],tokens)?.actorId,'a');
    assert.equal(canInteractPhysical({user:gm,scene,item,actors:[actor],tokens,settings:{lootDistance:10},operation:'loot'}).allowed,true);
    assert.equal(actor.ownership.player,3);
    assert.equal(actor.ownership.gm,3);
    await setLinkedUsers(actor,[]);
    assert.equal(nearestLinkedToken(gm,scene,item,[actor],tokens),null);
  } finally{for(const [key,val] of Object.entries(before))if(val===undefined)delete globalThis[key];else globalThis[key]=val;}
});

test('canvas movement captures DOM pointer outside sprite and commits a zoom-correct position',async()=>{
  const before=Object.fromEntries(['window','canvas'].map(k=>[k,globalThis[k]]));
  const listeners=new Map();
  const window={addEventListener(name,cb){listeners.set(name,cb);},removeEventListener(name,cb){if(listeners.get(name)===cb)listeners.delete(name);}};
  globalThis.window=window;
  globalThis.canvas={app:{renderer:{events:{mapPositionToPoint(p,x,y){p.x=x/2;p.y=y/2;}}}}};
  const sprite={events:{},on(name,cb){this.events[name]=cb;},cursor:'grab'};
  const root={toLocal:p=>p};
  const parent={parent:root,x:10,y:20,position:{set(x,y){parent.x=x;parent.y=y;}}};
  let committed=null;let warnings=[];
  try{
    bindPhysicalItemPointer(sprite,parent,{allow:()=>({allowed:true}),commit:async point=>{committed=point;},warn:message=>warnings.push(message)});
    sprite.events.pointerdown({button:0,pointerId:7,global:{x:50,y:50},stopPropagation(){}});
    assert.equal(listeners.has('pointermove'),true);
    listeners.get('pointermove')({pointerId:7,clientX:180,clientY:140,preventDefault(){},stopPropagation(){}});
    assert.deepEqual([parent.x,parent.y],[50,40]);
    listeners.get('pointerup')({pointerId:7,clientX:180,clientY:140,preventDefault(){},stopPropagation(){}});
    await new Promise(setImmediate);
    assert.deepEqual(committed,{x:50,y:40});
    assert.equal(listeners.size,0);
    assert.equal(parent._buxaDragging,false);
    assert.deepEqual(warnings,[]);
  }finally{for(const [key,val] of Object.entries(before))if(val===undefined)delete globalThis[key];else globalThis[key]=val;}
});

test('drag rejection restores the original item position and warns through Buxa',async()=>{
  const before=Object.fromEntries(['window','canvas'].map(k=>[k,globalThis[k]]));
  const listeners=new Map();
  globalThis.window={addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name);}};
  globalThis.canvas={app:{renderer:{events:{mapPositionToPoint(p,x,y){p.x=x;p.y=y;}}}}};
  const sprite={events:{},on(name,cb){this.events[name]=cb;}};
  const parent={x:30,y:30,parent:{toLocal:p=>p},position:{set(x,y){parent.x=x;parent.y=y;}}};
  const warnings=[];
  try {
    bindPhysicalItemPointer(sprite,parent,{allow:()=>({allowed:true}),commit:async()=>{throw Error('Out of range');},warn:m=>warnings.push(m)});
    sprite.events.pointerdown({button:0,pointerId:1,global:{x:10,y:10}});
    listeners.get('pointermove')({pointerId:1,clientX:60,clientY:60});
    assert.deepEqual([parent.x,parent.y],[80,80]);
    listeners.get('pointerup')({pointerId:1,clientX:60,clientY:60});
    await new Promise(setImmediate);
    assert.deepEqual([parent.x,parent.y],[30,30]);
    assert.deepEqual(warnings,['Out of range']);
  }finally{for(const [key,val] of Object.entries(before))if(val===undefined)delete globalThis[key];else globalThis[key]=val;}
});

test('physical item actions use Buxa toasts, not Foundry native notification bars',()=>{
  for(const file of ['scripts/integrations/physical-item-canvas.js','scripts/apps/physical-item-ui.js','scripts/apps/gm-physical-panel.js']) {
    const content=read(file);
    assert.doesNotMatch(content,/ui\.notifications/);
    assert.match(content,/notify(Warning|Success|Error)/);
  }
  assert.match(read('scripts/apps/player-settings.js'),/isGM: u\.isGM/);
  assert.match(read('templates/player-settings.hbs'),/data-link-user/);
});
