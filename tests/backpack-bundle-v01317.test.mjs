import test from 'node:test';
import assert from 'node:assert/strict';
import {MODULE_ID,DEFAULT_SHEET_CONFIG} from '../scripts/core/constants.js';
import {invalidateSheetConfigCache} from '../scripts/core/config.js';
import {getInventoryState,getActorStorage,moveInventoryItem,wouldNestBackpackInItself} from '../scripts/core/inventory.js';
import {prepareInventoryContext} from '../scripts/apps/inventory-context.js';
import {captureBackpackContents,attachPackedContents,restoreBackpackContents,getPackedContents} from '../scripts/core/backpack-transfers.js';
import {requestPhysicalAction} from '../scripts/integrations/physical-item-transfers.js';
import {scenePhysicalItems,PHYSICAL_SCENE_STORE} from '../scripts/core/physical-items.js';

const get=(obj,path)=>String(path).split('.').reduce((x,key)=>x?.[key],obj);
const set=(obj,path,val)=>{const keys=path.split('.');let cur=obj;for(const k of keys.slice(0,-1))cur=cur[k]??={};cur[keys.at(-1)]=val;};
let counter=0;
function fixture(){
 const prior=Object.fromEntries(['game','foundry','Hooks','canvas'].map(key=>[key,globalThis[key]]));
 const cfg=structuredClone(DEFAULT_SHEET_CONFIG);
 cfg.inventory.mode='complex';cfg.inventory.complex={columns:6,rows:5,activeCells:30,autoSort:false};cfg.resources=[];
 cfg.inventory.equipmentLayout.slots.push({id:'pack-slot',type:'backpack',label:'Backpack',capacity:1,tabId:'main',x:0,y:0});
 let store={};let refuseStore=false;let refuseDelete=false;
 const items=new (class extends Map{[Symbol.iterator](){return this.values();}})();
 const bagRules={equip:{enabled:true,any:true},storage:{slots:{add:5,external:[{id:'main',columns:4,rows:3,mode:'complex',cells:[0,1,2,4,5,6,8,9,10]}]}}};
 const nestedRules={storage:{slots:{external:[{id:'inner',columns:2,rows:2,mode:'simple'}]}}};
 function doc(id,name,rules={}) {
   const flags={[MODULE_ID]:{item:rules}};
   return {id,name,flags,type:'loot',img:'icons/svg/item-bag.svg',system:{quantity:1,equipped:false},
     getFlag(ns,key){return get(this.flags[ns],key);},toObject(){return {_id:this.id,name:this.name,flags:structuredClone(this.flags),
       type:this.type,img:this.img,system:structuredClone(this.system)};}};
 }
 const bag=doc('bag','Backpack',bagRules),nested=doc('nested','Small Pouch',nestedRules),gem=doc('gem','Ruby',{}),coin=doc('coin','Coin',{});
 for(const item of [bag,nested,gem,coin])items.set(item.id,item);
 const initial={version:4,tracked:['bag','nested','gem','coin'],autoSort:false,sortMode:'alphabetic',
   placements:{bag:{area:'equipment',slotId:'pack-slot',position:0},
     nested:{area:'storage',storageId:'bag:main',index:0,rotation:0},
     gem:{area:'storage',storageId:'bag:main',index:6,rotation:0},
     coin:{area:'storage',storageId:'nested:inner',index:3,rotation:0}},equipmentActive:{'pack-slot':0}};
 const actor={id:'hero',name:'Hero',isOwner:true,items,flags:{[MODULE_ID]:{inventory:structuredClone(initial),linkedUsers:['gm']}},
   getFlag(ns,key){return get(this.flags[ns],key);},testUserPermission:()=>true,
   async update(patch){for(const [key,val] of Object.entries(patch))set(this,key,val);return this;},
   async createEmbeddedDocuments(type,datas,options={}) {assert.equal(type,'Item');return datas.map(data=>{
      const id=options.keepId && data._id ? data._id : `new${++counter}`;
      const item=doc(id,data.name,get(data,`flags.${MODULE_ID}.item`)||{});
      item.flags=structuredClone(data.flags||{});item.system=structuredClone(data.system||{quantity:1});
      items.set(id,item);return item;});},
   async deleteEmbeddedDocuments(type,ids){assert.equal(type,'Item');if(refuseDelete)throw Error('Actor refused deletion');return ids.map(id=>{const item=items.get(id);items.delete(id);return item;}).filter(Boolean);},
   async updateEmbeddedDocuments(type,patches){return patches.map(p=>{const item=items.get(p._id);if(p['system.quantity']!==undefined)item.system.quantity=p['system.quantity'];return item;});}
 };
 const scene={id:'scene',width:2000,height:2000,grid:{distance:5,size:100},tokens:{contents:[]},
   getFlag(){return []}};
 const gm={id:'gm',active:true,isGM:true};const users=[gm];users.get=id=>users.find(u=>u.id===id);
 const actors=new Map([['hero',actor]]);actors.contents=[actor];const scenes=new Map([['scene',scene]]);
 globalThis.game={user:gm,users,actors,scenes,items:new Map(),system:{id:'test'},settings:{
   get(ns,key){if(key===PHYSICAL_SCENE_STORE)return store;if(key==='physicalItemSettings')return {lootEnabled:true,lootDistance:30};return cfg;},
   async set(ns,key,value){if(refuseStore)throw Error('World storage failed');store=structuredClone(value);return store;}
 }};
 globalThis.foundry={utils:{deepClone:structuredClone,equals:(a,b)=>JSON.stringify(a)===JSON.stringify(b),
   randomID:()=>`physical${++counter}`,getProperty:get,setProperty:set,hasProperty:(o,p)=>get(o,p)!==undefined}};
 globalThis.Hooks={callAll(){}};invalidateSheetConfigCache();
 return {actor,bag,cfg,scene,original:initial,
   set refuseStore(v){refuseStore=v;},set refuseDelete(v){refuseDelete=v;},
   restore(){invalidateSheetConfigCache();for(const [k,v]of Object.entries(prior))if(v===undefined)delete globalThis[k];else globalThis[k]=v;}};
}
const act=payload=>requestPhysicalAction({sceneId:'scene',...payload});

test('unequip and reequip a filled backpack without moving its contents or retaining bonus capacity',async()=>{
 const f=fixture();try{
   assert.equal(getActorStorage(f.actor,f.cfg).additional,5);
   const result=await moveInventoryItem(f.actor,'bag',{area:'inventory',index:19},f.cfg);
   assert.equal(result?.placements?.bag?.area,'inventory');
   assert.equal(getActorStorage(f.actor,f.cfg).additional,0);
   assert.equal(getActorStorage(f.actor,f.cfg).compartments[0].storageId,'bag:main');
   assert.equal(getInventoryState(f.actor,f.cfg).placements.gem.index,6);
   assert.equal(getInventoryState(f.actor,f.cfg).placements.coin.storageId,'nested:inner');
   const back=await moveInventoryItem(f.actor,'bag',{area:'equipment',slotId:'pack-slot',position:0},f.cfg);
   assert.ok(back);assert.equal(getActorStorage(f.actor,f.cfg).additional,5);
   assert.equal(getInventoryState(f.actor,f.cfg).placements.coin.index,3);
 }finally{f.restore();}
});
test('a backpack cannot be put inside its own descendant',()=>{
 assert.equal(wouldNestBackpackInItself({pouch:{area:'storage',storageId:'bag:main'}},'bag',
   {area:'storage',storageId:'pouch:inner'}),true);
});
test('drop, move and loot a filled backpack restores nested items with same positions',async()=>{
 const f=fixture();try{
   const packed=captureBackpackContents(f.actor,'bag',f.cfg);
   assert.deepEqual(packed.map(x=>x.sourceId),['nested','coin','gem']);
   assert.equal(packed[0].providerId,'root');
   const origin=await act({action:'drop',source:'actor',actorId:'hero',itemId:'bag',quantity:1,point:{x:500,y:500}});
   assert.ok(origin.id);assert.equal(f.actor.items.size,0,'all children leave Actor with the backpack');
   assert.equal(scenePhysicalItems(f.scene).length,1);
   assert.equal(getPackedContents(scenePhysicalItems(f.scene)[0].data).length,3);
   await act({action:'move',itemId:origin.id,point:{x:700,y:600}});
   const destination=await act({action:'transfer',source:'scene',destination:'actor',itemId:origin.id,actorId:'hero',quantity:1});
   assert.ok(destination.itemId);
   assert.equal(f.actor.items.size,4);
   assert.equal(scenePhysicalItems(f.scene).length,0);
   const s=getInventoryState(f.actor,f.cfg);
   const restored=[...f.actor.items.values()];
   const newBag=restored.find(i=>i.name==='Backpack');
   const newPouch=restored.find(i=>i.name==='Small Pouch');
   const newGem=restored.find(i=>i.name==='Ruby');
   const newCoin=restored.find(i=>i.name==='Coin');
   assert.equal(s.placements[newPouch.id].storageId,`${newBag.id}:main`);
   assert.equal(s.placements[newPouch.id].index,0);
   assert.equal(s.placements[newGem.id].index,6);
   assert.equal(s.placements[newCoin.id].storageId,`${newPouch.id}:inner`);
   assert.equal(s.placements[newCoin.id].index,3);
   assert.deepEqual(getPackedContents(newBag.toObject()),[],'unpacked bag carries no stale duplicates');
 }finally{f.restore();}
});

test('three items dropped into a board chest return intact to inventory at rotations 1, 2 and 3',async()=>{
 const f=fixture();try{
   // Start with an empty chest on the board, then add three world items
   // through the same GM-authoritative path used by the board storage UI.
   const originals=['nested','gem','coin'].map(id=>f.actor.items.get(id));
   originals[1].flags[MODULE_ID].item.shape={cells:[{x:0,y:0},{x:1,y:0}]};
   for(const item of originals)f.actor.items.delete(item.id);
   const dropped=await act({action:'drop',source:'actor',actorId:'hero',itemId:'bag',quantity:1,point:{x:500,y:500}});
   assert.equal(getPackedContents(scenePhysicalItems(f.scene)[0].data).length,0);
   for(const item of originals)globalThis.game.items.set(item.id,item);
   const additions=[
     {item:originals[0],index:0,rotation:2},
     {item:originals[1],index:6,rotation:1},
     {item:originals[2],index:1,rotation:3}
   ];
   for(const {item,index,rotation} of additions){
     const result=await act({action:'container',containerId:dropped.id,direction:'import',
       source:'world',itemId:item.id,quantity:1,storageId:'root:main',index,rotation});
     assert.equal(result.stored,true);
   }
   const before=getPackedContents(scenePhysicalItems(f.scene)[0].data);
   assert.equal(before.length,3);
   assert.deepEqual(before.map(entry=>entry.rotation),[2,1,3]);
   const result=await act({action:'transfer',source:'scene',destination:'actor',
     itemId:dropped.id,actorId:'hero',quantity:1});
   assert.ok(result.itemId);
   assert.equal(scenePhysicalItems(f.scene).length,0,'confirmed pickup removes the chest from the board');
   assert.equal(f.actor.items.size,4,'the backpack and all three contents are present');
   const placements=getInventoryState(f.actor,f.cfg).placements;
   const root=[...f.actor.items].find(item=>item.name==='Backpack');
   for(const {item,index,rotation} of additions){
     const restored=[...f.actor.items].find(doc=>doc.name===item.name);
     assert.ok(restored,`${item.name} must be restored`);
     assert.deepEqual(placements[restored.id],{area:'storage',storageId:`${root.id}:main`,index,rotation});
   }
 }finally{f.restore();}
});

test('closed ground chest pickup never strands contents when saved cells later become invalid',async()=>{
 const f=fixture();try{
   const dropped=await act({action:'drop',source:'actor',actorId:'hero',itemId:'bag',quantity:1,point:{x:500,y:500}});
   const records=structuredClone(scenePhysicalItems(f.scene));
   // A previous board-session placement is now incompatible with the storage
   // shape. The chest UI is CLOSED: no viewer can repair the cells before pickup.
   const gem=records[0].data.flags[MODULE_ID].backpackContents.find(e=>e.data.name==='Ruby');
   gem.index=0; // Occupied by the nested pouch; never silently repack it.
   await globalThis.game.settings.set(MODULE_ID,PHYSICAL_SCENE_STORE,{scene:records});
   const warnings=[];const oldUi=globalThis.ui;
   globalThis.ui={notifications:{warn(message){warnings.push(message);}}};
   try{
     const result=await act({action:'transfer',source:'scene',destination:'actor',itemId:dropped.id,actorId:'hero',quantity:1});
     assert.ok(result.itemId);
     assert.equal(scenePhysicalItems(f.scene).length,0,'board source is removed only after completed restoration');
     assert.equal(f.actor.items.size,4,'all three descendants and the backpack must arrive');
     const state=getInventoryState(f.actor,f.cfg);
     const root=[...f.actor.items].find(item=>item.name==='Backpack');
     const gemDoc=[...f.actor.items].find(item=>item.name==='Ruby');
     const pouch=[...f.actor.items].find(item=>item.name==='Small Pouch');
     const coin=[...f.actor.items].find(item=>item.name==='Coin');
     assert.equal(state.placements[pouch.id].storageId,`${root.id}:main`);
     assert.equal(state.placements[coin.id].storageId,`${pouch.id}:inner`);
     assert.equal(state.placements[gemDoc.id].storageId,`${root.id}:main`,'restored item remains inside the backpack');
     assert.notEqual(state.placements[gemDoc.id].index,0,'colliding saved position is repaired only inside the chest');
     assert.ok(state.tracked.includes(gemDoc.id),'invalid child stays in Actor inventory');
     assert.deepEqual(f.actor.getFlag(MODULE_ID,'inventory').placements[gemDoc.id],
       state.placements[gemDoc.id], 'the repaired placement is persisted');
     assert.equal(warnings.length,1,'player receives a recovery notice when a genuinely conflicting slot changed');
     assert.doesNotMatch(warnings[0],/need placement in Inventory Overflow/);
     assert.equal(captureBackpackContents(f.actor,root.id,f.cfg).length,3,'repaired backpack can be transferred again');
   }finally{if(oldUi===undefined)delete globalThis.ui;else globalThis.ui=oldUi;}
 }finally{f.restore();}
});

test('invalid closed-chest footprint outside a shaped compartment still preserves every Item',async()=>{
 const f=fixture();try{
   const dropped=await act({action:'drop',source:'actor',actorId:'hero',itemId:'bag',quantity:1,point:{x:500,y:500}});
   const records=structuredClone(scenePhysicalItems(f.scene));
   records[0].data.flags[MODULE_ID].backpackContents.find(e=>e.data.name==='Ruby').index=11;
   await globalThis.game.settings.set(MODULE_ID,PHYSICAL_SCENE_STORE,{scene:records});
   await act({action:'transfer',source:'scene',destination:'actor',itemId:dropped.id,actorId:'hero',quantity:1});
   const ruby=[...f.actor.items].find(item=>item.name==='Ruby');
   assert.equal(f.actor.items.size,4);
   assert.ok(getInventoryState(f.actor,f.cfg).tracked.includes(ruby.id));
   assert.equal(getInventoryState(f.actor,f.cfg).placements[ruby.id].area,'storage');
   assert.equal(captureBackpackContents(f.actor,[...f.actor.items].find(item=>item.name==='Backpack').id,f.cfg).length,3);
 }finally{f.restore();}
});

test('invalid board container rotations are rejected without consuming source, and retry succeeds',async()=>{
 const f=fixture();try{
   f.actor.flags[MODULE_ID].inventory.placements.gem.rotation=1;
   const dropped=await act({action:'drop',source:'actor',actorId:'hero',itemId:'bag',quantity:1,point:{x:500,y:500}});
   const records=structuredClone(scenePhysicalItems(f.scene));
   const entry=records[0].data.flags[MODULE_ID].backpackContents.find(child=>child.data.name==='Ruby');
   assert.ok(entry);
   entry.rotation=90; // Invalid for this schema: stored rotations are 0..3.
   await globalThis.game.settings.set(MODULE_ID,PHYSICAL_SCENE_STORE,{scene:records});
   await assert.rejects(act({action:'transfer',source:'scene',destination:'actor',itemId:dropped.id,
     actorId:'hero',quantity:1}),/Invalid backpack contents metadata/i);
   assert.equal(f.actor.items.size,0,'destination changes must be rolled back');
   assert.equal(scenePhysicalItems(f.scene).length,1,'scene remains authoritative on failure');
   assert.equal(getPackedContents(scenePhysicalItems(f.scene)[0].data).length,3);
   entry.rotation=1;
   await globalThis.game.settings.set(MODULE_ID,PHYSICAL_SCENE_STORE,{scene:records});
   await act({action:'transfer',source:'scene',destination:'actor',itemId:dropped.id,
     actorId:'hero',quantity:1});
   assert.equal(f.actor.items.size,4);
   assert.equal(scenePhysicalItems(f.scene).length,0);
 }finally{f.restore();}
});

test('failed scene write leaves backpack and contents untouched',async()=>{
 const f=fixture();try{
   f.refuseStore=true;
   await assert.rejects(act({action:'drop',source:'actor',actorId:'hero',itemId:'bag',quantity:1,point:{x:500,y:500}}),/World storage failed/);
   assert.equal(f.actor.items.size,4);
   assert.equal(scenePhysicalItems(f.scene).length,0);
 }finally{f.restore();}
});
test('failed source deletion restores no extra scene backpack or children',async()=>{
 const f=fixture();try{
   f.refuseDelete=true;
   await assert.rejects(act({action:'drop',source:'actor',actorId:'hero',itemId:'bag',quantity:1,point:{x:500,y:500}}),/Actor refused deletion/);
   assert.equal(f.actor.items.size,4);
   assert.equal(scenePhysicalItems(f.scene).length,0);
 }finally{f.restore();}
});

test('a filled backpack cannot be split during pickup or cross-surface transfers',async()=>{
 const f=fixture();try{
   await act({action:'drop',source:'actor',actorId:'hero',itemId:'bag',quantity:1,point:{x:500,y:500}});
   const entry=scenePhysicalItems(f.scene)[0];
   // If corrupt quantity data arrives, a partial transfer must not clone the contents.
   const records=structuredClone(scenePhysicalItems(f.scene));
   records[0].quantity=2;records[0].data.system.quantity=2;
   await globalThis.game.settings.set(MODULE_ID,PHYSICAL_SCENE_STORE,{scene:records});
   await assert.rejects(act({action:'transfer',source:'scene',destination:'actor',itemId:entry.id,
     actorId:'hero',quantity:1}),/filled backpack/i);
   assert.equal(f.actor.items.size,0);
   assert.equal(scenePhysicalItems(f.scene)[0].quantity,2);
 }finally{f.restore();}
});


test('stale removed child placements cannot falsely trap an empty backpack during DROP',async()=>{
 const f=fixture();try{
   const raw=f.actor.flags[MODULE_ID].inventory;
   // The screenshot's failure occurs when a deleted Item leaves its old
   // storage coordinates in flags, even though the compartment is empty.
   f.actor.items.delete('gem');f.actor.items.delete('coin');f.actor.items.delete('nested');
   assert.ok(raw.placements.gem,'simulate surviving old placement');
   assert.deepEqual(captureBackpackContents(f.actor,'bag',f.cfg),[]);
   const sceneItem=await act({action:'drop',source:'actor',actorId:'hero',itemId:'bag',quantity:1,point:{x:500,y:500}});
   assert.ok(sceneItem.id);
   assert.equal(f.actor.items.has('bag'),false);
   assert.equal(scenePhysicalItems(f.scene).length,1);
   assert.deepEqual(getPackedContents(scenePhysicalItems(f.scene)[0].data),[]);
 }finally{f.restore();}
});

test('live descendants behind missing intermediate parents still block unsafe drops',()=>{
 const f=fixture();try{
   // Only the nested backpack document vanished; a real coin still depends
   // on it. The coin cannot safely be repacked without its parent.
   f.actor.items.delete('nested');
   assert.throws(()=>captureBackpackContents(f.actor,'bag',f.cfg),/could not be safely packed/);
   assert.equal(f.actor.items.has('coin'),true);
 }finally{f.restore();}
});

test('unequipped backpack storage is saved but not rendered as open equipment',async()=>{
 const f=fixture();try{
   const equipped=prepareInventoryContext(f.actor,f.cfg,true);
   assert.deepEqual(equipped.externalStorage.map(entry=>entry.storageId),['bag:main','nested:inner']);
   assert.equal(equipped.hasExternalStorage,true);
   const result=await moveInventoryItem(f.actor,'bag',{area:'inventory',index:19},f.cfg);
   assert.ok(result);
   const stored=getInventoryState(f.actor,f.cfg).placements;
   assert.equal(stored.gem.storageId,'bag:main');
   assert.equal(stored.coin.storageId,'nested:inner');
   assert.deepEqual(prepareInventoryContext(f.actor,f.cfg,true).externalStorage,[]);
   assert.equal(prepareInventoryContext(f.actor,f.cfg,true).hasExternalStorage,false);
   await moveInventoryItem(f.actor,'bag',{area:'equipment',slotId:'pack-slot',position:0},f.cfg);
   const again=prepareInventoryContext(f.actor,f.cfg,true);
   assert.deepEqual(again.externalStorage.map(entry=>entry.storageId),['bag:main','nested:inner']);
   assert.equal(again.externalStorage.find(entry=>entry.storageId==='bag:main').items.length,2);
 }finally{f.restore();}
});

test('round-trip valid shaped and rotated ground loot preserves cells instead of overflowing',async()=>{
 const f=fixture();try {
   // Start from a freshly emptied 4x3 shaped chest: valid cells are 0,1,2,4,5,6,8,9,10.
   for(const id of ['nested','gem','coin'])f.actor.items.delete(id);
   f.actor.flags[MODULE_ID].inventory.tracked=['bag'];
   f.actor.flags[MODULE_ID].inventory.placements={bag:{area:'inventory',index:0}};
   const placed=await act({action:'drop',source:'actor',actorId:'hero',itemId:'bag',quantity:1,point:{x:500,y:500}});
   const make=(id,shape)=>({id,name:id,flags:{[MODULE_ID]:{item:{shape:{cells:shape}}}},system:{quantity:1},type:'loot',img:'icons/svg/sword.svg',
     getFlag(ns,key){return this.flags[ns]?.[key];},toObject(){return {_id:this.id,name:this.name,flags:structuredClone(this.flags),type:this.type,img:this.img,system:structuredClone(this.system)};}});
   const items=[make('axe1',[{x:0,y:0},{x:0,y:1},{x:0,y:2}]),make('axe2',[{x:0,y:0},{x:0,y:1},{x:0,y:2}])];
   for(const item of items)game.items.set(item.id,item);
   const poses=[{index:0,rotation:0},{index:1,rotation:0}];
   for(let i=0;i<items.length;i++){
     await act({action:'container',direction:'import',containerId:placed.id,source:'world',itemId:items[i].id,
       quantity:1,storageId:'root:main',...poses[i]});
   }
   const warn=[];const oldUi=globalThis.ui;globalThis.ui={notifications:{warn:t=>warn.push(t)}};
   try{
     const result=await act({action:'transfer',source:'scene',destination:'actor',itemId:placed.id,actorId:'hero',quantity:1});
     assert.ok(result.itemId);const root=[...f.actor.items].find(x=>x.name==='Backpack');
     const state=getInventoryState(f.actor,f.cfg);
     for(let i=0;i<items.length;i++){
       const child=[...f.actor.items].find(x=>x.name===items[i].name);
       assert.deepEqual(state.placements[child.id],{area:'storage',storageId:`${root.id}:main`,index:poses[i].index,rotation:poses[i].rotation});
     }
     assert.deepEqual(warn,[]);
   }finally{globalThis.ui=oldUi;}
 }finally{f.restore();}
});

test('fuzz varied connected multi-cell shapes deposited in a chest all remain contained after pickup',async()=>{
 const shapes=[[[0,0]],[[0,0],[0,1]],[[0,0],[0,1],[0,2]],[[0,0],[1,0]],[[0,0],[1,0],[1,1]],[[0,0],[0,1],[1,1]],[[0,0],[1,0],[2,0]],[[0,0],[1,0],[0,1],[1,1]]];
 for(let trial=0;trial<20;trial++){
  const f=fixture();try{
   for(const id of ['nested','gem','coin'])f.actor.items.delete(id);
   f.actor.flags[MODULE_ID].inventory.tracked=['bag'];f.actor.flags[MODULE_ID].inventory.placements={bag:{area:'inventory',index:0}};
   const dropped=await act({action:'drop',source:'actor',actorId:'hero',itemId:'bag',quantity:1,point:{x:500,y:500}});
   const expected=[];
   for(let i=0;i<8;i++){
    const id=`item-${trial}-${i}`,shape=shapes[(trial*3+i*7)%shapes.length].map(([x,y])=>({x,y}));
    const item={id,name:id,flags:{[MODULE_ID]:{item:{shape:{cells:shape}}}},system:{quantity:1},type:'loot',img:'icons/svg/sword.svg',
      getFlag(ns,key){return this.flags[ns]?.[key];},toObject(){return {_id:this.id,name:this.name,flags:structuredClone(this.flags),type:this.type,img:this.img,system:structuredClone(this.system)};}};
    game.items.set(id,item);
    try{await act({action:'container',direction:'import',containerId:dropped.id,source:'world',itemId:id,
      quantity:1,rotation:(i+trial)%4});expected.push(id);}catch(error){if(!/full|fit/i.test(error.message))throw error;}
   }
   const warnings=[];const oldUi=globalThis.ui;globalThis.ui={notifications:{warn:t=>warnings.push(t)}};
   try{
    await act({action:'transfer',source:'scene',destination:'actor',itemId:dropped.id,actorId:'hero',quantity:1});
    const state=getInventoryState(f.actor,f.cfg);
    const failed=expected.filter(name=>{const item=[...f.actor.items].find(x=>x.name===name);return !state.placements[item?.id]||state.placements[item.id].area!=='storage';});
    assert.deepEqual(failed,[],`trial ${trial} displaced ${failed.join(', ')}`);
    assert.deepEqual(warnings,[],`trial ${trial} warnings`);
   }finally{globalThis.ui=oldUi;}
  }finally{f.restore();}
 }
});


test('complex inventory permits non-overlapping multi-cell shapes with the same bounding origin',()=>{
 const f=fixture();try{
   const l=f.actor.items.get('gem'),coin=f.actor.items.get('coin');
   l.flags[MODULE_ID].item.shape={cells:[{x:0,y:1},{x:1,y:0},{x:1,y:1}]};
   const state=f.actor.flags[MODULE_ID].inventory;
   state.tracked=['gem','coin'];
   state.placements={gem:{area:'inventory',index:0,rotation:0},coin:{area:'inventory',index:0,rotation:0}};
   const actual=getInventoryState(f.actor,f.cfg);
   assert.deepEqual(actual.placements.gem,{area:'inventory',index:0});
   assert.deepEqual(actual.placements.coin,{area:'inventory',index:0},'same origin is safe when their occupied cells differ');
 }finally{f.restore();}
});

test('complex external compartment permits adjacent shapes sharing an empty bounding origin',()=>{
 const f=fixture();try{
   const l=f.actor.items.get('nested'),gem=f.actor.items.get('gem');
   l.flags[MODULE_ID].item.shape={cells:[{x:0,y:1},{x:1,y:0},{x:1,y:1}]};
   const state=f.actor.flags[MODULE_ID].inventory;
   state.tracked=['bag','nested','gem'];
   state.placements={bag:{area:'inventory',index:0},nested:{area:'storage',storageId:'bag:main',index:0,rotation:0},gem:{area:'storage',storageId:'bag:main',index:0,rotation:0}};
   const actual=getInventoryState(f.actor,f.cfg);
   assert.equal(actual.placements.nested.index,0);
   assert.equal(actual.placements.gem.index,0,'no collision at the unused top-left of an L');
 }finally{f.restore();}
});

test('preexisting v0.13.46 overflow child is repaired inside its chest before the owner drops the chest',async()=>{
 const f=fixture();try {
   const initial=f.actor.getFlag(MODULE_ID,'inventory');
   initial.placements.gem.index=0; // Conflict with the pouch occupying this cell.
   assert.equal(getInventoryState(f.actor,f.cfg).placements.gem,undefined,'reproduce the previous Overflow state');
   const result=await act({action:'drop',source:'actor',actorId:'hero',itemId:'bag',quantity:1,point:{x:500,y:500}});
   assert.ok(result.id,'the chest can be moved again without a needs-repair error');
   assert.equal(f.actor.items.size,0);
   const packed=getPackedContents(scenePhysicalItems(f.scene)[0].data);
   assert.equal(packed.length,3,'the previously overflowing gem is not left behind');
   assert.notEqual(packed.find(child=>child.data.name==='Ruby').index,0);
   await act({action:'transfer',source:'scene',destination:'actor',itemId:result.id,actorId:'hero',quantity:1});
   const chest=[...f.actor.items].find(item=>item.name==='Backpack');
   const ruby=[...f.actor.items].find(item=>item.name==='Ruby');
   assert.equal(getInventoryState(f.actor,f.cfg).placements[ruby.id].area,'storage');
   assert.equal(captureBackpackContents(f.actor,chest.id,f.cfg).length,3);
   const moved=await moveInventoryItem(f.actor,chest.id,{area:'inventory',index:19},f.cfg);
   assert.ok(moved,'the restored chest can still be repositioned in the Actor inventory');
 }finally{f.restore();}
});

test('no valid chest location causes closed pickup rollback rather than placing a child in Overflow',async()=>{
 const f=fixture();try {
   const placed=await act({action:'drop',source:'actor',actorId:'hero',itemId:'bag',quantity:1,point:{x:500,y:500}});
   const records=structuredClone(scenePhysicalItems(f.scene));
   const gem=records[0].data.flags[MODULE_ID].backpackContents.find(child=>child.data.name==='Ruby');
   gem.data.flags[MODULE_ID].item.shape={cells:[{x:0,y:0},{x:1,y:0},{x:2,y:0},{x:3,y:0},{x:4,y:0}]};
   await game.settings.set(MODULE_ID,PHYSICAL_SCENE_STORE,{scene:records});
   await assert.rejects(act({action:'transfer',source:'scene',destination:'actor',itemId:placed.id,
     actorId:'hero',quantity:1}),/original compartment/i);
   assert.equal(f.actor.items.size,0,'no half-restored items remain in Actor Overflow');
   assert.equal(scenePhysicalItems(f.scene).length,1,'the source chest remains on the board');
   assert.equal(getPackedContents(scenePhysicalItems(f.scene)[0].data).length,3,'the three original items remain in the chest');
 }finally{f.restore();}
});


test('closed chest pickup preserves four tightly packed shapes including a masked-out origin',async()=>{
 const f=fixture();try {
   // The ground chest renders/accepts occupied squares even when a bounding
   // origin (0) is intentionally outside the compartment's allowed mask.
   const slot=f.bag.flags[MODULE_ID].item.storage.slots.external[0];
   slot.columns=5;slot.rows=4;slot.cells=Array.from({length:19},(_,i)=>i+1);
   for(const id of ['nested','gem','coin'])f.actor.items.delete(id);
   f.actor.flags[MODULE_ID].inventory.tracked=['bag'];
   f.actor.flags[MODULE_ID].inventory.placements={bag:{area:'inventory',index:0}};
   const dropped=await act({action:'drop',source:'actor',actorId:'hero',itemId:'bag',quantity:1,point:{x:500,y:500}});
   const itemSpecs=[
     {name:'Lumberjack Axe',index:0,cells:[{x:1,y:0},{x:0,y:1},{x:1,y:1}]},
     {name:'Demon Killer Sword',index:3,cells:[{x:0,y:0},{x:0,y:1},{x:0,y:2},{x:0,y:3}]},
     {name:'Golden Gloves',index:10,cells:[{x:0,y:0},{x:0,y:1}]},
     {name:'Second Axe',index:2,cells:[{x:0,y:0},{x:0,y:1},{x:0,y:2},{x:0,y:3}]}
   ];
   for(const [i,spec] of itemSpecs.entries()) {
     const data={id:`item-source-${i}`,name:spec.name,type:'loot',img:'icons/svg/axe.svg',system:{quantity:1},
       flags:{[MODULE_ID]:{item:{shape:{cells:spec.cells}}}},
       getFlag(ns,key){return this.flags[ns]?.[key];},toObject(){return {_id:this.id,name:this.name,type:this.type,img:this.img,system:structuredClone(this.system),flags:structuredClone(this.flags)};}};
     game.items.set(data.id,data);
     await act({action:'container',direction:'import',containerId:dropped.id,source:'world',itemId:data.id,
       quantity:1,storageId:'root:main',index:spec.index,rotation:0});
   }
   const closed=scenePhysicalItems(f.scene)[0];
   const packed=getPackedContents(closed.data);
   assert.equal(packed.length,4);
   assert.deepEqual(packed.map(entry=>entry.index),itemSpecs.map(spec=>spec.index));
   const returned=await act({action:'transfer',source:'scene',destination:'actor',itemId:dropped.id,actorId:'hero',quantity:1});
   assert.ok(returned.itemId);
   assert.equal(scenePhysicalItems(f.scene).length,0);
   const chest=[...f.actor.items].find(x=>x.name==='Backpack');
   for(const spec of itemSpecs){
     const child=[...f.actor.items].find(x=>x.name===spec.name);
     assert.deepEqual(getInventoryState(f.actor,f.cfg).placements[child.id],
       {area:'storage',storageId:`${chest.id}:main`,index:spec.index,rotation:0},spec.name);
   }
   assert.equal(captureBackpackContents(f.actor,chest.id,f.cfg).length,4);
   assert.ok(await moveInventoryItem(f.actor,chest.id,{area:'inventory',index:18},f.cfg));
 }finally{f.restore();}
});

test('closed chest saves placements BEFORE creating children; no post-create Actor update',async()=>{
 const f=fixture();try{
   const dropped=await act({action:'drop',source:'actor',actorId:'hero',itemId:'bag',quantity:1,point:{x:500,y:500}});
   const records=structuredClone(scenePhysicalItems(f.scene));
   // Reproduce the REAL Foundry error: ANY Actor.update after a contained Item
   // has been created is rejected by the Actor embedded-document backend.
   records[0].data.flags[MODULE_ID].backpackContents.find(e=>e.data.name==='Ruby').index=0;
   await globalThis.game.settings.set(MODULE_ID,PHYSICAL_SCENE_STORE,{scene:records});
   const originalCreate=f.actor.createEmbeddedDocuments.bind(f.actor);
   const originalUpdate=f.actor.update.bind(f.actor);
   let restoring=false,postRestoreWrites=0,stagedWrites=0;
   f.actor.createEmbeddedDocuments=async (type,docs,options)=>{
     if(docs.some(e=>e.name==='Ruby'||e.name==='Coin')) {
       restoring=true;
       assert.equal(options.keepId,true,'child IDs must match the pre-saved placements');
       for(const data of docs)assert.ok(f.actor.getFlag(MODULE_ID,'inventory').tracked.includes(data._id),
         'storage location committed before creating Item documents');
     }
     return originalCreate(type,docs,options);
   };
   f.actor.update=async (patch,options)=>{
     if(patch[`flags.${MODULE_ID}.inventory`]?.tracked?.length>1)stagedWrites++;
     if(restoring && patch[`flags.${MODULE_ID}.inventory`]){
       postRestoreWrites++;
       throw Error('Actor is not a valid embedded Document within the Actor Document');
     }
     return originalUpdate(patch,options);
   };
   const result=await act({action:'transfer',source:'scene',destination:'actor',itemId:dropped.id,actorId:'hero',quantity:1});
   assert.ok(result.itemId);
   assert.equal(postRestoreWrites,0,'no Actor writes may occur after contained Item creation');
   assert.equal(stagedWrites,1,'one placement write must occur before child creation');
   assert.equal(f.actor.items.size,4);
   assert.equal(scenePhysicalItems(f.scene).length,0);
   const root=[...f.actor.items].find(e=>e.name==='Backpack');
   assert.equal(captureBackpackContents(f.actor,root.id,f.cfg).length,3);
 }finally{f.restore();}
});

test('a rejected pre-creation Actor flag update leaves the closed ground chest and contents intact',async()=>{
 const f=fixture();try{
   const dropped=await act({action:'drop',source:'actor',actorId:'hero',itemId:'bag',quantity:1,point:{x:500,y:500}});
   const originals=structuredClone(scenePhysicalItems(f.scene));
   const originalCreate=f.actor.createEmbeddedDocuments.bind(f.actor);
   const originalUpdate=f.actor.update.bind(f.actor);
   let childCreationAttempts=0;
   f.actor.createEmbeddedDocuments=async(type,docs,options)=>{
     if(docs.some(e=>e.name==='Ruby'||e.name==='Coin'))childCreationAttempts++;
     return originalCreate(type,docs,options);
   };
   f.actor.update=async(patch,options)=>{
     if(patch[`flags.${MODULE_ID}.inventory`]?.tracked?.length>1)throw Error('Actor update rejected');
     return originalUpdate(patch,options);
   };
   await assert.rejects(act({action:'transfer',source:'scene',destination:'actor',itemId:dropped.id,
     actorId:'hero',quantity:1}),/Actor update rejected/);
   assert.equal(childCreationAttempts,0,'failed flag write prevents all child document creations');
   assert.equal(f.actor.items.size,0,'new backpack and all children rolled back');
   assert.deepEqual(scenePhysicalItems(f.scene),originals,'no scene contents are consumed before confirmed restoration');
 }finally{f.restore();}
});

test('partial nested child creation failure removes children and staged placement flags',async()=>{
 const f=fixture();try{
   const dropped=await act({action:'drop',source:'actor',actorId:'hero',itemId:'bag',quantity:1,point:{x:500,y:500}});
   const savedScene=structuredClone(scenePhysicalItems(f.scene));
   const previous=f.actor.createEmbeddedDocuments.bind(f.actor);
   f.actor.createEmbeddedDocuments=async(type,docs,options)=>{
     if(docs.some(e=>e.name==='Coin'))throw Error('Nested child creation failed');
     return previous(type,docs,options);
   };
   await assert.rejects(act({action:'transfer',source:'scene',destination:'actor',itemId:dropped.id,
     actorId:'hero',quantity:1}),/Nested child creation failed/);
   assert.equal(f.actor.items.size,0,'root and partial children were removed');
   assert.deepEqual(scenePhysicalItems(f.scene),savedScene,'ground source remains unchanged');
   assert.deepEqual([...f.actor.items.values()].map(i=>i.name),[],
     'no newly created child items remain after rollback');
   assert.deepEqual(Object.keys(f.actor.getFlag(MODULE_ID,'inventory').placements||{}).sort(),
     Object.keys(f.actor.flags[MODULE_ID].inventory.placements||{}).sort());
 }finally{f.restore();}
});

test('closed-chest pickup writes all placements before creating the ROOT Item, regardless of UI state',async()=>{
 const f=fixture();try{
   const dropped=await act({action:'drop',source:'actor',actorId:'hero',itemId:'bag',quantity:1,point:{x:500,y:500}});
   let rootCreated=false, writeCount=0;
   const update=f.actor.update.bind(f.actor),create=f.actor.createEmbeddedDocuments.bind(f.actor);
   f.actor.update=async(patch,opts)=>{
     if(patch[`flags.${MODULE_ID}.inventory`]){
       assert.equal(rootCreated,false,
         'Foundry rejects Actor flag writes once the destination chest root exists');
       writeCount++;
     }
     return update(patch,opts);
   };
   f.actor.createEmbeddedDocuments=async(type,docs,opts)=>{
     if(docs.some(d=>d.name==='Backpack')){
       assert.ok(writeCount>0,'chest positions are saved before its Item document exists');
       assert.ok(f.actor.getFlag(MODULE_ID,'inventory').tracked.length>=4);
       rootCreated=true;
     }
     return create(type,docs,opts);
   };
   const result=await act({action:'transfer',source:'scene',destination:'actor',itemId:dropped.id,actorId:'hero',quantity:1});
   assert.ok(result.itemId);
   assert.equal(f.actor.items.size,4);
   assert.equal(scenePhysicalItems(f.scene).length,0);
   const root=[...f.actor.items].find(i=>i.name==='Backpack');
   assert.equal(captureBackpackContents(f.actor,root.id,f.cfg).length,3);
 }finally{f.restore();}
});

test('pre-root Actor update rejection cannot consume a board chest or create contents',async()=>{
 const f=fixture();try{
   const dropped=await act({action:'drop',source:'actor',actorId:'hero',itemId:'bag',quantity:1,point:{x:500,y:500}});
   const before=structuredClone(scenePhysicalItems(f.scene));
   const update=f.actor.update.bind(f.actor);
   f.actor.update=async(patch,opts)=>{
     if((patch[`flags.${MODULE_ID}.inventory`]?.tracked?.length||0)>1)
       throw Error('Actor is not a valid embedded Document within the Actor Document');
     return update(patch,opts);
   };
   await assert.rejects(act({action:'transfer',source:'scene',destination:'actor',
     itemId:dropped.id,actorId:'hero',quantity:1}),/Actor is not a valid embedded Document/);
   assert.equal(f.actor.items.size,0);
   assert.deepEqual(scenePhysicalItems(f.scene),before);
 }finally{f.restore();}
});

test('second closed-chest pickup survives Foundry mutating embedded Item operation options',async()=>{
 const f=fixture();let contaminated=null;
 try {
   const ground1=await act({action:'drop',source:'actor',actorId:'hero',itemId:'bag',quantity:1,point:{x:500,y:500}});
   await act({action:'transfer',source:'scene',destination:'actor',itemId:ground1.id,actorId:'hero',quantity:1});
   const restored=[...f.actor.items].find(item=>item.name==='Backpack');
   assert.ok(restored,'first pickup succeeded');
   // Foundry's embedded document backend can add its parent context to the
   // options passed into deleteEmbeddedDocuments. That object must NOT be
   // reused for the subsequent Actor.update when picking up the crate again.
   const originalDelete=f.actor.deleteEmbeddedDocuments.bind(f.actor);
   f.actor.deleteEmbeddedDocuments=async(type,ids,options={})=>{
     options.parent=f.actor;
     contaminated=options;
     return originalDelete(type,ids,options);
   };
   const originalUpdate=f.actor.update.bind(f.actor);
   f.actor.update=async(patch,options={})=>{
     if(options.parent===f.actor)throw Error('Actor is not a valid embedded Document within the Actor Document');
     return originalUpdate(patch,options);
   };
   const ground2=await act({action:'drop',source:'actor',actorId:'hero',itemId:restored.id,quantity:1,point:{x:580,y:580}});
   assert.equal(f.actor.items.size,0);
   const before=getPackedContents(scenePhysicalItems(f.scene)[0].data);
   assert.equal(before.length,3);
   const pickup=await act({action:'transfer',source:'scene',destination:'actor',itemId:ground2.id,actorId:'hero',quantity:1});
   assert.ok(pickup.itemId);
   assert.equal(f.actor.items.size,4);
   const second=[...f.actor.items].find(item=>item.name==='Backpack');
   assert.equal(captureBackpackContents(f.actor,second.id,f.cfg).length,3);
   assert.equal(scenePhysicalItems(f.scene).length,0);
 }finally {
   if(contaminated){delete contaminated.parent;delete contaminated.pack;}
   f.restore();
 }
});

test('three complete backpack round trips preserve nested contents when every embedded operation adds parent context',async()=>{
 const f=fixture();
 try{
   const update=f.actor.update.bind(f.actor);
   f.actor.update=async(patch,opts={})=>{
     if(opts.parent || opts.pack)throw Error('Actor is not a valid embedded Document within the Actor Document');
     return update(patch,opts);
   };
   const remove=f.actor.deleteEmbeddedDocuments.bind(f.actor);
   f.actor.deleteEmbeddedDocuments=async(kind,ids,opts={})=>{
     opts.parent=f.actor;opts.pack='injected-by-foundry';
     return remove(kind,ids,opts);
   };
   const create=f.actor.createEmbeddedDocuments.bind(f.actor);
   f.actor.createEmbeddedDocuments=async(kind,docs,opts={})=>{
     const results=await create(kind,docs,opts);
     opts.parent=f.actor;opts.pack='injected-by-foundry';
     return results;
   };
   let rootId='bag';
   for(let i=0;i<3;i++){
     const dropped=await act({action:'drop',source:'actor',actorId:'hero',itemId:rootId,quantity:1,point:{x:400+40*i,y:480}});
     const packed=getPackedContents(scenePhysicalItems(f.scene)[0].data);
     assert.equal(packed.length,3,`cycle ${i+1} kept all three nested items on the board`);
     assert.equal(f.actor.items.size,0,`cycle ${i+1} removed all sources`);
     await act({action:'transfer',source:'scene',destination:'actor',itemId:dropped.id,actorId:'hero',quantity:1});
     const root=[...f.actor.items].find(item=>item.name==='Backpack');
     assert.ok(root,`cycle ${i+1} restored the root`);
     assert.equal(captureBackpackContents(f.actor,root.id,f.cfg).length,3,`cycle ${i+1} kept nested contents`);
     assert.equal(scenePhysicalItems(f.scene).length,0,`cycle ${i+1} removed the ground chest`);
     rootId=root.id;
   }
 }finally{f.restore();}
});
