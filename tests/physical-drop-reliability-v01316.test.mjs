import test from 'node:test';
import assert from 'node:assert/strict';
import {physicalSceneRect,physicalDestination,physicalDropArtworkOrigin} from '../scripts/core/physical-items.js';
import {nearestExternalStoragePlacement} from '../scripts/core/external-storage-placement.js';
import {externalPreviewGripOffset} from '../scripts/integrations/physical-inventory-preview.js';
import {getInventoryDropDestination} from '../scripts/apps/inventory-drop-target.js';
import {boardScenePoint,showPhysicalDropGhost,clearPhysicalDropGhost} from '../scripts/integrations/physical-item-ghost.js';

test('Foundry padded scene origin is valid; the 0-origin mismatch no longer blocks interior drops',()=>{
  const scene={width:600,height:400,dimensions:{sceneRect:{x:300,y:150,width:600,height:400}},grid:{size:100,distance:5}};
  assert.deepEqual(physicalSceneRect(scene),{x:300,y:150,width:600,height:400});
  const dest=physicalDestination({x:850,y:510},{scene,grid:scene.grid});
  assert.equal(dest?.x,850);
  assert.deepEqual(physicalDropArtworkOrigin(dest,dest.size,scene),{x:812,y:472});
  assert.equal(physicalDestination({x:200,y:510},{scene}),null);
  assert.equal(physicalDestination({x:910,y:510},{scene}),null);
  assert.equal(physicalDropArtworkOrigin({x:870,y:530},76,scene),null,'entire artwork needs to fit');
});

test('pointer conversion prefers official Foundry V14 coordinates under zoom and padding',()=>{
  const old=globalThis.canvas;
  try {
    globalThis.canvas={canvasCoordinatesFromClient:({x,y})=>({x:x*2+300,y:y*2+150}),stage:{toLocal(){throw Error('wrong legacy path');}}};
    assert.deepEqual(boardScenePoint(125,100),{x:550,y:350});
  }finally{if(old===undefined)delete globalThis.canvas;else globalThis.canvas=old;}
});

test('external grabbed cell offsets are clamped for 3x2 or 1x1 rotated items',()=>{
  assert.deepEqual(externalPreviewGripOffset({width:3,height:2},{gripX:.99,gripY:.01}),{x:2,y:0});
  assert.deepEqual(externalPreviewGripOffset({width:3,height:2},{gripX:.5,gripY:.5}),{x:1,y:1});
  assert.deepEqual(externalPreviewGripOffset({width:1,height:1},{gripX:.99,gripY:.99}),{x:0,y:0});
});

test('incoming irregular items choose valid cells in a masked backpack and reject occupied cells',()=>{
  const bag={storageId:'bag:small',providerId:'provider',columns:3,rows:3,mode:'complex',itemMode:'complex',cells:[0,1,2,3,4,5,6,7]};
  const shapes={incoming:{cells:[{x:0,y:0},{x:1,y:0},{x:0,y:1}]},blocker:{cells:[{x:0,y:0}]}};
  const placements={blocker:{area:'storage',storageId:'bag:small',index:1}};
  const requested=nearestExternalStoragePlacement({compartment:bag,placements,shapes,itemId:'incoming',requestedIndex:0});
  assert.notEqual(requested,0,'the occupied neighboring square is respected');
  assert.ok(Number.isInteger(requested),'a valid alternative exists within the pouch');
  assert.equal(nearestExternalStoragePlacement({compartment:bag,placements,shapes,itemId:'incoming',requestedIndex:0,maxDistance:0}),null);
  assert.equal(nearestExternalStoragePlacement({compartment:bag,placements,shapes,itemId:'provider',requestedIndex:0}),null,'the backpack cannot contain its own provider');
});

test('backpack header is an explicit storage destination instead of main inventory',()=>{
  const bag={dataset:{storageId:'provider:bag'}};
  const target={closest(selector){if(selector==='[data-storage-board]')return null;
    if(selector==='.buxa-storage-compartment[data-storage-id]')return bag;
    return null;}};
  assert.deepEqual(getInventoryDropDestination({target,clientX:80,clientY:40}),{
    area:'storage',storageId:'provider:bag',index:0,auto:true});
});

test('zoom-aware drop range outline uses projected client-space circle and cleans itself',()=>{
  const original=Object.fromEntries(['PIXI','canvas','game','document'].map(key=>[key,globalThis[key]]));
  const created=[];
  const makeNode=tag=>({tag,style:{},attributes:{},children:[],setAttribute(k,v){this.attributes[k]=v;},
    append(child){this.children.push(child);},replaceChildren(){this.children=[];},remove(){this.removed=true;},
    getAttribute(){return null;},querySelector(){return {getAttribute(){return null;},set src(value){this._src=value;}}},
    classList:{toggle(){}}});
  try {
    const board={contains:()=>false,getBoundingClientRect:()=>({width:800,height:500,left:0,top:0})};
    globalThis.document={getElementById:()=>board,elementFromPoint:()=>board,createElement:makeNode,
      createElementNS:(ns,tag)=>{const node=makeNode(tag);created.push(node);return node;},body:{append(){}}};
    const actor={id:'a',getFlag:()=>['u']};
    globalThis.game={user:{id:'u',isGM:false},actors:{contents:[actor]},settings:{get:()=>({playerDropRangeEnabled:true,dropDistance:10,showDropRangeOutline:true})}};
    globalThis.canvas={ready:true,scene:{id:'s',width:2000,height:2000,grid:{size:100,distance:5},tokens:{contents:[{actorId:'a',x:100,y:200,width:1,height:1}]}},
      grid:{size:100},canvasCoordinatesFromClient:({x,y})=>({x,y}),
      clientCoordinatesFromCanvas:({x,y})=>({x:x/2,y:y/2}),stage:{scale:{x:.5}}};
    globalThis.PIXI={};
    assert.equal(showPhysicalDropGhost({img:'axe.png'},200,180,{actor}),true);
    const ring=created.find(node=>node.tag==='circle');
    assert.ok(ring,'SVG ring is drawn even without a PIXI.Graphics layer');
    assert.equal(ring.attributes.r,'100','10ft of 200 scene pixels at 50% zoom');
    assert.equal(ring.attributes.cx,'75');
    assert.equal(ring.attributes.cy,'125');
    clearPhysicalDropGhost();
  }finally{clearPhysicalDropGhost();for(const [key,value] of Object.entries(original)){
    if(value===undefined)delete globalThis[key];else globalThis[key]=value;
  }}
});

test('ground item transfers into equipped backpack (not main grid), then disappears from scene',async()=>{
  const {MODULE_ID,DEFAULT_SHEET_CONFIG}=await import('../scripts/core/constants.js');
  const {PHYSICAL_SCENE_STORE,scenePhysicalItems}=await import('../scripts/core/physical-items.js');
  const {requestPhysicalAction}=await import('../scripts/integrations/physical-item-transfers.js');
  const {invalidateSheetConfigCache}=await import('../scripts/core/config.js');
  const keys=['game','foundry','Hooks','canvas'];
  const previous=Object.fromEntries(keys.map(key=>[key,globalThis[key]]));
  const config=structuredClone(DEFAULT_SHEET_CONFIG);
  config.inventory.mode='complex';
  config.inventory.complex={columns:4,rows:3,activeCells:12,autoSort:false};
  let store={};let ids=0;
  const get=(o,path)=>String(path).split('.').reduce((v,k)=>v?.[k],o);
  const set=(o,path,val)=>{const keys=path.split('.');let current=o;
    for(const key of keys.slice(0,-1))current=current[key]??={};current[keys.at(-1)]=val;};
  const docs=new (class extends Map{[Symbol.iterator](){return this.values();}})();
  const bag={id:'bag',name:'Pouch',img:'pouch.png',getFlag:(ns,key)=>key==='item'?{
    storage:{slots:{external:[{id:'pouch',columns:3,rows:2,mode:'simple'}]}}}:undefined};
  docs.set('bag',bag);
  const initial={tracked:['bag'],placements:{bag:{area:'equipment',slotId:'belt-1',position:0}},equipmentActive:{'belt-1':0},autoSort:false};
  const actor={id:'hero',name:'Hero',isOwner:true,items:docs,flags:{[MODULE_ID]:{inventory:structuredClone(initial),linkedUsers:['gm']}},
    getFlag(ns,key){return get(this.flags[ns],key);},testUserPermission:()=>true,
    async update(patch){for(const [k,v]of Object.entries(patch))set(this,k,v);return this;},
    async createEmbeddedDocuments(type,items){assert.equal(type,'Item');return items.map(data=>{
      const id='received'+(++ids);const doc={id,name:data.name,img:data.img,system:data.system,flags:data.flags,
        getFlag(ns,key){return get(this.flags?.[ns],key);}};docs.set(id,doc);return doc;});},
    async deleteEmbeddedDocuments(type,ids){return ids.map(id=>{const d=docs.get(id);docs.delete(id);return d;});}
  };
  const record={id:'ground',x:150,y:150,size:76,quantity:1,data:{name:'Saber',type:'tool',img:'saber.png',
    system:{quantity:1},flags:{[MODULE_ID]:{item:{rarityId:'rare',shape:{cells:[{x:0,y:0},{x:1,y:0}]}}}}}};
  const scene={id:'scene',width:1000,height:1000,grid:{size:100,distance:5},tokens:{contents:[]},
    getFlag(ns,key){return key==='physicalItems'?[record]:undefined;}};
  const gm={id:'gm',isGM:true,active:true};
  const users=[gm];users.get=id=>users.find(e=>e.id===id);
  const scenes=new Map([['scene',scene]]);
  const actors=new Map([['hero',actor]]);actors.contents=[actor];
  try {
    globalThis.foundry={utils:{deepClone:structuredClone,randomID:()=>`n${++ids}`,getProperty:get,setProperty:set,
      equals:(a,b)=>JSON.stringify(a)===JSON.stringify(b),hasProperty:(o,path)=>get(o,path)!==undefined}};
    globalThis.Hooks={callAll(){}};
    globalThis.game={user:gm,users,scenes,actors,items:new Map(),system:{id:'dnd5e'},settings:{
      get(ns,key){if(key===PHYSICAL_SCENE_STORE)return store;if(key==='physicalItemSettings')return {lootEnabled:true};return config;},
      async set(ns,key,value){assert.equal(key,PHYSICAL_SCENE_STORE);store=structuredClone(value);return store;}
    }};
    invalidateSheetConfigCache();
    const result=await requestPhysicalAction({action:'transfer',source:'scene',destination:'actor',sceneId:'scene',itemId:'ground',
      actorId:'hero',quantity:1,position:{area:'storage',storageId:'bag:pouch',index:0,rotation:0,strict:true}});
    assert.ok(result.itemId);
    assert.equal(actor.getFlag(MODULE_ID,'inventory').placements[result.itemId].area,'storage');
    assert.equal(actor.getFlag(MODULE_ID,'inventory').placements[result.itemId].storageId,'bag:pouch');
    assert.equal(scenePhysicalItems(scene).length,0);
  }finally {
    invalidateSheetConfigCache();
    for(const [key,value]of Object.entries(previous)){
      if(value===undefined)delete globalThis[key];else globalThis[key]=value;
    }
  }
});

test('3x2 scene item preview and saved origin stay under the grabbed pointer cell',async()=>{
  const {MODULE_ID,DEFAULT_SHEET_CONFIG}=await import('../scripts/core/constants.js');
  const {beginPhysicalInventoryDrag,endPhysicalInventoryDrag,describeExternalInventoryPreview,
    externalInventoryDropPosition}=await import('../scripts/integrations/physical-inventory-preview.js');
  const {invalidateSheetConfigCache}=await import('../scripts/core/config.js');
  const old=Object.fromEntries(['game','foundry','document','canvas'].map(key=>[key,globalThis[key]]));
  const cfg=structuredClone(DEFAULT_SHEET_CONFIG);
  cfg.inventory.mode='complex';cfg.inventory.complex={columns:7,rows:5,activeCells:35,autoSort:false};
  const actor={id:'hero',isOwner:true,items:[],getFlag(ns,key){return key==='inventory'?{tracked:[],placements:{},autoSort:false}:undefined;}};
  const board={style:{getPropertyValue:(key)=>key==='--buxa-complex-columns'?'7':'5'},
    getBoundingClientRect:()=>({left:100,top:50,width:406,height:290}),
    querySelector:()=>({getBoundingClientRect:()=>({left:100,top:50,width:58,height:58})})};
  const root={dataset:{buxaDropActorId:'hero'},querySelector:()=>board};
  try{
    globalThis.foundry={utils:{deepClone:structuredClone}};
    globalThis.game={settings:{get:()=>cfg},actors:{get:id=>id==='hero'?actor:null},system:{id:'dnd5e'}};
    globalThis.document={elementFromPoint:()=>root,querySelector:()=>root};
    globalThis.canvas={scene:{id:'s'}};
    invalidateSheetConfigCache();
    const item={id:'axe',img:'axe.png',flags:{[MODULE_ID]:{item:{shape:{cells:[{x:0,y:0},{x:1,y:0},{x:2,y:0},
      {x:0,y:1},{x:1,y:1}]}}}}};
    beginPhysicalInventoryDrag(item,{gripX:.51,gripY:.51});
    const x=100+2.5*58,y=50+2.5*58;
    const target={kind:'actor',actorId:'hero',position:{area:'inventory',index:16}};
    const preview=describeExternalInventoryPreview({item,actor,target,x,y});
    assert.ok(preview?.valid, 'a 3x2 footprint fits');
    assert.equal(preview.left,158,'the grabbed middle cell remains under the cursor');
    assert.equal(preview.top,108);
    const position=externalInventoryDropPosition(item,target,x,y);
    assert.equal(position.index,8);
    assert.equal(position.strict,true);
    assert.ok(x>preview.left&&x<preview.left+preview.bounds.width*preview.cellWidth);
    assert.ok(y>preview.top&&y<preview.top+preview.bounds.height*preview.cellHeight);
  }finally{
    endPhysicalInventoryDrag();invalidateSheetConfigCache();
    for(const [key,value]of Object.entries(old)){
      if(value===undefined)delete globalThis[key];else globalThis[key]=value;
    }
  }
});
