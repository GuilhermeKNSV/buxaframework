import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SHEET_CONFIG, MODULE_ID } from '../scripts/core/constants.js';
import { invalidateSheetConfigCache } from '../scripts/core/config.js';
import { requestPhysicalAction } from '../scripts/integrations/physical-item-transfers.js';
import { scenePhysicalItems, PHYSICAL_SCENE_STORE } from '../scripts/core/physical-items.js';

const get = (o,path) => String(path).split('.').reduce((a,k)=>a?.[k],o);
const set = (o,path,val) => {const parts=path.split('.');let a=o;for(const k of parts.slice(0,-1))a=a[k]??={};a[parts.at(-1)]=val;};
let serialId=0;
function fixture(quantity=5) {
  const previous=Object.fromEntries(['game','foundry','CONST','Hooks','canvas'].map(k=>[k,globalThis[k]]));
  const gm={id:'gm',isGM:true,isActiveGM:true,active:true};
  const user={id:'player',isGM:false,active:true};
  const actors=new Map();const items=new Map();const scenes=new Map();
  const worldItem={id:'world',system:{quantity:8},type:'loot',name:'Potion',img:'potion.png',
    toObject:()=>({_id:'world',name:'Potion',type:'loot',img:'potion.png',system:{quantity:8},flags:{buxaframework:{item:{rarityId:'rare'}}}})};
  items.set(worldItem.id,worldItem);
  const stored=new (class extends Map {[Symbol.iterator](){return this.values();}})();
  const embedded={id:'held',name:'Sword',type:'loot',system:{quantity},getFlag:()=>({rarityId:'rare'}),
    toObject:()=>({_id:'held',name:'Sword',type:'loot',img:'sword.png',system:{quantity},flags:{buxaframework:{item:{rarityId:'rare'}}}})};
  stored.set(embedded.id,embedded);
  const actor={id:'actor',name:'Knight',isOwner:true,items:stored,flags:{[MODULE_ID]:{linkedUsers:['player']}},
    getFlag(ns,path){return get(this.flags[ns],path);},
    testUserPermission:()=>true,
    async update(patch){for(const [k,v] of Object.entries(patch))set(this,k,v);},
    async updateEmbeddedDocuments(_,updates){for(const u of updates){const doc=stored.get(u._id);if(!doc)return []; doc.system.quantity=u['system.quantity'];}return updates;},
    async deleteEmbeddedDocuments(_,ids){return ids.map(id=>{const doc=stored.get(id);stored.delete(id);return doc;}).filter(Boolean);},
    async createEmbeddedDocuments(_,data){return data.map(entry=>{const id=`new-${++serialId}`;const doc={...entry,id,getFlag:(ns,path)=>get(entry.flags?.[ns],path)};stored.set(id,doc);return doc;});}
  };
  embedded.parent=actor;actors.set(actor.id,actor);
  const scene={id:'scene',width:1000,height:1000,grid:{size:100,distance:5},flags:{[MODULE_ID]:{physicalItems:[]}},
    tokens:{contents:[{actorId:'actor',x:0,y:0,width:1,height:1,hidden:false}]},
    getFlag(ns,k){return get(this.flags[ns],k);},
    async update(patch){for(const [k,v] of Object.entries(patch))set(this,k,structuredClone(v));}
  };
  scenes.set(scene.id,scene);
  const users=[gm,user];users.get=id=>users.find(u=>u.id===id);
  actors.contents=[actor];
  globalThis.foundry={utils:{deepClone:structuredClone,randomID:()=>`x-${++serialId}`,getProperty:get,setProperty:set,hasProperty:(o,p)=>get(o,p)!==undefined}};
  let store={};
  globalThis.game={user:gm,users,actors,items,scenes,system:{id:'dnd5e'},settings:{
    get:(ns,key)=>key===PHYSICAL_SCENE_STORE?store:key==='physicalItemSettings'?{lootEnabled:true,lootDistance:20}:structuredClone(DEFAULT_SHEET_CONFIG),
    async set(ns,key,value){if(key!==PHYSICAL_SCENE_STORE)throw Error('Unexpected world setting');store=structuredClone(value);return store;}
  }};
  globalThis.Hooks={callAll(){}};
  globalThis.CONST={DOCUMENT_OWNERSHIP_LEVELS:{OWNER:3,NONE:0}};
  invalidateSheetConfigCache();
  return {actor,scene,embedded,worldItem,restore(){invalidateSheetConfigCache();for(const [k,v] of Object.entries(previous))if(v===undefined)delete globalThis[k];else globalThis[k]=v;}};
}

test('GM dropping a world Item copies its data without deleting the template',async()=>{
  const f=fixture();try{
    await requestPhysicalAction({action:'drop',source:'world',itemId:'world',sceneId:'scene',quantity:3,point:{x:160,y:220}});
    assert.equal(scenePhysicalItems(f.scene).length,1);
    assert.equal(scenePhysicalItems(f.scene)[0].quantity,3);
    assert.equal(f.worldItem.system.quantity,8);
  }finally{f.restore();}
});
test('Actor partial drop reduces source quantity only after the scene item persists',async()=>{
  const f=fixture();try{
    await requestPhysicalAction({action:'drop',source:'actor',actorId:'actor',itemId:'held',sceneId:'scene',quantity:2,point:{x:180,y:90}});
    assert.equal(f.actor.items.get('held').system.quantity,3);
    assert.equal(scenePhysicalItems(f.scene)[0].quantity,2);
  }finally{f.restore();}
});
test('whole-stack transfer deletes the inventory source, preserving scene quantity',async()=>{
  const f=fixture();try{
    await requestPhysicalAction({action:'drop',source:'actor',actorId:'actor',itemId:'held',sceneId:'scene',quantity:5,point:{x:120,y:100}});
    assert.equal(f.actor.items.has('held'),false);
    assert.equal(scenePhysicalItems(f.scene)[0].quantity,5);
  }finally{f.restore();}
});
test('Actor update failure rolls back the scene object to prevent duplication',async()=>{
  const f=fixture();try{
    f.actor.updateEmbeddedDocuments=async()=>{throw Error('write failed');};
    await assert.rejects(requestPhysicalAction({action:'drop',source:'actor',actorId:'actor',itemId:'held',sceneId:'scene',quantity:3,point:{x:120,y:100}}),/write failed/);
    assert.equal(f.actor.items.get('held').system.quantity,5);
    assert.equal(scenePhysicalItems(f.scene).length,0);
  }finally{f.restore();}
});
test('Scene write failure does not mutate the Actor item',async()=>{
  const f=fixture();try{
    game.settings.set=async()=>{throw Error('world setting write failed');};
    await assert.rejects(requestPhysicalAction({action:'drop',source:'actor',actorId:'actor',itemId:'held',sceneId:'scene',quantity:3,point:{x:120,y:100}}),/world setting write failed/);
    assert.equal(f.actor.items.get('held').system.quantity,5);
  }finally{f.restore();}
});

test('looting moves one physical stack to the explicitly linked Actor, preserving item flags',async()=>{
  const f=fixture();try{
    // Transfer a world template into the scene first; the player's token is in range.
    await requestPhysicalAction({action:'drop',source:'world',itemId:'world',sceneId:'scene',quantity:3,point:{x:100,y:80}});
    const {installPhysicalItemTransfers}=await import('../scripts/integrations/physical-item-transfers.js');
    let handler;game.socket={on:(channel,cb)=>{handler=cb;},emit(){}};
    installPhysicalItemTransfers();
    game.user=game.users.get('player');
    // GM-authoritative request is handled using the real GM context by the handler.
    // Switch to GM locally to exercise the transfer itself, with the player as requester.
    game.user=game.users.get('gm');
    globalThis.canvas={ready:true,scene:f.scene,tokens:{placeables:[{document:{id:'t',actorId:'actor',hidden:false,sight:{enabled:true}},vision:{testPoint:()=>true}}]}};
    f.scene.tokens.contents[0].id='t';
    const msgs=[];game.socket.emit=(channel,message)=>msgs.push(message);
    handler({ns:'physical',kind:'request',id:'loot-1',from:'player',payload:{action:'loot',sceneId:'scene',itemId:scenePhysicalItems(f.scene)[0].id}}, 'player');
    await new Promise(resolve=>setTimeout(resolve,40));
    assert.equal(msgs[0]?.ok,true,JSON.stringify(msgs));
    assert.equal(scenePhysicalItems(f.scene).length,0);
    const created=[...f.actor.items].find(item=>item.id.startsWith('new-'));
    assert.ok(created);
    assert.equal(created.system.quantity,3);
    assert.equal(created.flags.buxaframework.item.rarityId,'rare');
    assert.equal(f.actor.getFlag(MODULE_ID,'inventory').placements[created.id].area,'inventory');
  }finally{f.restore();}
});

test('a token sheet transfers its synthetic Actor item, never the world Actor template',async()=>{
  const f=fixture();
  try {
    const clone=new Map([['held',{...f.embedded,system:{quantity:3}}]]);
    const synthetic={...f.actor,isToken:true,token:{id:'token-1'},items:clone,
      async updateEmbeddedDocuments(_type,changes){for(const c of changes)clone.get(c._id).system.quantity=c['system.quantity'];return changes;},
      async deleteEmbeddedDocuments(_type,ids){return ids.map(id=>{const doc=clone.get(id);clone.delete(id);return doc;}).filter(Boolean);}
    };
    f.scene.tokens.get=id=>id==='token-1'?{actor:synthetic}:null;
    await requestPhysicalAction({action:'drop',source:'actor',actorId:'actor',sourceTokenId:'token-1',itemId:'held',sceneId:'scene',quantity:2,point:{x:160,y:160}});
    assert.equal(clone.get('held').system.quantity,1);
    assert.equal(f.actor.items.get('held').system.quantity,5);
    assert.equal(scenePhysicalItems(f.scene)[0].quantity,2);
    await assert.rejects(requestPhysicalAction({action:'drop',source:'actor',actorId:'actor',sourceTokenId:'missing',itemId:'held',sceneId:'scene',quantity:1,point:{x:160,y:160}}),/cannot transfer/i);
  } finally {f.restore();}
});

test('multiple world drops do not overwrite or duplicate previous scene items',async()=>{
 const f=fixture();try{
   const first=await requestPhysicalAction({action:'drop',source:'world',itemId:'world',sceneId:'scene',quantity:2,point:{x:120,y:150}});
   const second=await requestPhysicalAction({action:'drop',source:'world',itemId:'world',sceneId:'scene',quantity:4,point:{x:270,y:280}});
   assert.notEqual(first.id,second.id);
   assert.deepEqual(scenePhysicalItems(f.scene).map(i=>i.quantity),[2,4]);
   assert.equal(f.worldItem.system.quantity,8);
 } finally{f.restore();}
});

test('repeated partial Actor drops keep separate scene records and exact remaining quantity',async()=>{
 const f=fixture(7);try{
   await requestPhysicalAction({action:'drop',source:'actor',actorId:'actor',itemId:'held',sceneId:'scene',quantity:2,point:{x:110,y:140}});
   await requestPhysicalAction({action:'drop',source:'actor',actorId:'actor',itemId:'held',sceneId:'scene',quantity:3,point:{x:250,y:230}});
   assert.equal(f.actor.items.get('held').system.quantity,2);
   assert.deepEqual(scenePhysicalItems(f.scene).map(item=>item.quantity),[2,3]);
 }finally{f.restore();}
});

test('GM missing isActiveGM still performs drop, move, edit, and linked looting locally',async()=>{
  const f=fixture();
  try {
    delete game.user.isActiveGM; // Real Foundry clients may not expose this getter.
    f.actor.flags[MODULE_ID].linkedUsers.push('gm');
    const created=await requestPhysicalAction({action:'drop',source:'world',sceneId:'scene',itemId:'world',quantity:2,point:{x:90,y:90}});
    assert.ok(created.id);
    await requestPhysicalAction({action:'move',sceneId:'scene',itemId:created.id,point:{x:98,y:106}});
    assert.equal(scenePhysicalItems(f.scene)[0].x,98);
    await requestPhysicalAction({action:'edit',sceneId:'scene',itemId:created.id,artwork:{x:100,y:100,size:95,rotation:33}});
    assert.equal(scenePhysicalItems(f.scene)[0].rotation,33);
    const received=await requestPhysicalAction({action:'loot',sceneId:'scene',itemId:created.id});
    assert.equal(received.actorId,'actor');
    assert.equal(scenePhysicalItems(f.scene).length,0);
    assert.equal(f.actor.items.get(received.itemId).system.quantity,2);
  }finally{f.restore();}
});

test('world-setting persistence bypasses Actor-parented Scene failures through drop, move, edit and loot',async()=>{
  const f=fixture();
  const oldClass=globalThis.getDocumentClass;
  try {
    f.actor.flags.buxaframework.linkedUsers.push('gm');
    let writes=0;
    f.scene.update=async()=>{throw Error('Scene is not a valid embedded Document within the Actor Document');};
    f.actor.getEmbeddedCollection=()=>{throw Error('Scene is not a valid embedded Document within the Actor Document');};
    globalThis.getDocumentClass=()=>({updateDocuments:async()=>{throw Error('Scene must never be updated');}});
    const realSet=game.settings.set;
    game.settings.set=async(...args)=>{writes++;return realSet(...args);};
    const created=await requestPhysicalAction({action:'drop',source:'world',itemId:'world',sceneId:'scene',quantity:1,point:{x:100,y:80}});
    await requestPhysicalAction({action:'move',sceneId:'scene',itemId:created.id,point:{x:140,y:100}});
    await requestPhysicalAction({action:'edit',sceneId:'scene',itemId:created.id,artwork:{x:145,y:105,size:90,rotation:45}});
    assert.equal(scenePhysicalItems(f.scene)[0].size,90);
    await requestPhysicalAction({action:'loot',sceneId:'scene',itemId:created.id});
    assert.equal(scenePhysicalItems(f.scene).length,0);
    assert.equal(writes,4);
  } finally {
    if(oldClass===undefined)delete globalThis.getDocumentClass;else globalThis.getDocumentClass=oldClass;
    f.restore();
  }
});

test('drop uses cursor center as image center, with no change to inventory accounting',async()=>{
  const f=fixture();try {
    await requestPhysicalAction({action:'drop',source:'actor',actorId:'actor',itemId:'held',
      sceneId:'scene',quantity:2,point:{x:288,y:321}});
    const record=scenePhysicalItems(f.scene)[0];
    assert.deepEqual([record.x,record.y,record.size],[250,283,76]);
    assert.deepEqual([record.x+record.size/2,record.y+record.size/2],[288,321]);
    assert.equal(f.actor.items.get('held').system.quantity,3);
  }finally {f.restore();}
});
