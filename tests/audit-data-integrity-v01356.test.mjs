import test from 'node:test';
import assert from 'node:assert/strict';
import {writePhysical} from '../scripts/integrations/physical-item-transfers.js';
import {scenePhysicalItems, PHYSICAL_SCENE_STORE, assertPhysicalSceneRecordsWritable} from '../scripts/core/physical-items.js';
import {makeStack} from '../scripts/core/stack-native-import.js';

const clean={id:'good',x:10,y:10,data:{name:'Crate',system:{quantity:1}}};
function scene(id='a',legacy=[]) {
  return {id,flags:{buxaframework:{physicalItems:legacy}},
    getFlag(scope,key){return this.flags?.[scope]?.[key]}};
}
async function withMockGame(store,callback) {
  const original=globalThis.game;
  let writes=0;
  globalThis.game={user:{isGM:true},settings:{
    get:(ns,key)=>key===PHYSICAL_SCENE_STORE?store:null,
    async set(ns,key,value){writes++;store=structuredClone(value);return value;}
  }};
  try{return await callback(()=>writes,()=>store)}
  finally{if(original===undefined)delete globalThis.game;else globalThis.game=original;}
}

test('malformed but saved Scene items cannot be silently dropped on the next write',async()=>{
  for(const bad of [{id:'invisible',x:NaN,y:0,data:{name:'lost'}},
    {id:'good',x:30,y:20,data:{name:'duplicate'}},
    {id:'no-item',x:30,y:20,data:null}]) {
    const saved=[structuredClone(clean),bad];
    await withMockGame({a:saved},async(writes,read)=>{
      const current=scene('a');
      assert.equal(scenePhysicalItems(current).length,bad.id==='good'?2:1,'canvas may filter invalid records');
      assert.throws(()=>assertPhysicalSceneRecordsWritable(current),/malformed or duplicate/);
      await assert.rejects(writePhysical(current,[...scenePhysicalItems(current),{id:'new',x:1,y:1,data:{}}]),/malformed or duplicate/);
      assert.equal(writes(),0);
      assert.deepEqual(read().a,saved,'original records must stay intact');
    });
  }
});

test('corrupt legacy Scene and invalid aggregate both fail closed; repaired scenes remain writable',async()=>{
  await withMockGame({},async(writes)=>{
    const old=scene('old',[clean,{id:'broken',x:null,y:4,data:{name:'recover me'}}]);
    await assert.rejects(writePhysical(old,[...scenePhysicalItems(old),{id:'new',x:1,y:2,data:{}}]),/malformed/);
    assert.equal(writes(),0);
  });
  await withMockGame({a:'not-an-array'},async(writes)=>{
    await assert.rejects(writePhysical(scene(),[{id:'new',x:1,y:2,data:{}}]),/invalid physical item records/);
    assert.equal(writes(),0);
  });
  await withMockGame({a:[clean]},async(writes)=>{
    await writePhysical(scene(),[clean,{id:'new',x:1,y:2,data:{}}]);
    assert.equal(writes(),1);
  });
});

function actorForPostCreateError({cleanupFails=false,afterDeleteThrows=false}={}) {
  const stored=new Map([['existing',{id:'existing',flags:{buxaframework:{itemInstance:{instanceId:'same'}}}}]]);
  let deletions=0;
  const items={get:id=>stored.get(id),[Symbol.iterator]:()=>stored.values()};
  const actor={items,
    async createEmbeddedDocuments(_type,[chunk],options) {
      options.parent={invalid:'mutated by Foundry'};
      stored.set('new123',{id:'new123',flags:structuredClone(chunk.flags),
        getFlag:(scope,key)=>chunk.flags?.[scope]?.[key]});
      throw Error('post-create Foundry hook failure');
    },
    async deleteEmbeddedDocuments(_type,ids,options) {
      deletions++;
      assert.equal(options.parent,undefined,'no options contamination from create');
      if(!cleanupFails)for(const id of ids)stored.delete(id);
      if(cleanupFails || afterDeleteThrows)throw Error('cleanup hook error');
    }};
  return {actor,stored,deleted:()=>deletions};
}
const chunk={name:'Arrows',system:{quantity:10},flags:{buxaframework:{itemInstance:{instanceId:'same'}}}};

test('a failed post-create Item hook removes ONLY the new stack; retries cannot duplicate it',async()=>{
  const {actor,stored,deleted}=actorForPostCreateError();
  await assert.rejects(makeStack(actor,chunk,null,{}),/post-create Foundry hook failure/);
  assert.equal(deleted(),1);
  assert.equal(stored.has('new123'),false);
  assert.equal(stored.has('existing'),true,'pre-existing similar stacks must never be deleted');
});

test('stack cleanup errors after successful deletion are checked against actual persistence',async()=>{
  const done=actorForPostCreateError({afterDeleteThrows:true});
  await assert.rejects(makeStack(done.actor,chunk,null,{}),/post-create Foundry hook failure/);
  assert.equal(done.stored.has('new123'),false);
  const failed=actorForPostCreateError({cleanupFails:true});
  await assert.rejects(makeStack(failed.actor,chunk,null,{}),/cleanup also failed/);
  assert.equal(failed.stored.has('new123'),true,'item needs manual reconciliation');
});


test('invalid incoming Scene records are rejected before they can corrupt a good world setting',async()=>{
  await withMockGame({a:[clean]},async(writes,read)=>{
    for(const invalid of [{id:'bad',x:Infinity,y:1,data:{}},
      {id:'bad',x:2,y:null,data:{}},{id:'bad',x:1,y:2,data:null}]) {
      await assert.rejects(writePhysical(scene(),[clean,invalid]),/Invalid physical Item position or data/);
    }
    assert.equal(writes(),0);
    assert.deepEqual(read().a,[clean]);
  });
});
