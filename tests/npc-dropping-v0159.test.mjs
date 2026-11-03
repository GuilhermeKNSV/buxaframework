import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeNpcDropping,npcDropCapacity,npcDropResource,normalizeNpcDropEntry,quantityOptions,rollNpcDrops,npcDropTable} from '../scripts/core/npc-dropping.js';
const sample={id:'loot00001',data:{name:'Ancient Gem',type:'loot',img:'gem.png',system:{quantity:99},_id:'world1'},chance:100,min:1,max:3,weights:'1:5,2:3,3:2',destination:'ground'};
const actor=flags=>({type:'npc',getFlag:(_ns,key)=>flags[key]});
test('NPC Drop config and per-actor settings stay independent of world inventory size',()=>{
  assert.deepEqual(normalizeNpcDropping({defaultSlots:500,resourceId:'mp'}),{defaultSlots:200,resourceId:'mp'});
  assert.deepEqual(normalizeNpcDropping({defaultSlots:'',resourceId:''}),{defaultSlots:12,resourceId:'hp'});
  assert.equal(npcDropCapacity(actor({'npc.dropCapacity':7}),{npc:{dropping:{defaultSlots:20}}}),7);
  assert.equal(npcDropCapacity(actor({}),{npc:{dropping:{defaultSlots:20}}}),20);
  assert.equal(npcDropResource(actor({'npc.dropResource':'mana'}),{resources:[{id:'hp'},{id:'mana'}],npc:{dropping:{resourceId:'hp'}}}).id,'mana');
});
test('normalization preserves item snapshots and prevents injecting unsafe IDs or quantities',()=>{
  const entry=normalizeNpcDropEntry(sample);
  assert.equal(entry.data._id,undefined);assert.equal(entry.data.name,'Ancient Gem');
  assert.equal(entry.max,3);assert.equal(entry.destination,'ground');
  assert.equal(normalizeNpcDropEntry({...sample,id:'bad id'}),null);
  assert.equal(normalizeNpcDropEntry({...sample,quantity:1,weights:'1:3;2:7'}).weights,'1:3;2:7');
  assert.deepEqual(npcDropTable(actor({'npc.dropTable':[sample,{id:'?',data:{}},sample]})).map(e=>e.id),['loot00001','loot00001']);
});
test('quantity weight picker is weighted and rejects zero-weight quantities',()=>{
  assert.deepEqual(quantityOptions(sample).map(v=>v.weight),[5,3,2]);
  assert.deepEqual(quantityOptions({...sample,weights:'3:10'}).map(v=>v.weight),[0,0,10]);
  assert.deepEqual(quantityOptions({...sample,weights:''}).map(v=>v.weight),[1,1,1]);
  const pick=v=>rollNpcDrops([sample],(()=>{const seq=[0,v];return ()=>seq.shift()??0;})())[0].quantity;
  assert.equal(pick(.15),1);assert.equal(pick(.5),2);assert.equal(pick(.85),3);
});
test('drop chance gates quantity and independent destinations without consuming input',()=>{
  const inventory={...sample,id:'loot00002',destination:'inventory',chance:20};
  const one=rollNpcDrops([sample,inventory],()=>.4);
  assert.deepEqual(one.map(x=>x.id),['loot00001']);
  assert.equal(one[0].quantity,1);assert.equal(one[0].data.system.quantity,1);
  assert.equal(sample.data.system.quantity,99);
  assert.deepEqual(rollNpcDrops([sample,inventory],()=>.99).map(x=>x.id),['loot00001']);
  assert.equal(rollNpcDrops([{...sample,chance:0}],()=>0).length,0);
});
test('NPC-only screen, GM controls, corpse pickup, and world configuration are wired',()=>{
  const get=path=>readFileSync(new URL(path,import.meta.url),'utf8');
  const sheet=get('../templates/player-sheet.hbs'),config=get('../templates/layout-config.hbs'),settings=get('../templates/npc-settings.hbs');
  for(const key of ['data-sheet-tab="inventory"','data-npc-drop-zone','data-npc-drop-entry','data-npc-drop-section'])assert.ok(sheet.includes(key),key);
  assert.doesNotMatch(sheet,/data-sheet-tab="drop"/);
  assert.ok(sheet.indexOf('class="buxa-npc-drop-page"') > sheet.indexOf('class="buxa-inventory-section buxa-bag-section"'), 'NPC Drop must appear BELOW inventory');
  for (const key of ['data-config-section="npc"', 'data-config-panel="npc"', 'data-npc-drop-default-slots', 'data-npc-drop-resource']) assert.ok(config.includes(key), key);
  for(const key of ['data-npc-drop-capacity','data-npc-hp-resource'])assert.ok(settings.includes(key),key);
  const death=get('../scripts/integrations/npc-death.js');
  for(const key of ['rollNpcDrops','writePhysical','archiveEncounterDeaths','trackInventoryItem','hoverToken','dblclick'])assert.ok(death.includes(key),key);
});
test('GM kill rolls once, marks only one token, and removes its combat turn',async()=>{
  const prior={game:globalThis.game,foundry:globalThis.foundry,canvas:globalThis.canvas};
  let saveCount=0,combatDeleted=[];
  const scene={id:'sceneA',grid:{size:100,distance:5},width:2000,height:2000};
  const flags={'npc.dropTable':[sample]}, tokenFlags={};
  const actor={type:'npc',id:'npc001',isOwner:true,items:[],system:{attributes:{hp:{value:0,max:12}}},
    getFlag:(_,key)=>flags[key]};
  const document={id:'token001',parent:scene,width:1,height:1,x:200,y:250,
    getFlag:(_,key)=>tokenFlags[key],
    async update(change){saveCount++;tokenFlags.npcLoot=change['flags.buxaframework.npcLoot'];}};
  const token={id:'token001',actor,document};
  const combat={scene,combatants:[{id:'combat001',sceneId:'sceneA',tokenId:'token001'},{id:'combat002',sceneId:'sceneA',tokenId:'another'}],
    async deleteEmbeddedDocuments(_type,ids){combatDeleted.push(...ids);this.combatants=this.combatants.filter(c=>!ids.includes(c.id));}};
  const config={resources:[{id:'hp',label:'HP',link:'hp',startMax:12}],npc:{dropping:{resourceId:'hp',defaultSlots:12}}};
  globalThis.foundry={utils:{deepClone:structuredClone,hasProperty:(o,k)=>k.split('.').reduce((v,p)=>v?.[p],o)!==undefined,
    getProperty:(o,k)=>k.split('.').reduce((v,p)=>v?.[p],o)}};
  globalThis.game={user:{isGM:true},system:{id:'dnd5e'},settings:{get:()=>config},combats:[combat]};
  globalThis.canvas={scene};
  try {
    const {killNpcToken}=await import('../scripts/integrations/npc-death.js');
    // Inventory-only entries do not require the scene store to change.
    flags['npc.dropTable']=[{...sample,destination:'inventory',chance:100,min:2,max:2}];
    const first=await killNpcToken(token);
    assert.equal(first.killed,true);assert.equal(first.groundPublished,true);
    assert.equal(first.inventory.length,1);assert.equal(first.inventory[0].quantity,2);
    assert.deepEqual(combatDeleted,['combat001']);
    const second=await killNpcToken(token);
    assert.deepEqual(second.inventory,first.inventory);
    assert.equal(saveCount,2,'token is flagged once for roll and once for publication state');
  }finally{Object.assign(globalThis,prior);}
});
test('Ground drops publish through existing physical item storage exactly once, with deterministic IDs',async()=>{
  const prior={game:globalThis.game,foundry:globalThis.foundry,canvas:globalThis.canvas};
  let store={},writes=0;const tokenFlags={};
  const scene={id:'sceneB',grid:{size:100,distance:5},width:1800,height:1400,getFlag:()=>[]};
  const actor={type:'npc',isOwner:true,id:'npc002',items:[],system:{attributes:{hp:{value:0,max:10}}},
    getFlag:(_ns,key)=>key==='npc.dropTable'?[sample]:null};
  const document={id:'tokenGround',parent:scene,x:400,y:400,width:1,height:1,hidden:false,
    getFlag:(_ns,key)=>tokenFlags[key],
    async update(changes){if('flags.buxaframework.npcLoot' in changes)tokenFlags.npcLoot=changes['flags.buxaframework.npcLoot'];if('hidden' in changes)this.hidden=changes.hidden;}};
  const token={id:'tokenGround',document,actor};
  const config={resources:[{id:'hp',link:'hp',label:'HP',startMax:10}],npc:{dropping:{resourceId:'hp',defaultSlots:12}}};
  globalThis.foundry={utils:{deepClone:structuredClone,hasProperty:(o,k)=>k.split('.').reduce((v,p)=>v?.[p],o)!==undefined,
    getProperty:(o,k)=>k.split('.').reduce((v,p)=>v?.[p],o),randomID:()=>`rand${Math.random()}`}};
  globalThis.game={user:{isGM:true},system:{id:'dnd5e'},combats:[],settings:{get(_ns,key){return key==='physicalSceneItems'?store:config;},
    async set(_ns,key,value){if(key==='physicalSceneItems'){store=value;writes++;}return value;}}};
  globalThis.canvas={scene};
  try{
    const {killNpcToken}=await import('../scripts/integrations/npc-death.js');
    const result=await killNpcToken(token);
    assert.equal(result.killed,true);assert.equal(result.groundPublished,true);
    assert.equal(result.inventory.length,0);
    assert.equal(store.sceneB.length,1);assert.equal(store.sceneB[0].data.name,'Ancient Gem');
    assert.equal(store.sceneB[0].id,'npc-tokenGround-loot00001');
    assert.ok(store.sceneB[0].x>0 && store.sceneB[0].y>0);
    await killNpcToken(token);
    assert.equal(store.sceneB.length,1);assert.equal(writes,1);
    assert.equal(document.hidden,true,'ground-only death hides the NPC only after loot is published');
  }finally{Object.assign(globalThis,prior);}
});
test('Corpse cannot transfer loot without an authenticated linked recipient',async()=>{
  const prior={game:globalThis.game,canvas:globalThis.canvas};
  const corpse={id:'corpse001',hidden:false,getFlag:()=>({killed:true,inventory:[{id:'loot001',quantity:1,data:{name:'Trophy',system:{quantity:1}}}]})};
  const scene={id:'sceneCorpse',tokens:{get:()=>corpse}};
  globalThis.game={user:{isGM:true},scenes:{get:()=>scene},actors:[],settings:{get:()=>({})}};
  globalThis.canvas={scene};
  try {
    const {takeNpcCorpseItem}=await import('../scripts/integrations/npc-death.js');
    await assert.rejects(()=>takeNpcCorpseItem({sceneId:'sceneCorpse',tokenId:'corpse001',entryId:'loot001',user:{id:'player',isGM:false}}),/linked character token/i);
    assert.equal(corpse.getFlag().inventory.length,1,'rejected attempt does not remove corpse loot');
  }finally{Object.assign(globalThis,prior);}
});
