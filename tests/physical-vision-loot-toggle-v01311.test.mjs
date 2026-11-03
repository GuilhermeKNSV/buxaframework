import test from 'node:test';
import assert from 'node:assert/strict';
import { physicalItemVisible } from '../scripts/core/physical-item-visibility.js';
import { normalizePhysicalSettings } from '../scripts/core/physical-items.js';
import { applyPhysicalLootPresentation,refreshPhysicalCanvas,installPhysicalItemCanvas } from '../scripts/integrations/physical-item-canvas.js';
const record={id:'a',x:200,y:170,size:76,quantity:1,data:{name:'Tool',img:'tool.webp',system:{quantity:1},flags:{buxaframework:{item:{rarityId:'rare'}}}}};
const scene={id:'a',tokenVision:true};
test('GM control previews a token sight polygon, rather than seeing loot outside it',()=>{
  const gm={id:'gm',isGM:true};
  const token={controlled:true,document:{hidden:false,sight:{enabled:true}},vision:{los:{contains(x){return x<100;}}}};
  const visibility={tokenVision:true,testVisibility(){return true;}};
  assert.equal(physicalItemVisible(record,{user:gm,settings:{gmItemView:false},scene,visibility,tokens:[token]}),false);
  token.vision.los.contains=()=>true;
  assert.equal(physicalItemVisible(record,{user:gm,settings:{gmItemView:false},scene,visibility,tokens:[token]}),true);
  token.vision={};
  assert.equal(physicalItemVisible(record,{user:gm,settings:{gmItemView:false},scene,visibility,tokens:[token]}),false,'GM preview fails closed before sight polygon is available');
  assert.equal(physicalItemVisible(record,{user:gm,settings:{gmItemView:false},scene,visibility,tokens:[]}),false,'GM override off: no selected or linked sight must stay hidden');
  assert.equal(physicalItemVisible(record,{user:gm,scene,visibility,tokens:[]}),true,'GM Item View on: unrestricted visibility');
});
test('V14 PointVisionSource testPoint respects its restricted vision range',()=>{
  const gm={id:'gm',isGM:true};
  const token={controlled:true,document:{sight:{enabled:true}},vision:{testPoint(point){
    assert.equal(point.elevation,0);return point.x<150;
  },los:{contains(){return true;}}}};
  assert.equal(physicalItemVisible(record,{user:gm,settings:{gmItemView:false},scene,visibility:{tokenVision:true,testVisibility(){return true;}},tokens:[token]}),false);
});
test('explicit GM actor link uses that character sight when no token is controlled',()=>{
  const gm={id:'gm',isGM:true};
  const actor={id:'hero',getFlag(){return ['gm'];}};
  const token={actor:{id:'hero'},document:{sight:{enabled:true}},vision:{los:{contains(x){return x>700;}}}};
  assert.equal(physicalItemVisible(record,{user:gm,settings:{gmItemView:false},scene,visibility:{tokenVision:true,testVisibility(){return true;}},tokens:[token],actors:[actor]}),false);
});
test('world rules default to hidden-on-right-click and preserve choice after normalization',()=>{
  assert.equal(normalizePhysicalSettings({}).alwaysShowLoot,false);
  assert.equal(normalizePhysicalSettings({alwaysShowLoot:true}).alwaysShowLoot,true);
  assert.equal(normalizePhysicalSettings({alwaysShowLoot:false}).alwaysShowLoot,false);
});
test('artwork stays independent: rarity FX and nameplate show only on demand',()=>{
  const old=globalThis.game;
  globalThis.game={user:{isGM:false}};
  try {
    const parent={_buxaReveal:false,_buxaFx:{visible:true},_buxaNameplate:{visible:true,_buxaToggleEdit(){}}};
    applyPhysicalLootPresentation(parent,{lootEnabled:true,alwaysShowLoot:false});
    assert.equal(parent._buxaFx.visible,false);
    assert.equal(parent._buxaNameplate.visible,false);
    parent._buxaReveal=true;
    applyPhysicalLootPresentation(parent,{lootEnabled:true,alwaysShowLoot:false});
    assert.equal(parent._buxaFx.visible,true);
    assert.equal(parent._buxaNameplate.visible,true);
    parent._buxaReveal=false;
    applyPhysicalLootPresentation(parent,{lootEnabled:true,alwaysShowLoot:true});
    assert.equal(parent._buxaFx.visible,true);
    applyPhysicalLootPresentation(parent,{lootEnabled:true,alwaysShowLoot:true},false);
    assert.equal(parent._buxaFx.visible,false);
  } finally {if(old===undefined)delete globalThis.game;else globalThis.game=old;}
});
class Display {
  constructor(){this.children=[];this.listeners={};this.position={set:(x,y)=>{this.x=x;this.y=y;}};this.anchor={set(){}};this.scale={set(){}};}
  addChild(child){child.parent=this;this.children.push(child);return child;}
  addChildAt(child,index){child.parent=this;this.children.splice(index,0,child);return child;}
  on(name,handler){this.listeners[name]=handler;}
  destroy(){this.parent?.children.splice(this.parent.children.indexOf(this),1);this.parent=null;this.children=[];}
}
class Sprite extends Display {constructor(texture){super();this.texture=texture;this.width=texture.width;this.height=texture.height;}}
class Graphics extends Display {rect(){return this;}fill(){return this;}ellipse(){return this;}poly(){return this;}circle(){return this;}}
class Text extends Display {constructor({text,style}){super();this.text=text;this.width=text.length*8;this.style=style;}}
test('real canvas click reveals loot and FX, vision hides it, and saved setting enables always show',async()=>{
  const keys=['PIXI','game','canvas','document','Hooks','window','foundry'];
  const old=Object.fromEntries(keys.map(key=>[key,globalThis[key]]));
  const hooks={};let visible=true;let policy={visualMode:'shadow',lootEnabled:true,alwaysShowLoot:false};
  const layer=new Display();
  globalThis.PIXI={VERSION:'8.0.0',Container:Display,Sprite,Graphics,Text,Assets:{async load(){return {width:64,height:64};}}};
  globalThis.game={user:{id:'user',isGM:false},settings:{get(_ns,key){return key==='physicalItemSettings'?policy:{};}}};
  const fakeScene={...scene,flags:{buxaframework:{physicalItems:[record]}},getFlag(ns,k){return this.flags[ns]?.[k];}};
  globalThis.canvas={ready:true,scene:fakeScene,interface:layer,visibility:{tokenVision:true,testVisibility(){return visible;}},app:{ticker:{add(){},remove(){}}}};
  globalThis.document={addEventListener(){},getElementById(){return null;}};
  globalThis.window={addEventListener(){},removeEventListener(){}};
  globalThis.Hooks={on(name,callback){hooks[name]=callback;}};
  try {
    installPhysicalItemCanvas();
    await new Promise(setImmediate);
    const item=layer.children[0].children[0];
    const sprite=item.children.find(c=>c instanceof Sprite);
    assert.equal(item.visible,true);
    assert.equal(item._buxaNameplate.visible,false);
    assert.equal(item._buxaFx.visible,false);
    sprite.listeners.rightdown({stopPropagation(){},nativeEvent:{preventDefault(){}}});
    assert.equal(item._buxaNameplate.visible,true);
    assert.equal(item._buxaFx.visible,true);
    visible=false;hooks.visibilityRefresh();
    assert.equal(item.visible,false);
    assert.equal(item._buxaNameplate.visible,false);
    visible=true;hooks.sightRefresh();
    assert.equal(item.visible,true);
    assert.equal(item._buxaNameplate.visible,false,'reveals do not leak when item re-enters LOS');
    policy={...policy,alwaysShowLoot:true};
    hooks.buxaPhysicalVisualSettingsChanged();
    assert.equal(item._buxaNameplate.visible,true);
    assert.equal(item._buxaFx.visible,true);
  } finally {
    hooks.canvasTearDown?.();
    for(const key of keys){if(old[key]===undefined)delete globalThis[key];else globalThis[key]=old[key];}
  }
});
