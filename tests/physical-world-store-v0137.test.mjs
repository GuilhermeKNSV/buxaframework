import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MODULE_ID } from '../scripts/core/constants.js';
import { PHYSICAL_SCENE_STORE, scenePhysicalItems, physicalSceneStore } from '../scripts/core/physical-items.js';
import { writePhysical } from '../scripts/integrations/physical-item-transfers.js';

const oldGame=()=>globalThis.game;
const record=(id)=>({id,x:5,y:9,size:70,quantity:1,data:{name:id}});
const scene=(id,legacy=[])=>({id,documentName:'Scene',parent:null,
  flags:{buxaframework:{physicalItems:legacy}},getFlag(ns,key){return this.flags[ns][key]},
  update(){throw Error('Never update the Scene Document');},
  constructor:{updateDocuments(){throw Error('Never update Scene Documents');}}});

test('physical ground storage is registered as an onChange world setting',()=>{
  const main=readFileSync(new URL('../scripts/main.js',import.meta.url),'utf8');
  const settings=readFileSync(new URL('../scripts/integrations/physical-item-settings.js',import.meta.url),'utf8');
  const canvas=readFileSync(new URL('../scripts/integrations/physical-item-canvas.js',import.meta.url),'utf8');
  assert.match(main,/registerPhysicalItemSettings\(\)/);
  assert.match(settings,/game\.settings\.register\(MODULE_ID, PHYSICAL_SCENE_STORE/);
  assert.match(settings,/scope: 'world'/);
  assert.match(settings,/buxaPhysicalSceneItemsChanged/);
  assert.match(canvas,/Hooks\.on\('buxaPhysicalSceneItemsChanged',refreshPhysicalCanvas\)/);
});

test('world store keeps scenes isolated, migrates old flags once, and retains empty deletions across reload',async()=>{
  const prior=oldGame();
  const a=scene('a',[record('ancient')]);
  const b=scene('b',[record('other')]);
  let stored={};
  try {
    globalThis.game={user:{isGM:true},settings:{
      get:(ns,key)=>{assert.equal(ns,MODULE_ID);assert.equal(key,PHYSICAL_SCENE_STORE);return structuredClone(stored);},
      async set(ns,key,value){assert.equal(key,PHYSICAL_SCENE_STORE);stored=structuredClone(value);return structuredClone(value);}
    }};
    assert.deepEqual(scenePhysicalItems(a).map(i=>i.id),['ancient']);
    assert.deepEqual(scenePhysicalItems(b).map(i=>i.id),['other']);
    await writePhysical(a,[...scenePhysicalItems(a),record('new')]);
    assert.deepEqual(scenePhysicalItems(a).map(i=>i.id),['ancient','new']);
    assert.deepEqual(scenePhysicalItems(b).map(i=>i.id),['other']);
    await writePhysical(b,[...scenePhysicalItems(b),record('second')]);
    assert.deepEqual(physicalSceneStore().b.map(i=>i.id),['other','second']);
    await writePhysical(a,[]);
    assert.deepEqual(scenePhysicalItems(scene('a',[record('ancient')])),[]);
    assert.deepEqual(scenePhysicalItems(scene('b',[record('other')])).map(i=>i.id),['other','second']);
  } finally {if(prior===undefined)delete globalThis.game;else globalThis.game=prior;}
});

test('unconfirmed write cannot authorize removal of inventory item',async()=>{
  const prior=oldGame();
  try {
    globalThis.game={user:{isGM:true},settings:{get:()=>({}),set:async()=>undefined}};
    await assert.rejects(writePhysical(scene('a'),[record('x')]),/did not confirm/);
  } finally {if(prior===undefined)delete globalThis.game;else globalThis.game=prior;}
});

test('world setting broadcast schedules canvas refresh across clients',async()=>{
  const prior=oldGame(), oldHooks=globalThis.Hooks;
  const registered=new Map(), events=[];
  try {
    globalThis.game={settings:{register:(scope,key,config)=>registered.set(key,config)}};
    globalThis.Hooks={callAll:(event)=>events.push(event)};
    const {registerPhysicalItemSettings}=await import('../scripts/integrations/physical-item-settings.js');
    registerPhysicalItemSettings();
    const store=registered.get(PHYSICAL_SCENE_STORE);
    assert.equal(store.scope,'world');
    assert.equal(store.type,Object);
    assert.deepEqual(store.default,{});
    store.onChange();
    assert.deepEqual(events,['buxaPhysicalSceneItemsChanged']);
  } finally {
    if(prior===undefined)delete globalThis.game;else globalThis.game=prior;
    if(oldHooks===undefined)delete globalThis.Hooks;else globalThis.Hooks=oldHooks;
  }
});
