import test from 'node:test';
import assert from 'node:assert/strict';
import {MODULE_ID,DEFAULT_SHEET_CONFIG} from '../scripts/core/constants.js';
import {invalidateSheetConfigCache} from '../scripts/core/config.js';
import {PHYSICAL_SCENE_STORE,scenePhysicalItems} from '../scripts/core/physical-items.js';
import {requestPhysicalAction} from '../scripts/integrations/physical-item-transfers.js';
import {groundDirectItems} from '../scripts/core/ground-container.js';
const get=(o,path)=>String(path).split('.').reduce((a,k)=>a?.[k],o);
const set=(o,path,val)=>{const keys=path.split('.');let p=o;for(const key of keys.slice(0,-1))p=p[key]??={};p[keys.at(-1)]=val;};
let id=0;
function fixture(){
 const keys=['game','foundry','Hooks','CONST'];const prior=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));
 const gm={id:'gm',isGM:true,active:true};const user={id:'u',isGM:false,active:true};const users=[gm,user];users.get=i=>users.find(u=>u.id===i);
 const inventory=new(class extends Map{[Symbol.iterator](){return this.values();}})();
 const actor={id:'a',isOwner:true,items:inventory,flags:{[MODULE_ID]:{linkedUsers:['u']}},name:'Hero',getFlag(ns,key){return get(this.flags[ns],key);},testUserPermission(){return true;},
  async update(patch){for(const [k,v]of Object.entries(patch))set(this,k,v);},
  async createEmbeddedDocuments(type,data){return data.map(d=>{const i={id:`generated-${++id}`,name:d.name,type:d.type||'tool',img:d.img||'',system:structuredClone(d.system),flags:structuredClone(d.flags),getFlag(ns,key){return get(this.flags[ns],key);},toObject(){return {_id:this.id,name:this.name,type:this.type,img:this.img,system:structuredClone(this.system),flags:structuredClone(this.flags)};}};inventory.set(i.id,i);return i;});},
  async deleteEmbeddedDocuments(type,ids){return ids.map(i=>{const doc=inventory.get(i);inventory.delete(i);return doc;}).filter(Boolean);},
  async updateEmbeddedDocuments(type,changes){for(const d of changes){const i=inventory.get(d._id);i.system.quantity=d['system.quantity'];}return changes;}
 };
 const potion={id:'potion',name:'Potion',type:'tool',img:'potion.webp',system:{quantity:1},flags:{[MODULE_ID]:{item:{shape:{cells:[{x:0,y:0}]}}}},getFlag(ns,key){return get(this.flags[ns],key);},toObject(){return {_id:this.id,name:this.name,type:this.type,img:this.img,system:structuredClone(this.system),flags:structuredClone(this.flags)};}};inventory.set('potion',potion);
 const actorCollection={contents:[actor],get:i=>i==='a'?actor:null};
 const chest={id:'chest',x:110,y:110,size:76,quantity:1,data:{name:'Chest',type:'tool',system:{quantity:1},flags:{[MODULE_ID]:{item:{disableLooting:true,storage:{slots:{external:[{id:'pouch',mode:'complex',columns:3,rows:3,cells:[0,1,2,3,4,5,6,7,8]}]}}}}}}};
 let store={scene:[chest]};let fail=false;
 const scene={id:'scene',grid:{size:100,distance:5},width:1000,height:1000,tokens:{contents:[{actorId:'a',x:100,y:100,width:1,height:1,hidden:false}]},getFlag(){return null;}};
 globalThis.foundry={utils:{deepClone:structuredClone,randomID:()=>`nonce-${++id}`,getProperty:get,setProperty:set,hasProperty:(o,p)=>get(o,p)!==undefined,equals:(a,b)=>JSON.stringify(a)===JSON.stringify(b)}};
 globalThis.Hooks={callAll(){}};
 globalThis.game={user:gm,users,actors:actorCollection,scenes:{get:i=>i==='scene'?scene:null},settings:{get(ns,key){if(key===PHYSICAL_SCENE_STORE)return store;if(key==='physicalItemSettings')return {lootEnabled:true,lootDistance:50};const config=structuredClone(DEFAULT_SHEET_CONFIG);config.inventory.slots=30;return config;},async set(ns,key,val){if(fail)throw Error('storage refused');assert.equal(key,PHYSICAL_SCENE_STORE);store=structuredClone(val);return store;}}};
 invalidateSheetConfigCache();
 return {scene,actor,potion,set fail(v){fail=v;},restore(){invalidateSheetConfigCache();for(const [k,v]of Object.entries(prior))if(v===undefined)delete globalThis[k];else globalThis[k]=v;}};
}
const action=payload=>requestPhysicalAction({action:'container',sceneId:'scene',containerId:'chest',targetActorId:'a',...payload});
test('locked chest blocks pickup; direct deposit/withdrawal preserve item and quantity',async()=>{
 const f=fixture();try{
   await assert.rejects(requestPhysicalAction({action:'loot',sceneId:'scene',itemId:'chest'}),/cannot be looted/);
   await action({direction:'store',itemId:'potion',quantity:1,storageId:'root:pouch'});
   assert.equal(f.actor.items.has('potion'),false);
   assert.equal(groundDirectItems(scenePhysicalItems(f.scene)[0]).length,1);
   const child=groundDirectItems(scenePhysicalItems(f.scene)[0])[0];
   const result=await action({direction:'take',contentId:child.sourceId});
   assert.equal(f.actor.items.get(result.itemId)?.name,'Potion');
   assert.equal(groundDirectItems(scenePhysicalItems(f.scene)[0]).length,0);
   assert.equal(scenePhysicalItems(f.scene)[0].id,'chest');
 }finally{f.restore();}
});
test('failed chest write cannot remove Actor source',async()=>{
 const f=fixture();try{
   f.fail=true;
   await assert.rejects(action({direction:'store',itemId:'potion',quantity:1,storageId:'root:pouch'}),/storage refused/);
   assert.equal(f.actor.items.has('potion'),true);
   assert.equal(groundDirectItems(scenePhysicalItems(f.scene)[0]).length,0);
 }finally{f.restore();}
});
