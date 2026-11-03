import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SHEET_CONFIG, MODULE_ID } from '../scripts/core/constants.js';
import { updateResource } from '../scripts/core/resources.js';
import { invalidateSheetConfigCache } from '../scripts/core/config.js';
const get = (obj,path) => String(path).split('.').reduce((v,p)=>v?.[p],obj);
const set = (obj,path,value) => {let ptr=obj;const keys=path.split('.');for(const k of keys.slice(0,-1))ptr=ptr[k]??={};ptr[keys.at(-1)]=value;};
function create() {
  const config=structuredClone(DEFAULT_SHEET_CONFIG);
  const hp=config.resources.find(r=>r.id==='hp');
  const id=hp?.id || config.resources[0].id;
  const resource=config.resources.find(r=>r.id===id);
  resource.link='buxa';resource.syncCurrentOnMax=false;
  const actor={isOwner:true,flags:{[MODULE_ID]:{resources:{[id]:{value:8,max:10}}}},writes:[],
    getFlag(ns,path){return get(this.flags[ns],path);},
    async update(payload){this.writes.push(payload);for(const [key,value] of Object.entries(payload))set(this,key,value);}
  };
  return {config,actor,id};
}
test('editing an unchanged resource does not persist or broadcast a redundant Actor update',async()=>{
  const {config,actor,id}=create();
  const previous={game:globalThis.game,foundry:globalThis.foundry,Hooks:globalThis.Hooks};
  globalThis.foundry={utils:{deepClone:structuredClone,randomID:()=> 'test',getProperty:get,setProperty:set,hasProperty:(o,p)=>get(o,p)!==undefined}};
  globalThis.game={system:{id:'dnd5e'},settings:{get:()=>config},user:{id:'GM',isGM:true}};
  let hooks=0;globalThis.Hooks={callAll:()=>hooks++};
  try{
    invalidateSheetConfigCache();
    const same=await updateResource(actor,id,{current:8});
    assert.deepEqual([same.currentDelta,same.maxDelta],[0,0]);
    assert.equal(actor.writes.length,0);
    assert.equal(hooks,0);
    const changed=await updateResource(actor,id,{current:6});
    assert.equal(changed.currentDelta,-2);
    assert.equal(actor.writes.length,1);
    assert.equal(hooks,1);
    await updateResource(actor,id,{current:6});
    assert.equal(actor.writes.length,1);
  }finally{
    invalidateSheetConfigCache();
    Object.assign(globalThis,previous);
  }
});
