import test from 'node:test';
import assert from 'node:assert/strict';
import {MODULE_ID,DEFAULT_SHEET_CONFIG} from '../scripts/core/constants.js';
import {invalidateSheetConfigCache} from '../scripts/core/config.js';
import {PHYSICAL_SCENE_STORE,scenePhysicalItems} from '../scripts/core/physical-items.js';
import {requestPhysicalAction,installPhysicalItemTransfers} from '../scripts/integrations/physical-item-transfers.js';
import {resolvePhysicalDropTarget,actorDropPayload} from '../scripts/integrations/physical-item-drop-targets.js';
import {installPhysicalItemHandoffs,transferBoardItemAtPointer,transferInventoryItemToDirectory} from '../scripts/integrations/physical-item-handoff.js';

const get=(o,path)=>String(path).split('.').reduce((a,k)=>a?.[k],o);
const set=(o,path,val)=>{const keys=path.split('.');let p=o;for(const key of keys.slice(0,-1))p=p[key]??={};p[keys.at(-1)]=val;};
let uid=0;
function fixture() {
  const prior=Object.fromEntries(['game','foundry','Hooks','CONST','Item','document','canvas'].map(k=>[k,globalThis[k]]));
  const gm={id:'gm',isGM:true,active:true};const user={id:'u',isGM:false,active:true};
  const users=[gm,user];users.get=id=>users.find(x=>x.id===id);
  const actors=new Map();actors.contents=[];
  const world=new Map();world.contents=[];
  const scenes=new Map();
  let store={};
  let failWorldCreate=false, failWorldStore=false, failSourceRemove=false, failInventoryPlacement=false; let inventorySlots=50;
  function makeItem(name,quantity,extra={}) {
    const id=`item-${++uid}`;
    return {id,name,system:{quantity},type:'tool',img:'tool.png',...extra,
      toObject(){return {_id:id,name,type:'tool',img:'tool.png',system:{quantity:this.system.quantity},flags:{[MODULE_ID]:{item:{rarityId:'legendary',shape:{width:1,height:1,cells:[0]}}}}};}};
  }
  function makeActor(id,links) {
    const inventory=new (class extends Map {[Symbol.iterator](){return this.values();}})();inventory.contents=[];
    const actor={id,isOwner:true,name:id,items:inventory,flags:{[MODULE_ID]:{linkedUsers:links}},
      getFlag(ns,key){return get(this.flags[ns],key);},
      testUserPermission:()=>true,
      async update(patch){if(failInventoryPlacement)throw Error('slot write refused');for(const [k,v]of Object.entries(patch))set(this,k,v);},
      async createEmbeddedDocuments(type,records){assert.equal(type,'Item');return records.map(data=>{
        const doc=makeItem(data.name,data.system.quantity);doc.flags=structuredClone(data.flags);doc.parent=actor;
        doc.getFlag=(ns,key)=>get(doc.flags?.[ns],key);
        inventory.set(doc.id,doc);return doc;});},
      async deleteEmbeddedDocuments(type,ids){assert.equal(type,'Item');if(failSourceRemove)throw Error('source removal refused');return ids.map(key=>{const doc=inventory.get(key);inventory.delete(key);return doc;}).filter(Boolean);},
      async updateEmbeddedDocuments(type,updates){assert.equal(type,'Item');if(failSourceRemove)throw Error('source removal refused');for(const update of updates){const doc=inventory.get(update._id);if(!doc)return [];doc.system.quantity=update['system.quantity'];}return updates;}
    };
    actors.set(id,actor);actors.contents.push(actor);return actor;
  }
  const a=makeActor('a',['u']);const b=makeActor('b',['u']);
  const source=makeItem('Ancient Blade',5);source.parent=a;source.getFlag=(ns,key)=>get(source.toObject().flags[ns],key);a.items.set(source.id,source);
  const template=makeItem('World Potion',8);template.testUserPermission=()=>true;world.set(template.id,template);
  const scene={id:'scene',grid:{size:100,distance:5},width:2000,height:2000,
    flags:{[MODULE_ID]:{physicalItems:[]}},tokens:{contents:[{actorId:a.id,x:0,y:0,width:1,height:1,hidden:false},{actorId:b.id,x:0,y:0,width:1,height:1,hidden:false}]},
    getFlag(ns,key){return get(this.flags[ns],key);},update(){throw Error('Scene must not be written');}};
  scenes.set('scene',scene);
  globalThis.foundry={utils:{deepClone:structuredClone,randomID:()=>`p-${++uid}`,getProperty:get,setProperty:set,hasProperty:(o,p)=>get(o,p)!==undefined}};
  globalThis.Hooks={callAll(){}};globalThis.CONST={DOCUMENT_OWNERSHIP_LEVELS:{OWNER:3,NONE:0}};
  globalThis.Item={async create(data){if(failWorldCreate)throw Error('world create refused');const doc=makeItem(data.name,data.system.quantity);
    doc.flags=structuredClone(data.flags);doc.folder=data.folder;doc.delete=async()=>{world.delete(doc.id);};
    world.set(doc.id,doc);return doc;}};
  globalThis.game={user:gm,users,actors,items:world,scenes,folders:new Map(),system:{id:'dnd5e'},settings:{
    get(ns,key){if(key===PHYSICAL_SCENE_STORE)return store;if(key==='physicalItemSettings')return {lootEnabled:true,lootDistance:25};const config=structuredClone(DEFAULT_SHEET_CONFIG);config.inventory.slots=inventorySlots;return config;},
    async set(ns,key,value){if(failWorldStore)throw Error('world storage refused');assert.equal(key,PHYSICAL_SCENE_STORE);store=structuredClone(value);return store;}
  }};
  invalidateSheetConfigCache();
  return {a,b,source,template,scene,world,set failWorldCreate(v){failWorldCreate=v;},set failWorldStore(v){failWorldStore=v;},
    set failSourceRemove(v){failSourceRemove=v;},set failInventoryPlacement(v){failInventoryPlacement=v;},set inventorySlots(v){inventorySlots=v;},
    restore(){invalidateSheetConfigCache();for(const [key,value]of Object.entries(prior)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
  };
}
const go=payload=>requestPhysicalAction({action:'transfer',sceneId:'scene',...payload});

test('world directory -> inventory copies template, places it, preserves full flags',async()=>{
  const f=fixture();try{
    const result=await go({source:'world',destination:'actor',itemId:f.template.id,quantity:2,actorId:'a'});
    assert.equal(f.a.items.get(result.itemId).system.quantity,2);
    assert.equal(f.a.items.get(result.itemId).flags[MODULE_ID].item.rarityId,'legendary');
    assert.equal(f.world.get(f.template.id),f.template);
    assert.equal(f.a.getFlag(MODULE_ID,'inventory').placements[result.itemId].area,'inventory');
  }finally{f.restore();}
});
test('inventory -> directory creates independent Item before shrinking source stack',async()=>{
  const f=fixture();try{
    const result=await go({source:'actor',destination:'world',actorId:'a',itemId:f.source.id,quantity:3});
    assert.equal(f.world.get(result.itemId).system.quantity,3);
    assert.equal(f.source.system.quantity,2);
    assert.equal(f.world.get(result.itemId).flags[MODULE_ID].item.rarityId,'legendary');
  }finally{f.restore();}
});
test('board -> directory creates a world Item then removes scene source',async()=>{
  const f=fixture();try{
    await requestPhysicalAction({action:'drop',source:'world',itemId:f.template.id,quantity:3,sceneId:'scene',point:{x:170,y:160}});
    const record=scenePhysicalItems(f.scene)[0];
    const result=await go({source:'scene',destination:'world',itemId:record.id,quantity:3});
    assert.equal(f.world.get(result.itemId).system.quantity,3);
    assert.equal(scenePhysicalItems(f.scene).length,0);
  }finally{f.restore();}
});
test('board -> inventory partial transfer retains correct remaining source and new destination',async()=>{
  const f=fixture();try{
    await requestPhysicalAction({action:'drop',source:'world',itemId:f.template.id,quantity:5,sceneId:'scene',point:{x:170,y:160}});
    const record=scenePhysicalItems(f.scene)[0];
    const result=await go({source:'scene',destination:'actor',itemId:record.id,quantity:2,actorId:'a'});
    assert.equal(f.a.items.get(result.itemId).system.quantity,2);
    assert.equal(scenePhysicalItems(f.scene)[0].quantity,3);
    assert.equal(scenePhysicalItems(f.scene)[0].data.system.quantity,3);
  }finally{f.restore();}
});
test('Actor -> Actor transfer removes original only after receiving Actor has item',async()=>{
  const f=fixture();try{
    const result=await go({source:'actor',destination:'actor',actorId:'a',targetActorId:'b',itemId:f.source.id,quantity:5});
    assert.equal(f.a.items.has(f.source.id),false);
    assert.equal(f.b.items.get(result.itemId)?.system.quantity,5);
  }finally{f.restore();}
});
test('destination creation failure never reduces source',async()=>{
  const f=fixture();try{
    f.failWorldCreate=true;
    await assert.rejects(go({source:'actor',destination:'world',actorId:'a',itemId:f.source.id,quantity:5}),/world create refused/);
    assert.equal(f.a.items.get(f.source.id).system.quantity,5);
  }finally{f.restore();}
});
test('source deletion failure rolls back new world Item',async()=>{
  const f=fixture();try{
    f.failSourceRemove=true;
    await assert.rejects(go({source:'actor',destination:'world',actorId:'a',itemId:f.source.id,quantity:5}),/source removal refused/);
    assert.equal(f.a.items.has(f.source.id),true);
    assert.equal(f.world.size,1);
  }finally{f.restore();}
});
test('failed scene removal rolls back new Actor item and preserves board source',async()=>{
  const f=fixture();try{
    await requestPhysicalAction({action:'drop',source:'world',itemId:f.template.id,quantity:2,sceneId:'scene',point:{x:170,y:160}});
    const id=scenePhysicalItems(f.scene)[0].id; f.failWorldStore=true;
    await assert.rejects(go({source:'scene',destination:'actor',itemId:id,quantity:2,actorId:'a'}),/world storage refused/);
    assert.equal(scenePhysicalItems(f.scene).length,1);
    assert.equal([...f.a.items.values()].filter(i=>i.name==='World Potion').length,0);
  }finally{f.restore();}
});
test('target resolver distinguishes Actor sheets, directory, panel, and no drop surface',()=>{
  const target=(mapping)=>({closest(selector){return mapping[selector]??null;}});
  const actorNode={dataset:{buxaDropActorId:'x',buxaDropTokenId:'t'}};
  assert.deepEqual(resolvePhysicalDropTarget(target({'[data-buxa-drop-actor-id]':actorNode}),100,100),
    {kind:'actor',actorId:'x',targetTokenId:'t',position:null});
  assert.deepEqual(resolvePhysicalDropTarget(target({'[data-buxa-folder-drop],[data-buxa-folder-panel]':{dataset:{buxaFolderPanel:'bag'}}}),30,20),
    {kind:'world',folderId:'bag'});
  assert.equal(resolvePhysicalDropTarget(target({}),10,10),null);
  assert.deepEqual(actorDropPayload({id:'actor',isToken:true,token:{id:'token'}}),{actorId:'actor',sourceTokenId:'token'});
});

test('partial board -> directory creates a separate item and leaves reduced ground stack',async()=>{
  const f=fixture();try{
    await requestPhysicalAction({action:'drop',source:'world',itemId:f.template.id,quantity:5,sceneId:'scene',point:{x:100,y:110}});
    const before=scenePhysicalItems(f.scene)[0];
    const result=await go({source:'scene',destination:'world',itemId:before.id,quantity:2});
    assert.equal(f.world.get(result.itemId).system.quantity,2);
    assert.equal(scenePhysicalItems(f.scene)[0].quantity,3);
    assert.equal(scenePhysicalItems(f.scene)[0].data.system.quantity,3);
  }finally{f.restore();}
});
test('inventory full rejects world -> Actor and leaves world template unchanged',async()=>{
  const f=fixture();try{
    f.inventorySlots=1;
    const blocker={id:'full',system:{quantity:1},getFlag:()=>null};
    f.b.items.set(blocker.id,blocker);
    f.b.flags[MODULE_ID].inventory={tracked:['full'],placements:{full:{area:'inventory',index:0}}};
    await assert.rejects(go({source:'world',destination:'actor',itemId:f.template.id,quantity:2,actorId:'b'}),/no available space/);
    assert.equal(f.b.items.size,1);
    assert.equal(f.b.items.get('full'),blocker);
    assert.equal(f.world.get(f.template.id),f.template);
  }finally{f.restore();}
});
test('native world-directory drop is intercepted before Foundry ActorSheet and copies only one item',async()=>{
  const f=fixture();try{
    const listeners=new Map();
    globalThis.document={addEventListener(type,handler,capture){if(capture)listeners.set(type,handler);}};
    globalThis.canvas={scene:f.scene};
    f.template.system.quantity=1;
    installPhysicalItemHandoffs();
    let stopped=0, prevented=0;
    const sheet={dataset:{buxaDropActorId:'b'}};
    const target={closest(selector){return selector==='[data-buxa-drop-actor-id]'?sheet:null;}};
    const event={clientX:90,clientY:100,target,
      dataTransfer:{types:['text/plain'],getData:()=>JSON.stringify({type:'Item',uuid:`Item.${f.template.id}`})},
      preventDefault(){prevented++;},stopImmediatePropagation(){stopped++;}};
    listeners.get('dragover')(event);
    listeners.get('drop')(event);
    await new Promise(setImmediate);await new Promise(setImmediate);
    assert.equal(prevented,2);assert.equal(stopped,1);
    assert.equal(f.b.items.size,1);
    assert.equal([...f.b.items.values()][0].system.quantity,1);
    assert.equal(f.world.size,1);
  }finally{f.restore();}
});

test('Pixi board pointer handoff to inventory transfers source rather than moving it in scene',async()=>{
  const f=fixture();try{
    await requestPhysicalAction({action:'drop',source:'world',itemId:f.template.id,quantity:1,sceneId:'scene',point:{x:200,y:210}});
    const ground=scenePhysicalItems(f.scene)[0];
    globalThis.canvas={scene:f.scene};
    const sheet={dataset:{buxaDropActorId:'b'}};
    const target={closest(selector){return selector==='[data-buxa-drop-actor-id]'?sheet:null;}};
    globalThis.document={elementFromPoint:()=>target};
    assert.equal(await transferBoardItemAtPointer(ground,100,100),true);
    assert.equal(scenePhysicalItems(f.scene).length,0);
    assert.equal(f.b.items.size,1);
    assert.equal([...f.b.items.values()][0].system.quantity,1);
  }finally{f.restore();}
});
test('inventory pointer handoff to world directory creates copy and deletes source',async()=>{
  const f=fixture();try{
    f.source.system.quantity=1;
    globalThis.canvas={scene:f.scene};
    const directory={};
    globalThis.document={elementFromPoint:()=>({closest(selector){return selector.startsWith('.buxa-world-item-directory')?directory:null;}})};
    assert.equal(await transferInventoryItemToDirectory(f.a,f.source,140,150),true);
    assert.equal(f.a.items.has(f.source.id),false);
    assert.equal(f.world.size,2);
  }finally{f.restore();}
});

test('world -> complex Actor inventory snaps multi-cell item off invalid edge without loss or duplication',async()=>{
  const f=fixture();
  try {
    const originalGet=game.settings.get;
    game.settings.get=(ns,key)=>{
      const value=originalGet(ns,key);
      if (key==='sheetConfig') {
        value.inventory.mode='complex';
        value.inventory.complex={columns:7,rows:5,autoSort:false};
      }
      return value;
    };
    invalidateSheetConfigCache();
    f.template.toObject=()=>({_id:f.template.id,name:f.template.name,type:'tool',img:f.template.img,
      system:{quantity:f.template.system.quantity},flags:{[MODULE_ID]:{item:{rarityId:'legendary',
        shape:{cells:[{x:0,y:0},{x:1,y:0},{x:0,y:1},{x:1,y:1},{x:1,y:2}]}}}}});
    const transferred=await go({source:'world',destination:'actor',itemId:f.template.id,quantity:1,
      actorId:'a',position:{area:'inventory',index:6}});
    const at=f.a.getFlag(MODULE_ID,'inventory').placements[transferred.itemId];
    assert.equal(at.area,'inventory');
    assert.equal(at.index,5,'right-edge drop resolves to nearby valid footprint origin');
    assert.equal(f.a.items.get(transferred.itemId).system.quantity,1);
    assert.ok(f.world.get(f.template.id),'world template remains untouched');
  } finally {f.restore();}
});


test('post-create hook failure cannot strand a new Actor item after the transfer rejects',async()=>{
  const f=fixture();try{
    const create=f.a.createEmbeddedDocuments;
    f.a.createEmbeddedDocuments=async function(...args){
      await create.apply(this,args);
      throw Error('Post-create Item hook failed');
    };
    await assert.rejects(go({source:'world',destination:'actor',itemId:f.template.id,quantity:1,actorId:'a'}),/Post-create Item hook failed/);
    assert.equal([...f.a.items.values()].filter(item=>item.name==='World Potion').length,0);
    assert.equal(f.world.get(f.template.id),f.template);
  }finally{f.restore();}
});

test('Item Directory creation rights never bypass scene loot distance and character link checks',async()=>{
  const f=fixture();try{
    // GM creates a ground item far beyond a linked player's loot range.
    await requestPhysicalAction({action:'drop',source:'world',sceneId:'scene',itemId:f.template.id,quantity:1,point:{x:1700,y:1700}});
    const dropped=scenePhysicalItems(f.scene)[0];
    const player=globalThis.game.users.get('u');
    player.can=permission=>permission==='ITEM_CREATE';
    let receiver;
    const response=new Promise(resolve=>{receiver=resolve;});
    let socketHandler;
    globalThis.game.socket={
      on(channel,fn){socketHandler=fn;},
      emit(channel,message){if(message.kind==='result')receiver(message);}
    };
    installPhysicalItemTransfers();
    socketHandler({ns:'physical',kind:'request',id:'attempt1',from:'u',payload:{
      action:'transfer',source:'scene',destination:'world',sceneId:'scene',itemId:dropped.id,quantity:1
    }},'u');
    const result=await response;
    assert.equal(result.ok,false);
    assert.match(result.error,/within|linked|disabled/i);
    assert.equal(scenePhysicalItems(f.scene)[0].id,dropped.id);
  }finally{f.restore();}
});

test('post-create world Item hook failure removes new directory copy and retains source',async()=>{
  const f=fixture();try{
    const create=globalThis.Item.create;
    globalThis.Item.create=async function(...args){
      await create.apply(this,args);
      throw Error('Post-create directory hook failed');
    };
    await assert.rejects(go({source:'actor',destination:'world',actorId:'a',itemId:f.source.id,quantity:5}),/Post-create directory hook failed/);
    assert.equal(f.world.size,1,'no duplicate world Item remains');
    assert.equal(f.a.items.has(f.source.id),true,'Actor source is not removed');
  }finally{f.restore();}
});

test('world-to-Actor physical transfer automatically fills partial arrow stacks and splits overflow',async()=>{
  const f=fixture();try{
    const old=f.template.toObject.bind(f.template);
    f.template.toObject=()=>{const snapshot=old();snapshot.flags[MODULE_ID].item.multiple={enabled:true,maxStack:10};return snapshot;};
    const first=await go({source:'world',destination:'actor',itemId:f.template.id,quantity:6,actorId:'a'});
    const second=await go({source:'world',destination:'actor',itemId:f.template.id,quantity:7,actorId:'a'});
    assert.equal(f.a.items.get(first.itemId).system.quantity,10);
    assert.equal(f.a.items.get(second.itemId).system.quantity,3);
    assert.equal(f.template.system.quantity,8,'world template unchanged');
  }finally{f.restore();}
});

test('Actor-to-Actor transfer restores filled partial stacks when source removal fails',async()=>{
  const f=fixture();try{
    const old=f.source.toObject.bind(f.source);
    f.source.toObject=()=>{const snapshot=old();snapshot.flags[MODULE_ID].item.multiple={enabled:true,maxStack:10};return snapshot;};
    const first=await go({source:'actor',destination:'actor',actorId:'a',targetActorId:'b',itemId:f.source.id,quantity:5});
    const previous=f.b.items.get(first.itemId);
    assert.equal(previous.system.quantity,5);
    f.a.items.set(f.source.id,f.source); // Second independently held source with the same Item rules.
    f.a.deleteEmbeddedDocuments=async()=>{throw Error('source removal refused');};
    await assert.rejects(go({source:'actor',destination:'actor',actorId:'a',targetActorId:'b',itemId:f.source.id,quantity:5}),/source removal refused/);
    assert.equal(previous.system.quantity,5,'existing stack increment rolled back');
    assert.equal([...f.b.items].length,1);
    assert.equal(f.a.items.get(f.source.id)?.system.quantity,5);
  }finally{f.restore();}
});

test('board item dropped onto the crate SPRITE auto-fits into nested free cells instead of rejecting undefined valid',async()=>{
  const f=fixture();
  try {
    const axes=(id,index)=>({sourceId:id,providerId:'root',compartmentId:'crate',index,rotation:0,
      data:{name:'Axe',img:'axe.png',type:'tool',system:{quantity:1},flags:{[MODULE_ID]:{
        item:{shape:{cells:[{x:0,y:0},{x:1,y:0},{x:0,y:1},{x:0,y:2}]}}}}}});
    const coin={sourceId:'coin',providerId:'root',compartmentId:'crate',index:17,rotation:0,
      data:{name:'Coin',type:'loot',system:{quantity:2},flags:{[MODULE_ID]:{item:{shape:{cells:[{x:0,y:0}]}}}}}};
    f.template.system.quantity=1;
    f.template.toObject=()=>({name:'Crate',type:'tool',img:'crate.png',system:{quantity:1},flags:{[MODULE_ID]:{
      item:{storage:{slots:{external:[{id:'crate',mode:'complex',columns:5,rows:4,
        cells:Array.from({length:20},(_,i)=>i).filter(i=>i!==0&&i!==4)}]}}},
      backpackContents:[axes('axe1',2),axes('axe2',8),coin]
    }}});
    await requestPhysicalAction({action:'drop',source:'world',itemId:f.template.id,quantity:1,sceneId:'scene',point:{x:300,y:350}});
    const chest=scenePhysicalItems(f.scene)[0];
    const sword= f.template;
    sword.toObject=()=>({name:'Sword',type:'tool',img:'sword.png',system:{quantity:1},flags:{[MODULE_ID]:{
      item:{shape:{cells:Array.from({length:6},(_,i)=>({x:i%2,y:Math.floor(i/2)}))}}
    }}});
    await requestPhysicalAction({action:'drop',source:'world',itemId:sword.id,quantity:1,sceneId:'scene',point:{x:600,y:350}});
    const dragged=scenePhysicalItems(f.scene).find(record=>record.id!==chest.id);
    assert.ok(dragged);
    const board={contains:()=>true};
    globalThis.document={getElementById:id=>id==='board'?board:null,elementFromPoint:()=>board};
    globalThis.canvas={ready:true,scene:f.scene,tokens:{placeables:[]},
      canvasCoordinatesFromClient:({x,y})=>({x,y})};
    assert.equal(await transferBoardItemAtPointer(dragged,chest.x+10,chest.y+10),true);
    const remaining=scenePhysicalItems(f.scene);
    assert.equal(remaining.length,1,'the sword should leave the board');
    assert.equal(remaining[0].id,chest.id);
    const packed=remaining[0].data.flags[MODULE_ID].backpackContents;
    const swordChild=packed.find(entry=>entry.data.name==='Sword');
    assert.ok(swordChild,'the sword should now be inside the chest');
    assert.equal(swordChild.index,5,'auto placement uses first legal origin for the 2×3 sword');
    assert.equal(swordChild.rotation,0);
    assert.equal(packed.length,4,'previous axe/coin contents remain untouched');
  }finally {f.restore();}
});
