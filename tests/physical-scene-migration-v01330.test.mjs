import test from 'node:test';
import assert from 'node:assert/strict';
import {migratePhysicalScenes} from '../scripts/core/physical-scene-migration.js';
import {PHYSICAL_SCENE_STORE,scenePhysicalItems} from '../scripts/core/physical-items.js';
const record=id=>({id,x:20,y:15,data:{name:id},size:60});
const scene=(id,legacy=[])=>({id, name:id, getFlag:()=>legacy});
test('GM dry run and per-scene migration preserve the original world aggregate as a backup',async()=>{
 const prior=globalThis.game,settings=new Map(),values=new Map([[PHYSICAL_SCENE_STORE,{one:[record('old')]}]]);
 const one=scene('one'),two=scene('two',[record('local')]);
 globalThis.game={user:{isGM:true},scenes:{contents:[one,two]},settings:{settings,
 register(ns,key,cfg){settings.set(`${ns}.${key}`,cfg);},
 get(ns,key){return structuredClone(values.has(key)?values.get(key):settings.get(`${ns}.${key}`)?.default);},
 async set(ns,key,data){values.set(key,structuredClone(data));return data;}}};
 try {
  const preview=await migratePhysicalScenes();assert.equal(preview.scenes.length,2);
  assert.equal(preview.migrated,0);assert.deepEqual(values.get(PHYSICAL_SCENE_STORE).one.map(e=>e.id),['old']);
  const actual=await migratePhysicalScenes({dryRun:false});assert.equal(actual.migrated,2);
  assert.deepEqual(scenePhysicalItems(one).map(e=>e.id),['old']);
  assert.deepEqual(scenePhysicalItems(two).map(e=>e.id),['local']);
  assert.equal((await migratePhysicalScenes({dryRun:false})).skipped,2);
  assert.deepEqual(values.get(PHYSICAL_SCENE_STORE).one.map(e=>e.id),['old']);
 }finally{if(prior===undefined)delete globalThis.game;else globalThis.game=prior;}
});
