import test from 'node:test';
import assert from 'node:assert/strict';
import {refreshPhysicalCanvas,installPhysicalItemCanvas} from '../scripts/integrations/physical-item-canvas.js';

const makeRecord=(id,img='test.webp')=>({id,x:120,y:180,size:76,rotation:0,quantity:1,
  data:{name:'Ruby Axe',img,flags:{buxaframework:{item:{rarityId:'special'}}},system:{quantity:1}}});
class Display {
  constructor(){this.children=[];this.parent=null;this.listeners={};this.x=0;this.y=0;
    this.position={set:(x,y)=>{this.x=x;this.y=y}};
    this.anchor={set(){}};this.scale={set(){}};this.alpha=1;
  }
  addChild(child){child.parent=this;this.children.push(child);return child;}
  addChildAt(child,index){child.parent=this;this.children.splice(index,0,child);return child;}
  on(name,callback){this.listeners[name]=callback;return this;}
  destroy(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=null;
    for(const child of [...this.children])child.destroy?.();this.children=[];this.destroyed=true;}
}
class Graphics extends Display {
  rect(){return this;}fill(){return this;}ellipse(){return this;}poly(){return this;}circle(){return this;}
}
class Sprite extends Display{constructor(texture){super();this.texture=texture;this.width=texture.width;this.height=texture.height;}}
class Text extends Display {
  constructor({text,style}){super();
    if (typeof style?.fill==='object' || typeof style?.stroke==='object') throw Error('Unable to convert color [object Object]');
    this.text=text;this.style=style;this.width=text.length*8;}
}
async function setup(records,load) {
  const old=Object.fromEntries(['canvas','PIXI','game','document','Hooks','window','foundry','ui'].map(key=>[key,globalThis[key]]));
  const scene={id:'s',grid:{size:100,distance:5},flags:{buxaframework:{physicalItems:records}},
    getFlag(ns,path){return this.flags[ns]?.[path]}};
  const layer=new Display();const listeners={};
  globalThis.PIXI={VERSION:'8.0.0',Graphics,Sprite,Container:Display,Text,Assets:{load}};
  globalThis.game={user:{id:'gm',isGM:true},settings:{get(){return {visualMode:'beam'}}}};
  globalThis.canvas={ready:true,scene,interface:layer,stage:{},tokens:{},app:{ticker:{add(){},remove(){}}}};
  globalThis.document={getElementById(){return null;},addEventListener(){}};
  globalThis.window={addEventListener(){},removeEventListener(){}};
  globalThis.Hooks={on:(key,callback)=>{listeners[key]=callback;}};
  installPhysicalItemCanvas();refreshPhysicalCanvas();
  await new Promise(setImmediate);
  return {scene,layer,restore(){listeners.canvasTearDown?.();for(const [k,v] of Object.entries(old))if(v===undefined)delete globalThis[k];else globalThis[k]=v;}};
}
test('Pixi TextStyle only receives primitive colors; sprite, beam, label and right click stay usable',async()=>{
  const env=await setup([makeRecord('ruby')],async()=>({width:64,height:64}));
  try{
    const parent=env.layer.children[0].children[0];
    assert.ok(parent._buxaReady,'sprite construction must complete');
    assert.ok(parent._buxaNameplate,'no font-style runtime exception');
    assert.ok(parent._buxaFx,'rarity beam only for usable image');
    const sprite=parent.children.find(child=>child instanceof Sprite);
    assert.ok(sprite,'item artwork must render');
    assert.equal(typeof sprite.listeners.rightdown,'function');
    sprite.listeners.rightdown({stopPropagation(){},nativeEvent:{preventDefault(){}}});
    assert.equal(parent._buxaNameplate.children[2].visible,true,'right click exposes GM edit action');
  }finally{env.restore()}
});
test('broken image falls back to a visible Foundry icon before effects attach',async()=>{
  const paths=[];
  const env=await setup([makeRecord('bad','missing-icon.webp')],async path=>{
    paths.push(path);if(path==='missing-icon.webp')throw Error('missing');
    return {width:64,height:64};
  });
  try {
    const parent=env.layer.children[0].children[0];
    assert.deepEqual(paths,['missing-icon.webp','icons/svg/item-bag.svg']);
    assert.equal(parent._buxaReady,true);
    assert.ok(parent.children.some(child=>child instanceof Sprite));
    assert.ok(parent._buxaFx);
  }finally{env.restore()}
});
test('two missing images never leave an orphaned beam without a usable item sprite',async()=>{
  const env=await setup([makeRecord('failed','missing.webp')],async()=>{throw Error('no texture');});
  try{
    const parent=env.layer.children[0].children[0];
    assert.equal(parent._buxaFx,undefined);
    assert.equal(parent.children.length,0);
  }finally{env.restore()}
});
