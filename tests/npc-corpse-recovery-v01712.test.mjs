import test from 'node:test';
import assert from 'node:assert/strict';
import { killNpcToken, takeNpcCorpseItem } from '../scripts/integrations/npc-death.js';
import { MODULE_ID } from '../scripts/core/constants.js';

const npcConfig = {resources:[{id:'hp',label:'HP',link:'hp',startMax:12}],npc:{dropping:{resourceId:'hp',defaultSlots:12}},inventory:{mode:'simple',slots:12}};
const snapshot = (id) => ({id,data:{name:'Gem',img:'gem.png',type:'loot',system:{quantity:1}},quantity:1,destination:'inventory'});
const flagKey=`flags.${MODULE_ID}.npcLoot`;

function fixture({saveThenThrow=false,createThenThrow=false,trackFails=false,deleteFails=false}={}) {
  const prev={game:globalThis.game,foundry:globalThis.foundry,canvas:globalThis.canvas};
  const tokenFlags={npcLoot:{killed:true,inventory:[snapshot('gem')],ground:[],groundPublished:true}};
  const items=new Map(); let generated=0, failCreation=createThenThrow, failSave=saveThenThrow;
  const actor={type:'character',id:'hero',uuid:'Actor.hero',name:'Hero',isOwner:true,items:{
    get:id=>items.get(id),[Symbol.iterator]:function*(){yield* items.values();}},
    getFlag:(_ns,key)=>actorFlags[key],
    async update(changes) {if(trackFails)throw Error('inventory flag save failed');for(const [key,value] of Object.entries(changes))if(key.startsWith('flags.buxaframework.'))actorFlags[key.slice(20)]=value;},
    async createEmbeddedDocuments(_type,source){const data=structuredClone(source[0]);const id=`created${++generated}`;
      const item={id,name:data.name,type:data.type,img:data.img,flags:data.flags,system:data.system,parent:actor,
        getFlag:(_ns,k)=>data.flags?.[MODULE_ID]?.[k],toObject:()=>({...data,_id:id})};items.set(id,item);
      if(failCreation){failCreation=false;throw Error('creation post-save hook');}return [item];},
    async deleteEmbeddedDocuments(_type,ids){if(deleteFails)throw Error('cannot delete item');for(const id of ids)items.delete(id);}
  };
  const actorFlags={};
  const token={id:'corpse',hidden:false,actorId:'npc',x:200,y:100,width:1,height:1,
    getFlag:(_ns,k)=>tokenFlags[k],
    async update(change){tokenFlags.npcLoot=change[flagKey];if(failSave){failSave=false;throw Error('token post-save hook');}}
  };
  const scene={id:'scene',grid:{size:100,distance:5},tokens:{get:id=>id==='corpse'?token:null,[Symbol.iterator]:function*(){yield {actorId:'hero',hidden:false,x:190,y:100,width:1,height:1};}}};
  globalThis.game={user:{id:'gm',isGM:true},system:{id:'dnd5e'},actors:[actor],scenes:{get:id=>id==='scene'?scene:null},settings:{get:()=>npcConfig}};
  globalThis.foundry={utils:{deepClone:structuredClone,equals:(a,b)=>JSON.stringify(a)===JSON.stringify(b),hasProperty:()=>false}};
  globalThis.canvas={scene};
  return {prev,scene,actor,token,items,tokenFlags,number:()=>generated,restore:()=>Object.assign(globalThis,prev)};
}

test('NPC corpse creation saved by a hook then rejected is recovered, without minting a duplicate',async()=>{
  const f=fixture({createThenThrow:true});
  try {
    const result=await takeNpcCorpseItem({sceneId:'scene',tokenId:'corpse',entryId:'gem',user:{id:'gm',isGM:true,character:f.actor}});
    assert.equal(result.actorId,'hero');assert.equal(f.items.size,1);assert.equal(f.number(),1);
    assert.equal(f.tokenFlags.npcLoot.inventory.length,0);
  } finally {f.restore();}
});

test('NPC corpse transfer committed by token hook is not rolled back or retried',async()=>{
  const f=fixture({saveThenThrow:true});
  try {
    const result=await takeNpcCorpseItem({sceneId:'scene',tokenId:'corpse',entryId:'gem',user:{id:'gm',isGM:true,character:f.actor}});
    assert.equal(result.actorId,'hero');assert.equal(f.items.size,1);assert.equal(f.number(),1);
    assert.equal(f.tokenFlags.npcLoot.inventory.length,0);
  } finally {f.restore();}
});

test('NPC corpse retries an interrupted delivery using its existing receipt',async()=>{
  const f=fixture();
  try {
    const receipt='scene:corpse:gem';
    const existing={id:'imported',name:'Gem',type:'loot',flags:{[MODULE_ID]:{corpseLootReceipt:receipt}},getFlag:(_ns,k)=>k==='corpseLootReceipt'?receipt:null};
    f.items.set('imported',existing);
    await takeNpcCorpseItem({sceneId:'scene',tokenId:'corpse',entryId:'gem',user:{id:'gm',isGM:true,character:f.actor}});
    assert.equal(f.items.size,1);assert.equal(f.number(),0);assert.equal(f.tokenFlags.npcLoot.inventory.length,0);
  }finally{f.restore();}
});

test('duplicate NPC ground drop IDs remain distinct and stable across a saved-write hook failure',async()=>{
  const previous={game:globalThis.game,foundry:globalThis.foundry,canvas:globalThis.canvas};
  const drops=[0,1].map(()=>({id:'gem',data:{name:'Gem',type:'loot',img:'gem.png',system:{quantity:1}},chance:100,min:1,max:1,destination:'ground'}));
  let persisted={},writes=0,failAfterSave=true;
  const scene={id:'scene',grid:{size:100,distance:5},width:1600,height:1600,getFlag:()=>[]};
  const actor={type:'npc',id:'npc',isOwner:true,items:[],system:{attributes:{hp:{value:0,max:12}}},getFlag:(_ns,key)=>key==='npc.dropTable'?drops:null};
  let lootState;
  const document={id:'token',parent:scene,x:400,y:400,width:1,height:1,hidden:false,
    getFlag:(_ns,key)=>key==='npcLoot'?lootState:null,
    async update(changes){if(flagKey in changes)lootState=changes[flagKey];if('hidden' in changes)this.hidden=changes.hidden;}};
  const token={id:'token',document,actor};
  globalThis.game={user:{id:'gm',isGM:true},system:{id:'dnd5e'},combats:[],settings:{
    get(_ns,key){return key==='physicalSceneItems'?persisted:npcConfig;},
    async set(_ns,key,value){if(key==='physicalSceneItems') {persisted=value;writes++;if(failAfterSave){failAfterSave=false;throw Error('settings post-save hook');}}}
  }};
  globalThis.canvas={scene};
  globalThis.foundry={utils:{deepClone:structuredClone,equals:(a,b)=>JSON.stringify(a)===JSON.stringify(b),
    hasProperty:(o,k)=>k.split('.').reduce((v,p)=>v?.[p],o)!==undefined,
    getProperty:(o,k)=>k.split('.').reduce((v,p)=>v?.[p],o)}};
  try {
    await assert.rejects(killNpcToken(token),/settings post-save hook/);
    assert.equal(persisted.scene.length,2);
    assert.deepEqual(persisted.scene.map(e=>e.id),['npc-token-gem','npc-token-gem-2']);
    await killNpcToken(token);
    assert.equal(persisted.scene.length,2);
    assert.equal(writes,1,'retry identifies both published physical items without duplicating');
    assert.equal(lootState.groundPublished,true);
  }finally{Object.assign(globalThis,previous);}
});

test('failed inventory tracking restores corpse source and deletes only newly minted Item',async()=>{
  const f=fixture({trackFails:true});
  try {
    await assert.rejects(takeNpcCorpseItem({sceneId:'scene',tokenId:'corpse',entryId:'gem',user:{id:'gm',isGM:true,character:f.actor}}),/inventory flag save failed/);
    assert.equal(f.items.size,0);assert.equal(f.tokenFlags.npcLoot.inventory.length,1);
  }finally{f.restore();}
});

test('failed corpse cleanup reports GM reconciliation and preserves receipt instead of duplicating',async()=>{
  const f=fixture({trackFails:true,deleteFails:true});
  try {
    await assert.rejects(takeNpcCorpseItem({sceneId:'scene',tokenId:'corpse',entryId:'gem',user:{id:'gm',isGM:true,character:f.actor}}),/GM reconciliation/);
    assert.equal(f.items.size,1);
    await assert.rejects(takeNpcCorpseItem({sceneId:'scene',tokenId:'corpse',entryId:'gem',user:{id:'gm',isGM:true,character:f.actor}}),/GM reconciliation/);
    assert.equal(f.items.size,1);assert.equal(f.number(),1);
  }finally{f.restore();}
});

test('duplicate NPC inventory drops get independent stable receipt IDs',async()=>{
  const {uniqueNpcInventoryDrops}=await import('../scripts/core/npc-dropping.js');
  const inputs=[snapshot('gem'),snapshot('gem'),snapshot('gem--2'),snapshot('gem'),snapshot('gem--3')];
  const output=uniqueNpcInventoryDrops(inputs);
  assert.equal(output[0].id,'gem');
  assert.equal(new Set(output.map(entry=>entry.id)).size,inputs.length);
  assert.deepEqual(inputs.map(entry=>entry.id),['gem','gem','gem--2','gem','gem--3'],'source table untouched');
  assert.deepEqual(uniqueNpcInventoryDrops(inputs),output,'IDs remain stable across retries');
});

test('legacy corpses with duplicate inventory IDs reject pickup without deleting either Item',async()=>{
  const f=fixture();try {
    f.tokenFlags.npcLoot.inventory=[snapshot('gem'),snapshot('gem')];
    await assert.rejects(takeNpcCorpseItem({sceneId:'scene',tokenId:'corpse',entryId:'gem',
      user:{id:'gm',isGM:true,character:f.actor}}),/duplicate Item IDs/);
    assert.equal(f.number(),0);
    assert.equal(f.tokenFlags.npcLoot.inventory.length,2);
  }finally{f.restore();}
});
