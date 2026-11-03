import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inventoryPickupBoard } from '../scripts/core/inventory-pickup-target.js';
import { quickDropPoint } from '../scripts/core/physical-quick-drop.js';
import { instantDropInventoryItem } from '../scripts/apps/item-context-menu.js';
import { MODULE_ID, DEFAULT_SHEET_CONFIG } from '../scripts/core/constants.js';
import { invalidateSheetConfigCache } from '../scripts/core/config.js';
import { getInventoryState, getFreeInventorySlotIndex, moveInventoryItem } from '../scripts/core/inventory.js';
import { scenePhysicalItems, PHYSICAL_SCENE_STORE } from '../scripts/core/physical-items.js';

const source=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const get=(o,p)=>String(p).split('.').reduce((s,k)=>s?.[k],o);
const set=(o,p,v)=>{const keys=p.split('.');let node=o;for(const k of keys.slice(0,-1))node=node[k]??={};node[keys.at(-1)]=v;};
function setup(){
  const prior=Object.fromEntries(['game','foundry','Hooks'].map(k=>[k,globalThis[k]]));
  const cfg=structuredClone(DEFAULT_SHEET_CONFIG);
  cfg.inventory.mode='complex';cfg.inventory.complex={columns:6,rows:5,activeCells:30,autoSort:false};cfg.resources=[];
  cfg.inventory.equipmentLayout.slots.push({id:'pack-slot',type:'backpack',label:'Backpack',capacity:1,tabId:'main',x:0,y:0});
  let store={};
  const item={id:'bag',name:'Packed Bag',type:'loot',img:'icons/svg/item-bag.svg',system:{quantity:1,equipped:true},
    flags:{[MODULE_ID]:{item:{equip:{enabled:true,any:true},storage:{slots:{external:[{id:'pouch',columns:3,rows:3,mode:'simple'}]}}}}},
    getFlag(ns,key){return get(this.flags[ns],key);},toObject(){return {_id:this.id,name:this.name,type:this.type,img:this.img,system:structuredClone(this.system),flags:structuredClone(this.flags)}}};
  const child={id:'gem',name:'Gem',type:'loot',img:'icons/svg/item-bag.svg',system:{quantity:1},flags:{[MODULE_ID]:{item:{}}},
    getFlag(ns,key){return get(this.flags[ns],key);},toObject(){return {_id:this.id,name:this.name,type:this.type,img:this.img,system:structuredClone(this.system),flags:structuredClone(this.flags)}}};
  const items=new Map([['bag',item],['gem',child]]);
  items[Symbol.iterator]=function*(){yield* this.values();};
  const actor={id:'hero',isOwner:true,items,flags:{[MODULE_ID]:{linkedUsers:['gm'],inventory:{version:4,tracked:['bag','gem'],autoSort:false,
    placements:{bag:{area:'equipment',slotId:'pack-slot',position:0},gem:{area:'storage',storageId:'bag:pouch',index:4,rotation:0}},equipmentActive:{'pack-slot':0}}}},
    getFlag(ns,k){return get(this.flags[ns],k);},testUserPermission(){return true;},
    async update(patch){for(const [k,v] of Object.entries(patch))set(this,k,v);return this;},
    async deleteEmbeddedDocuments(kind,ids){assert.equal(kind,'Item');return ids.map(id=>{const existing=items.get(id);items.delete(id);return existing;}).filter(Boolean)}
  };
  const scene={id:'scene',width:1800,height:1800,grid:{distance:5,size:100},tokens:{contents:[{id:'token',actorId:'hero',x:400,y:400,width:1,height:1,hidden:false}]},getFlag(){return []}};
  const user={id:'gm',active:true,isGM:true};const users=[user];users.get=id=>users.find(u=>u.id===id);
  const actors=new Map([['hero',actor]]);actors.contents=[actor];const scenes=new Map([['scene',scene]]);
  globalThis.game={user,users,actors,scenes,settings:{get(ns,key){if(key===PHYSICAL_SCENE_STORE)return store;if(key==='physicalItemSettings')return {playerDropRangeEnabled:true,dropDistance:10};return cfg;},
    async set(ns,key,value){store=structuredClone(value);return store;}}};
  globalThis.foundry={utils:{deepClone:structuredClone,randomID:()=>`drop-id-${Math.random()}`,equals:(a,b)=>JSON.stringify(a)===JSON.stringify(b),getProperty:get,setProperty:set}};
  globalThis.Hooks={callAll(){}};invalidateSheetConfigCache();
  return {actor,item,child,scene,user,cfg,restore(){invalidateSheetConfigCache();for(const [k,v] of Object.entries(prior))if(v===undefined)delete globalThis[k];else globalThis[k]=v;}};
}

test('equipment pickup uses only the source element grid, not a different inventory board',()=>{
  const unrelated={id:'inventory-board'};
  const equipmentItem={closest(sel){return null;}};
  assert.equal(inventoryPickupBoard(equipmentItem),null);
  const backpackBoard={id:'pouch-board'};
  const pouchItem={closest(sel){return sel==='[data-storage-board]'?backpackBoard:null;}};
  assert.equal(inventoryPickupBoard(pouchItem),backpackBoard);
  const complexItem={closest(sel){return sel==='[data-complex-board]'?unrelated:null;}};
  assert.equal(inventoryPickupBoard(complexItem),unrelated);
  assert.doesNotMatch(source('scripts/apps/inventory-controls.js'),/sourceIsStorage\s*\?\s*element\.closest\('\[data-storage-board\]'\)\s*:\s*root\.querySelector\('\[data-complex-board\]'\)/);
});

test('quick DROP chooses an in-scene point beside the source actor token, respecting 10 ft range',()=>{
  const f=setup();try{
    const point=quickDropPoint({actor:f.actor,scene:f.scene,user:{id:'gm',isGM:false},
      actors:[f.actor],tokens:f.scene.tokens.contents,settings:{playerDropRangeEnabled:true,dropDistance:10}});
    assert.deepEqual(point,{x:540,y:450});
    assert.equal(quickDropPoint({actor:f.actor,scene:f.scene,user:{id:'gm',isGM:false},
      actors:[f.actor],tokens:f.scene.tokens.contents,settings:{playerDropRangeEnabled:true,dropDistance:0}})?.x,450);
  }finally{f.restore();}
});

test('unequipping a filled backpack preserves the compartment and exact child cell',async()=>{
  const f=setup();try{
    const index=getFreeInventorySlotIndex(f.actor,f.cfg,'bag');
    assert.notEqual(index,null);
    const result=await moveInventoryItem(f.actor,'bag',{area:'inventory',index},f.cfg);
    assert.ok(result,'backpack must leave equipment');
    const placements=getInventoryState(f.actor,f.cfg).placements;
    assert.equal(placements.bag.area,'inventory');
    assert.deepEqual(placements.gem,{area:'storage',storageId:'bag:pouch',index:4,rotation:0});
  }finally{f.restore();}
});

test('red DROP action transfers the complete backpack and all children without a quantity prompt',async()=>{
  const f=setup();try{
    const result=await instantDropInventoryItem(f.actor,f.item,{scene:f.scene,user:f.user,canvasView:{tokens:{controlled:[]}}});
    assert.ok(result.id);
    const sceneItems=scenePhysicalItems(f.scene);
    assert.equal(sceneItems.length,1);
    assert.equal(sceneItems[0].data.name,'Packed Bag');
    assert.equal(sceneItems[0].data.flags.buxaframework.backpackContents.length,1);
    assert.equal(f.actor.items.size,0);
  }finally{f.restore();}
});

test('context menu always offers red DROP and adds UNEQUIP to equipped items',()=>{
  const code=source('scripts/apps/item-context-menu.js');
  assert.match(code,/dropButton\.dataset\.action\s*=\s*"drop"/);
  assert.match(code,/dropButton\.classList\.add\("buxa-item-context-danger"\)/);
  assert.match(code,/placement\?\.area\s*===\s*"equipment"/);
  assert.match(code,/button\.dataset\.action\s*=\s*"unequip"/);
  assert.match(source('styles/115-unstack-menu.css'),/buxa-item-context-danger/);
});

test('quick DROP prioritizes a selected token represented only by document.id',()=>{
  const f=setup();try{
    const first={actorId:'hero',x:200,y:200,width:1,height:1,hidden:false,document:{id:'first'}};
    const second={actorId:'hero',x:1000,y:1000,width:1,height:1,hidden:false,document:{id:'second'}};
    const point=quickDropPoint({actor:f.actor,scene:f.scene,user:f.user,
      actors:[f.actor],tokens:[first,second],selected:[{document:{id:'second'}}],
      settings:{playerDropRangeEnabled:false}});
    assert.deepEqual(point,{x:1140,y:1050});
  }finally{f.restore();}
});
