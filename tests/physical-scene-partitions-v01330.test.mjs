import test from 'node:test';
import assert from 'node:assert/strict';
import { MODULE_ID } from '../scripts/core/constants.js';
import { PHYSICAL_SCENE_STORE,scenePhysicalItems } from '../scripts/core/physical-items.js';
import {scenePartitionKey} from '../scripts/core/physical-scene-partitions.js';
import {writePhysical} from '../scripts/integrations/physical-item-transfers.js';
const record=id=>({id,x:20,y:30,size:70,data:{name:id},quantity:1});
const scene=(id,older=[])=>({id,flags:{buxaframework:{physicalItems:older}},getFlag(ns,key){return this.flags?.[ns]?.[key]}});
test('per-scene setting migration preserves old world and Scene flags and isolated writes',async()=>{
 const old={game:globalThis.game,Hooks:globalThis.Hooks};
 const a=scene('a',[record('legacy-scene')]),b=scene('b',[record('legacy-other')]);
 const registered=new Map(),saved=new Map([[PHYSICAL_SCENE_STORE,{a:[record('legacy-world')]}]]);
 const writes=[],hooks=[];
 globalThis.Hooks={callAll:(...args)=>hooks.push(args)};
 globalThis.game={user:{isGM:true},settings:{settings:registered,
  register(ns,key,opts){registered.set(`${ns}.${key}`,opts);},
  get(ns,key){const defaults=registered.get(`${ns}.${key}`)?.default;return structuredClone(saved.has(key)?saved.get(key):defaults);},
  async set(ns,key,val){writes.push(key);saved.set(key,structuredClone(val));registered.get(`${ns}.${key}`)?.onChange?.();return val;}
 }};
 try {
  assert.deepEqual(scenePhysicalItems(a).map(x=>x.id),['legacy-world']);
  assert.deepEqual(scenePhysicalItems(b).map(x=>x.id),['legacy-other']);
  await writePhysical(a,[record('new-a')]);
  assert.deepEqual(writes,[scenePartitionKey('a')]);
  assert.deepEqual(scenePhysicalItems(a).map(x=>x.id),['new-a']);
  assert.deepEqual(scenePhysicalItems(b).map(x=>x.id),['legacy-other']);
  await writePhysical(b,[]);
  assert.deepEqual(scenePhysicalItems(b),[]);
  assert.deepEqual(saved.get(PHYSICAL_SCENE_STORE).a.map(x=>x.id),['legacy-world']);
  assert.ok(hooks.some(x=>x[0]==='buxaPhysicalSceneItemsChanged'&&x[1]==='a'));
  assert.deepEqual(writes,[scenePartitionKey('a'),scenePartitionKey('b')]);
 } finally {for (const [k,v] of Object.entries(old)) if(v===undefined)delete globalThis[k];else globalThis[k]=v;}
});
test('failed partition confirmation keeps existing scene items and fails closed',async()=>{
 const prior=globalThis.game;const registered=new Map();const saved=new Map([[PHYSICAL_SCENE_STORE,{}]]);
 globalThis.game={user:{isGM:true},settings:{settings:registered,
 register(ns,key,config){registered.set(`${ns}.${key}`,config);},
 get(ns,key){return structuredClone(saved.get(key)??registered.get(`${ns}.${key}`)?.default);},
 async set(ns,key,value){if(key!==scenePartitionKey('s'))throw Error('aggregate used');return value;}
 }};
 try {await assert.rejects(writePhysical(scene('s',[record('original')]),[record('next')]),/did not confirm/);
  assert.deepEqual(scenePhysicalItems(scene('s',[record('original')])).map(x=>x.id),['original']);
 } finally {if(prior===undefined)delete globalThis.game;else globalThis.game=prior;}
});
