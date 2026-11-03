import test from 'node:test';
import assert from 'node:assert/strict';
import {MODULE_ID,DEFAULT_SHEET_CONFIG} from '../scripts/core/constants.js';
import {PHYSICAL_TRANSACTION_LEDGER,readPhysicalLedger,withPhysicalTransaction,transferStatus,acknowledgePhysicalTransaction} from '../scripts/core/physical-transaction-ledger.js';
import {restoreBackpackContents} from '../scripts/core/backpack-transfers.js';
import {groundContentBranch} from '../scripts/core/ground-container.js';
import {diagnosePhysicalSceneItems,PHYSICAL_SCENE_STORE,physicalSceneStore} from '../scripts/core/physical-items.js';
const previous=(...keys)=>Object.fromEntries(keys.map(key=>[key,globalThis[key]]));
const restore=prev=>{for(const [key,value] of Object.entries(prev))if(value===undefined)delete globalThis[key];else globalThis[key]=value;};

test('journal persists a successful result and never reruns a duplicate request',async()=>{
  const old=previous('game');let stored={version:1,records:{}};let calls=0;
  try {
    globalThis.game={settings:{settings:new Map([[`${MODULE_ID}.${PHYSICAL_TRANSACTION_LEDGER}`,true]]),
      get:()=>structuredClone(stored),async set(ns,key,value){assert.equal(key,PHYSICAL_TRANSACTION_LEDGER);stored=structuredClone(value);}}};
    const payload={action:'drop',sceneId:'s',itemId:'sword'};
    const request={id:'transfer-1',userId:'hero',payload};
    assert.deepEqual(await withPhysicalTransaction(request,async()=>{calls++;return {itemId:'a'};}),{itemId:'a'});
    assert.deepEqual(await withPhysicalTransaction(request,async()=>{calls++;return {itemId:'b'};}),{itemId:'a'});
    assert.equal(calls,1);
    assert.equal(transferStatus('transfer-1','hero').status,'done');
    assert.equal(transferStatus('transfer-1','other'),null);
    await assert.rejects(withPhysicalTransaction({...request,payload:{...payload,itemId:'other'}},async()=>{}),/different operation/);
  }finally{restore(old);}
});

test('an interrupted journal record blocks retries across GM handover',async()=>{
  const old=previous('game');let stored={version:1,records:{}};
  try {
    globalThis.game={settings:{settings:new Map([[`${MODULE_ID}.${PHYSICAL_TRANSACTION_LEDGER}`,true]]),
      get:()=>structuredClone(stored),async set(ns,key,value){stored=structuredClone(value);}}};
    const request={id:'transfer-2',userId:'hero',payload:{action:'loot',sceneId:'s',itemId:'a'}};
    await assert.rejects(withPhysicalTransaction(request,async()=>{throw Error('post-commit hook failed');}),/post-commit/);
    assert.equal(readPhysicalLedger().records['transfer-2'].status,'needs-review');
    await assert.rejects(withPhysicalTransaction(request,async()=>{throw Error('MUST NOT EXECUTE');}),/reconcile|interruption/);
  }finally{restore(old);}
});

test('backpack rollback does not delete an unrelated item created concurrently',async()=>{
  const old=previous('foundry');let next=0;
  globalThis.foundry={utils:{randomID:()=>`unique-${++next}`}};
  const items=new (class extends Map {[Symbol.iterator](){return this.values();}})();
  const storageRules={storage:{slots:{external:[{id:'main',columns:2,rows:2,mode:'simple'}]}}};
  const root={id:'root',name:'Backpack',flags:{[MODULE_ID]:{item:storageRules}},
    getFlag(scope,key){return this.flags?.[scope]?.[key];}};
  items.set('root',root);
  const config=structuredClone(DEFAULT_SHEET_CONFIG);
  config.inventory.mode='complex';
  config.inventory.complex={columns:6,rows:5,activeCells:30,autoSort:false};
  let inventory={version:4,tracked:['root'],placements:{root:{area:'inventory',index:0}},autoSort:false};
  const concurrent={id:'other',name:'Concurrent Item',flags:{[MODULE_ID]:{itemInstance:{instanceId:'from-another-operation'}}}};
  const actor={id:'hero',items,getFlag:(scope,key)=>key==='inventory'?inventory:null,
    async update(patch){inventory=structuredClone(patch[`flags.${MODULE_ID}.inventory`]);return this;},
    async createEmbeddedDocuments(type,docs){
      const first=docs[0];
      items.set('created',{id:'created',name:first.name,flags:structuredClone(first.flags)});
      items.set('other',concurrent);
      throw Error('hook failed after document creation');
    },
    async deleteEmbeddedDocuments(type,ids){for(const id of ids)items.delete(id);return ids;}
  };
  try {
    await assert.rejects(restoreBackpackContents(actor,'root',[{sourceId:'child',providerId:'root',
      compartmentId:'main',index:0,rotation:0,data:{name:'Gem',system:{},flags:{}}}],config),/hook failed/);
    assert.equal(items.has('created'),false);
    assert.equal(items.get('other'),concurrent);
  }finally{restore(old);}
});

test('nested branch lookup finds every descendant exactly once regardless of order',()=>{
  const contents=[{sourceId:'leaf',providerId:'mid'},{sourceId:'sibling',providerId:'root'},
    {sourceId:'mid',providerId:'top'},{sourceId:'top',providerId:'root'},
    {sourceId:'second',providerId:'top'}];
  assert.deepEqual(groundContentBranch(contents,'top').map(e=>e.sourceId),['leaf','mid','top','second']);
});

test('GM diagnostics report duplicate and malformed IDs without altering records',()=>{
  const old=previous('game');const records=[{id:'x',data:{},x:0,y:0},
    {id:'x',data:{},x:1,y:1},{id:'bad',data:{},x:'none',y:2}];
  globalThis.game={settings:{get:()=>({s:records})}};
  try{
    assert.deepEqual(diagnosePhysicalSceneItems({id:'s'}),{sceneId:'s',readable:true,duplicateIds:['x'],invalidIndices:[2],recordCount:3});
    assert.equal(records.length,3);
  }finally{restore(old);}
});

test('registered world-store read failure is surfaced instead of showing an empty scene',()=>{
  const old=previous('game');globalThis.game={settings:{settings:new Map([[`${MODULE_ID}.${PHYSICAL_SCENE_STORE}`,true]]),
    get(){throw Error('permission or storage failure')}}};
  try{assert.throws(()=>physicalSceneStore(),/cannot be read/);}
  finally{restore(old);}
});

test('a reconciled transaction is never replayed, and requires a GM',async()=>{
  const old=previous('game');let stored={version:1,records:{abc:{userId:'p',fingerprint:'{}',status:'needs-review',started:1}}};
  globalThis.game={user:{isGM:true},settings:{settings:new Map([[`${MODULE_ID}.${PHYSICAL_TRANSACTION_LEDGER}`,true]]),
    get:()=>structuredClone(stored),async set(ns,key,value){stored=structuredClone(value);}}};
  try{
    const receipt=await acknowledgePhysicalTransaction('abc','Source and destination checked');
    assert.equal(receipt.status,'reconciled');
    assert.match(receipt.note,/checked/);
    await assert.rejects(withPhysicalTransaction({id:'abc',userId:'p',payload:{}},async()=>({})),/cannot be replayed/);
    globalThis.game.user.isGM=false;
    await assert.rejects(acknowledgePhysicalTransaction('abc'),/Only a GM/);
  }finally{restore(old);}
});
