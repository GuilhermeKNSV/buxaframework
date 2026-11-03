import test from 'node:test';
import assert from 'node:assert/strict';
import { writePhysical } from '../scripts/integrations/physical-item-transfers.js';
import { scenePhysicalItems, PHYSICAL_SCENE_STORE } from '../scripts/core/physical-items.js';

const originalGame=()=>globalThis.game;

test('physical writes persist in world settings without ANY Scene document API, including legacy migration',async()=>{
  const before=originalGame();
  const scene={id:'scene-1',documentName:'Scene',flags:{buxaframework:{physicalItems:[{id:'old',x:5,y:10,data:{name:'Potion'}}]}},
    getFlag(scope,key){return this.flags[scope][key]},
    update(){throw Error('Scene.update forbidden')},
    constructor:{documentName:'Scene',updateDocuments(){throw Error('Scene.updateDocuments forbidden')}}};
  let value={};
  const writes=[];
  try {
    globalThis.game={user:{isGM:true},settings:{
      get:(_ns,key)=>key===PHYSICAL_SCENE_STORE?value:null,
      async set(_ns,key,next){assert.equal(key,PHYSICAL_SCENE_STORE);writes.push(structuredClone(next));value=structuredClone(next);return next;}
    }};
    assert.equal(scenePhysicalItems(scene).length,1,'old Scene flags readable until first mutation');
    await writePhysical(scene,[...scenePhysicalItems(scene),{id:'new',x:40,y:50,data:{name:'Sword'}}]);
    assert.deepEqual(scenePhysicalItems(scene).map(e=>e.id),['old','new']);
    await writePhysical(scene,[]);
    assert.deepEqual(scenePhysicalItems(scene),[],'empty world store overrides stale Scene flags');
    assert.equal(writes.length,2);
    assert.equal(scene.flags.buxaframework.physicalItems.length,1,'legacy data left untouched');
  }finally{if(before===undefined)delete globalThis.game;else globalThis.game=before;}
});

test('world setting failure never falls back to a risky Scene update',async()=>{
  const before=originalGame();
  let sceneCalls=0;
  try {
    globalThis.game={user:{isGM:true},settings:{get:()=>({}),set:async()=>{throw Error('Setting unavailable');}}};
    await assert.rejects(writePhysical({id:'scene',update:()=>{sceneCalls++;}},[]),/Setting unavailable/);
    assert.equal(sceneCalls,0);
  }finally{if(before===undefined)delete globalThis.game;else globalThis.game=before;}
});

test('missing confirmed world-setting state blocks inventory source mutation',async()=>{
  const before=originalGame();
  try {
    globalThis.game={user:{isGM:true},settings:{get:()=>({}),set:async()=>({})}};
    await assert.rejects(writePhysical({id:'scene'},[]),/did not confirm/);
  }finally{if(before===undefined)delete globalThis.game;else globalThis.game=before;}
});
