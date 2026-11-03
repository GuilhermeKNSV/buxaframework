import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { physicalItemVisible } from '../scripts/core/physical-item-visibility.js';
import { normalizePhysicalSettings } from '../scripts/core/physical-items.js';

const item={id:'gem',x:100,y:100,size:80};
const scene={id:'scene-a',tokenVision:true};
const player={id:'player-a',isGM:false};
const gm={id:'gm-a',isGM:true};
const actor=(id,userIds)=>({id,getFlag:(namespace,key)=>namespace==='buxaframework'&&key==='linkedUsers'?userIds:null});
const linked=actor('hero',['player-a','gm-a']);
const foreign=actor('other',['other-player']);
const token=(actorId,pointVisible,{controlled=false,hidden=false,enabled=true}={})=>({
  controlled, actor:{id:actorId},
  document:{actorId,hidden,sight:{enabled}},
  vision:{testPoint:pointVisible}
});
const omniscient={tokenVision:true,testVisibility:()=>true};
const blind={tokenVision:true,testVisibility:()=>false};

test('no token selection required: explicitly linked character provides item vision',()=>{
  const source=token('hero',({x})=>x<200);
  assert.equal(source.controlled,false);
  assert.equal(physicalItemVisible(item,{scene,user:player,actors:[linked,foreign],tokens:[source],visibility:blind}),true);
  source.vision.testPoint=({x})=>x<128;
  assert.equal(physicalItemVisible(item,{scene,user:player,actors:[linked,foreign],tokens:[source],visibility:omniscient}),false);
  source.vision.testPoint=()=>true;
  assert.equal(physicalItemVisible(item,{scene,user:player,actors:[linked,foreign],tokens:[source],visibility:blind}),true);
});

test('multiple explicitly linked tokens can jointly cover an item even if neither is controlled',()=>{
  const a=token('hero',({x})=>x<=141);
  const b=token('second',({x})=>x>=139);
  const otherLinked=actor('second',['player-a']);
  assert.equal(physicalItemVisible(item,{scene,user:player,actors:[linked,otherLinked,foreign],tokens:[a,b],visibility:blind}),true);
  assert.equal(physicalItemVisible(item,{scene,user:player,actors:[linked,otherLinked,foreign],tokens:[a],visibility:omniscient}),false);
});

test('hidden, vision-disabled, foreign and missing linked tokens cannot reveal items',()=>{
  assert.equal(physicalItemVisible(item,{scene,user:player,actors:[linked,foreign],tokens:[token('other',()=>true)],visibility:omniscient}),false);
  assert.equal(physicalItemVisible(item,{scene,user:player,actors:[linked],tokens:[token('hero',()=>true,{hidden:true})],visibility:omniscient}),false);
  assert.equal(physicalItemVisible(item,{scene,user:player,actors:[linked],tokens:[token('hero',()=>true,{enabled:false})],visibility:omniscient}),false);
  assert.equal(physicalItemVisible(item,{scene,user:player,actors:[linked],tokens:[],visibility:omniscient}),false);
});

test('GM Item View defaults on and wins even while controlling a blind token',()=>{
  assert.equal(normalizePhysicalSettings({}).gmItemView,true);
  assert.equal(normalizePhysicalSettings({gmItemView:false}).gmItemView,false);
  assert.equal(normalizePhysicalSettings({gmItemView:true}).gmItemView,true);
  const controlled=token('hero',()=>false,{controlled:true});
  assert.equal(physicalItemVisible(item,{scene,user:gm,actors:[linked],tokens:[controlled],visibility:blind}),true);
  assert.equal(physicalItemVisible(item,{scene,user:gm,actors:[linked],tokens:[controlled],visibility:blind,settings:{gmItemView:false}}),false);
});

test('with GM Item View off, selected or linked character sight is used',()=>{
  const selected=token('other',()=>false,{controlled:true});
  const linkedSource=token('hero',()=>true);
  assert.equal(physicalItemVisible(item,{scene,user:gm,actors:[linked,foreign],tokens:[selected,linkedSource],visibility:omniscient,settings:{gmItemView:false}}),false);
  selected.controlled=false;
  assert.equal(physicalItemVisible(item,{scene,user:gm,actors:[linked,foreign],tokens:[selected,linkedSource],visibility:blind,settings:{gmItemView:false}}),true);
  assert.equal(physicalItemVisible(item,{scene,user:gm,actors:[linked],tokens:[],visibility:omniscient,settings:{gmItemView:false}}),false);
});

test('GM control, canvas visibility and canvas drop targeting consume the same setting',()=>{
  const root=new URL('../',import.meta.url);
  const read=p=>readFileSync(new URL(p,root),'utf8');
  const panel=read('scripts/apps/gm-physical-panel.js');
  const canvas=read('scripts/integrations/physical-item-canvas.js');
  const targets=read('scripts/integrations/canvas-item-drop-target.js');
  assert.match(panel,/data-setting="gmItemView"/);
  assert.match(panel,/\['lootEnabled','alwaysShowLoot','gmItemView'/);
  assert.match(canvas,/actors:actorList\(\),settings:policy/);
  assert.match(targets,/settings:normalizePhysicalSettings/);
  assert.match(canvas,/Hooks\.on\('updateActor'/);
});

test('canvas updates linked-player item visibility without token selection and GM option without reloading images',async()=>{
  const globals=['PIXI','canvas','game','document','window','Hooks','foundry'];
  const saved=Object.fromEntries(globals.map(key=>[key,globalThis[key]]));
  const hooks={};let imageLoads=0,gmView=true,sourceVisible=false;
  class Container {
    constructor(){this.children=[];this.parent=null;this.position={set:(x,y)=>{this.x=x;this.y=y;}};this.scale={set(){}};this.anchor={set(){}};this.events={};}
    addChild(child){this.children.push(child);child.parent=this;return child;}
    addChildAt(child,index){this.children.splice(index,0,child);child.parent=this;return child;}
    on(name,fn){this.events[name]=fn;return this;}
    destroy(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);this.parent=null;this.children=[];}
  }
  class Sprite extends Container {constructor(tex){super();this.texture=tex;this.width=tex.width;this.height=tex.height;}}
  const record={id:'scene-loot',x:100,y:100,size:80,quantity:1,
    data:{name:'Item',img:'test.webp',flags:{buxaframework:{item:{rarityId:'common'}}},system:{quantity:1}}};
  const testScene={...scene,flags:{buxaframework:{physicalItems:[record]}},getFlag(ns,k){return this.flags[ns]?.[k];}};
  const tokenSource=token('hero',()=>sourceVisible);
  const stage=new Container();
  globalThis.PIXI={VERSION:'8.0.0',Container,Sprite,Assets:{load:async()=>{imageLoads++;return {width:64,height:64};}}};
  globalThis.canvas={ready:true,scene:testScene,interface:stage,tokens:{placeables:[tokenSource]},visibility:blind,
    stage:{},app:{ticker:{add(){},remove(){}}}};
  globalThis.game={user:{...player},actors:{contents:[linked]},settings:{get(_ns,key){return key==='physicalItemSettings'?{gmItemView:gmView,visualMode:'shadow'}:{};}}};
  globalThis.document={getElementById(){return null;},addEventListener(){}};
  globalThis.window={addEventListener(){},removeEventListener(){}};
  globalThis.Hooks={on(name,fn){hooks[name]=fn;}};
  try {
    const {installPhysicalItemCanvas}=await import('../scripts/integrations/physical-item-canvas.js');
    installPhysicalItemCanvas();
    await new Promise(setImmediate);
    const displayed=stage.children[0].children[0];
    assert.equal(displayed.visible,false);
    sourceVisible=true;
    hooks.sightRefresh();
    assert.equal(displayed.visible,true,'linked source permits sight without selecting it');
    assert.equal(displayed.eventMode,'passive');
    sourceVisible=false;
    hooks.sightRefresh();
    assert.equal(displayed.visible,false);
    globalThis.game.user={...gm};
    hooks.buxaPhysicalVisualSettingsChanged();
    assert.equal(displayed.visible,true,'GM default view ignores linked-character sight');
    gmView=false;
    hooks.buxaPhysicalVisualSettingsChanged();
    assert.equal(displayed.visible,false,'GM opt-out follows linked-character sight');
    sourceVisible=true;
    hooks.sightRefresh();
    assert.equal(displayed.visible,true);
    assert.equal(imageLoads,1,'visibility changes do not reload sprites');
  } finally {
    hooks.canvasTearDown?.();
    for(const [key,value] of Object.entries(saved)){
      if (value===undefined) delete globalThis[key];
      else globalThis[key]=value;
    }
  }
});
