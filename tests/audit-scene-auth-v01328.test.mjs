import test from 'node:test';
import assert from 'node:assert/strict';
import {requestPhysicalAction,installPhysicalItemTransfers} from '../scripts/integrations/physical-item-transfers.js';
import {scenePhysicalItems,PHYSICAL_SCENE_STORE} from '../scripts/core/physical-items.js';
import {MODULE_ID} from '../scripts/core/constants.js';
const get=(o,path)=>String(path).split('.').reduce((v,k)=>v?.[k],o);
function setup(){
  const keys=['game','foundry','Item','canvas'];const old=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));
  const gm={id:'gm',isGM:true,active:true},player={id:'player',isGM:false,active:true};
  const users=[gm,player];users.get=id=>users.find(u=>u.id===id);
  const actor={id:'a',getFlag:(ns,key)=>key==='linkedUsers'?['player']:null};
  const token={actorId:'a',x:100,y:100,width:1,height:1,hidden:false};
  const chestStorage={slots:{external:[{id:'main',mode:'complex',columns:3,rows:3,cells:[0,1,2,3,4,5,6,7,8]}]}};
  const chest={id:'chest',x:130,y:130,size:76,quantity:1,data:{name:'Storage',type:'tool',system:{quantity:1},flags:{[MODULE_ID]:{item:{storage:chestStorage}}}}};
  const source={id:'source',x:900,y:900,size:76,quantity:1,data:{name:'Sword',type:'tool',system:{quantity:1},flags:{[MODULE_ID]:{item:{shape:{cells:[{x:0,y:0}]}}}}}};
  let stored={scene:[chest,source]},policy={lootEnabled:true,lootDistance:15,playerDropRangeEnabled:true,dropDistance:10};
  const scene={id:'scene',width:1000,height:1000,grid:{size:100,distance:5},
    dimensions:{sceneRect:{x:100,y:100,width:300,height:300}},tokens:{contents:[token]}};
  const channels=new Map(),replies=[];
  globalThis.foundry={utils:{randomID:()=>String(Math.random()).slice(2)}};
  globalThis.game={user:gm,users,actors:{contents:[actor],get:id=>id==='a'?actor:null},
    scenes:{get:id=>id==='scene'?scene:null},items:{get(){return null}},
    settings:{get(ns,key){if(key===PHYSICAL_SCENE_STORE)return stored;if(key==='physicalItemSettings')return policy;return {};},
      async set(ns,key,value){stored=structuredClone(value);return stored;}},
    socket:{on:(key,fn)=>channels.set(key,fn),emit:(key,msg)=>replies.push(msg)}};
  globalThis.canvas={ready:true,scene,tokens:{placeables:[{document:{id:'t',actorId:'a',hidden:false,sight:{enabled:true}},
    vision:{testPoint:()=>true}}]}};
  scene.tokens.contents[0].id='t';
  installPhysicalItemTransfers();
  const send=async(payload)=>{
    const id=`request-${replies.length}`;
    channels.get(`module.${MODULE_ID}`)({ns:'physical',kind:'request',id,from:'player',payload},'player');
    for(let i=0;i<30&&!replies.some(r=>r.id===id);i++)await new Promise(resolve=>setTimeout(resolve,0));
    return replies.find(r=>r.id===id);
  };
  return {scene,send,actor,setPolicy:p=>{policy=p},setRecords:items=>{stored={scene:items}},
    restore(){for(const [k,v]of Object.entries(old))if(v===undefined)delete globalThis[k];else globalThis[k]=v;}};
}

test('remote player cannot bypass loot distance by importing distant ground item into nearby chest',async()=>{
  const f=setup();try{
    const result=await f.send({action:'container',sceneId:'scene',containerId:'chest',direction:'import',
      source:'scene',itemId:'source',quantity:1,storageId:'root:main',index:0});
    assert.equal(result?.ok,false);
    assert.match(result?.error||'',/within 15 ft/);
    assert.equal(scenePhysicalItems(f.scene).length,2);
  }finally{f.restore();}
});

test('source chest cannot export items onto far scene cells when player drop range is enabled',async()=>{
  const f=setup();try{
    const records=scenePhysicalItems(f.scene);
    records[0]=structuredClone(records[0]);
    records[0].data.flags[MODULE_ID].backpackContents=[{sourceId:'inside',providerId:'root',compartmentId:'main',index:0,rotation:0,
      data:{name:'Gem',type:'tool',system:{quantity:1},flags:{[MODULE_ID]:{item:{}}}}}];
    f.setRecords(records);
    const result=await f.send({action:'container',sceneId:'scene',containerId:'chest',direction:'export',
      contentId:'inside',destination:'scene',point:{x:390,y:390}});
    assert.equal(result?.ok,false);
    assert.match(result?.error||'',/within 10 ft/);
    assert.equal(scenePhysicalItems(f.scene)[0].data.flags[MODULE_ID].backpackContents.length,1);
  }finally{f.restore();}
});

test('scene move and artwork edit obey the full padded scene footprint',async()=>{
  const f=setup();try{
    await assert.rejects(requestPhysicalAction({action:'move',sceneId:'scene',itemId:'chest',point:{x:350,y:150}}),/whole item image/);
    await assert.rejects(requestPhysicalAction({action:'edit',sceneId:'scene',itemId:'chest',artwork:{x:350,y:150,size:76,rotation:0}}),/inside the scene/);
    await requestPhysicalAction({action:'move',sceneId:'scene',itemId:'chest',point:{x:200,y:200}});
    assert.equal(scenePhysicalItems(f.scene)[0].x,200);
    await requestPhysicalAction({action:'edit',sceneId:'scene',itemId:'chest',artwork:{x:310,y:310,size:76,rotation:90}});
    assert.equal(scenePhysicalItems(f.scene)[0].rotation,90);
  }finally{f.restore();}
});
