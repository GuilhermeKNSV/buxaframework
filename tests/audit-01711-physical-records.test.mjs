import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validPhysicalSceneRecord,scenePhysicalItems,diagnosePhysicalSceneItems,assertPhysicalSceneRecordsWritable
} from '../scripts/core/physical-items.js';

const good = {id:'item-1',x:100,y:200,data:{name:'Coin'}};
for(const [reason, record] of [
  ['null X',{...good,x:null}],['empty X',{...good,x:''}],['whitespace X',{...good,x:'  '}],
  ['boolean X',{...good,x:false}],['not-a-number Y',{...good,y:'nope'}],
  ['array Item data',{...good,data:[]}],['numeric ID',{...good,id:123}],
  ['missing Item data',{...good,data:null}]
]) {
  test(`scene Item records reject ${reason} consistently`,()=>{
    assert.equal(validPhysicalSceneRecord(record),false);
    assert.equal(validPhysicalSceneRecord(good),true);
  });
}

test('scene display omits corrupt entries without allowing the same data to overwrite the world store',()=>{
  const old=globalThis.game;
  const records=[good,{...good,id:'broken',x:''}];
  try {
    globalThis.game={settings:{get:()=>({scene1:records})}};
    const scene={id:'scene1'};
    assert.deepEqual(scenePhysicalItems(scene),[good]);
    assert.deepEqual(diagnosePhysicalSceneItems(scene).invalidIndices,[1]);
    assert.throws(()=>assertPhysicalSceneRecordsWritable(scene),/Nothing was overwritten/);
  } finally {globalThis.game=old;}
});


test('numeric-string scene coordinates are supported without coercing arrays, hex, and objects to zero',()=>{
  const valid={id:'record-1',data:{name:'Coin'},x:' -1.25 ',y:'2e2'};
  assert.equal(validPhysicalSceneRecord(valid),true);
  for (const invalid of [[],{},['4'],false,true,'0x0','0b1','Infinity','1,5']) {
    assert.equal(validPhysicalSceneRecord({...valid,x:invalid}),false,`invalid x ${String(invalid)}`);
  }
});
