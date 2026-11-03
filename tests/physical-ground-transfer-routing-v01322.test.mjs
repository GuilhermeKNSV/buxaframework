import test from 'node:test';
import assert from 'node:assert/strict';
import { requestPhysicalAction } from '../scripts/integrations/physical-item-transfers.js';
import { scenePhysicalItems, PHYSICAL_SCENE_STORE } from '../scripts/core/physical-items.js';
import { groundDirectItems } from '../scripts/core/ground-container.js';
const ns='buxaframework';
let serialNo=0;
const data=(name,cells=[{x:0,y:0}])=>({name,type:'tool',img:`${name}.webp`,system:{quantity:1},flags:{[ns]:{item:{shape:{cells}}}}});
const chest=(id,x)=>({id,x,y:40,size:80,quantity:1,data:{name:id,type:'tool',system:{quantity:1},flags:{[ns]:{item:{storage:{slots:{external:[{id:'pouch',mode:'complex',columns:2,rows:2,cells:[0,1,2,3]}]}}}}}}});
function mock(){
 const keys=['game','foundry','Hooks','Item'];const prior=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));
 const gm={id:'gm',isGM:true,active:true};const users=[gm];
 const state={s:[chest('boxA',20),chest('boxB',120)]};let reject=false;
 const scene={id:'s',grid:{size:100,distance:5},width:1000,height:1000,
  tokens:{contents:[]},getFlag(){return null;}};
 const world={id:'potion',name:'Potion',system:{quantity:1},testUserPermission(){return true;},toObject(){return data('Potion')}};
 globalThis.foundry={utils:{randomID:()=>`id_${++serialNo}`}};
 globalThis.Hooks={callAll(){}};
 globalThis.game={user:gm,users,actors:{contents:[],get(){return null}},scenes:{get:i=>i==='s'?scene:null},items:{get:i=>i==='potion'?world:null},settings:{get(_,key){if(key===PHYSICAL_SCENE_STORE)return state;if(key==='physicalItemSettings')return {lootEnabled:true};return {};},async set(_,key,value){if(reject)throw Error('world save failed');assert.equal(key,PHYSICAL_SCENE_STORE);Object.assign(state,structuredClone(value));return value;}}};
 return {scene,state,set reject(value){reject=value;},restore(){for(const [k,v]of Object.entries(prior))if(v===undefined)delete globalThis[k];else globalThis[k]=v;}};
}
const action=data=>requestPhysicalAction({action:'container',sceneId:'s',containerId:'boxA',...data});
test('world template imports into ground storage, then chest-to-chest transfer is atomic',async()=>{
 const m=mock();try{
  await action({direction:'import',source:'world',itemId:'potion',quantity:1});
  const [first]=groundDirectItems(scenePhysicalItems(m.scene)[0]);
  assert.ok(first?.sourceId);
  assert.equal(m.state.s.length,2);
  await action({direction:'shift',contentId:first.sourceId,destinationContainerId:'boxB'});
  assert.equal(groundDirectItems(scenePhysicalItems(m.scene)[0]).length,0);
  assert.equal(groundDirectItems(scenePhysicalItems(m.scene)[1]).length,1);
  assert.equal(worldTemplateStillExists(),true);
 }finally{m.restore();}
 function worldTemplateStillExists(){return globalThis.game.items.get('potion')?.name==='Potion';}
});
test('export container content to board preserves item and chest, without Actor Document update',async()=>{
 const m=mock();try{
  await action({direction:'import',source:'world',itemId:'potion',quantity:1});
  const contentId=groundDirectItems(scenePhysicalItems(m.scene)[0])[0].sourceId;
  await action({direction:'export',destination:'scene',contentId,point:{x:300,y:300}});
  const records=scenePhysicalItems(m.scene);
  assert.equal(records.length,3);
  assert.equal(groundDirectItems(records[0]).length,0);
  assert.equal(records.at(-1).data.name,'Potion');
  assert.equal(records.at(-1).x,262);assert.equal(records.at(-1).y,262);
 }finally{m.restore();}
});
test('world store failure leaves chest unchanged and source template untouched',async()=>{
 const m=mock();try{
  m.reject=true;
  await assert.rejects(action({direction:'import',source:'world',itemId:'potion',quantity:1}),/world save failed/);
  assert.equal(groundDirectItems(scenePhysicalItems(m.scene)[0]).length,0);
  assert.equal(m.state.s.length,2);
 }finally{m.restore();}
});
test('a full chest rejects a new item without mutating either source or destination',async()=>{
 const m=mock();try{
  const inventoryItem=data('BoxFiller',[{x:0,y:0},{x:1,y:0},{x:0,y:1},{x:1,y:1}]);
  m.state.s[0].data.flags[ns].backpackContents=[{sourceId:'filler',providerId:'root',compartmentId:'pouch',index:0,rotation:0,data:inventoryItem}];
  await assert.rejects(action({direction:'import',source:'world',itemId:'potion',quantity:1}),/full|fit/i);
  assert.equal(groundDirectItems(scenePhysicalItems(m.scene)[0]).length,1);
  assert.equal(globalThis.game.items.get('potion').name,'Potion');
 }finally{m.restore();}
});
