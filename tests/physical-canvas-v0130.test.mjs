import test from 'node:test';
import assert from 'node:assert/strict';
import { refreshPhysicalCanvas, installPhysicalItemCanvas } from '../scripts/integrations/physical-item-canvas.js';

class Display {
  constructor(){this.children=[];this.parent=null;this.position={set:(x,y)=>{this.x=x;this.y=y;}};this.x=0;this.y=0;this.events={};}
  addChild(child){child.parent=this;this.children.push(child);return child;}
  destroy(){this.parent?.children.splice(this.parent.children.indexOf(this),1);this.parent=null;for(const c of [...this.children])c.destroy?.();this.children=[];this.dead=true;}
  on(event,handler){this.events[event]=handler;}
}
class Sprite extends Display{constructor(texture){super();this.texture=texture;}}
const source= (id,quantity=1) => ({id,x:10,y:20,size:70,quantity,data:{name:'Potion',img:'potion.webp',flags:{buxaframework:{item:{rarityId:'rare'}}},system:{quantity}}});

test('PIXI physical sprites mount once, persist through movement, and clean up on tear-down', async()=>{
  const old=Object.fromEntries(['canvas','PIXI','game','document','Hooks','ui'].map(key=>[key,globalThis[key]]));
  const scene={id:'scene',grid:{size:100,distance:5},flags:{buxaframework:{physicalItems:[source('a'),source('b')]}},
    getFlag(ns,key){return this.flags[ns]?.[key];}};
  const layer=new Display();
  globalThis.canvas={ready:true,scene,interface:layer,stage:{},tokens:{}};
  let loads=0;
  globalThis.PIXI={Container:Display,Sprite,Assets:{async load(){loads++;return {width:128,height:128};}}};
  globalThis.game={user:{id:'gm',isGM:true},settings:{get(){return {};}}};
  globalThis.document={addEventListener(){},getElementById(){return null;}};
  globalThis.Hooks={on(){}};
  try {
    refreshPhysicalCanvas();
    await new Promise(setImmediate);
    assert.equal(loads,2);
    assert.equal(layer.children.length,1);
    const root=layer.children[0];
    const original=root.children[0];
    assert.equal(original.children.length,1);
    scene.flags.buxaframework.physicalItems=[{...source('a'),x:100,y:200},source('b')];
    refreshPhysicalCanvas();
    await new Promise(setImmediate);
    assert.equal(root.children[0],original,'unchanged scene image should be reused');
    assert.equal(original.x,100);
    assert.equal(loads,2,'scene moves do not re-fetch textures');
    scene.flags.buxaframework.physicalItems=[source('a')];
    refreshPhysicalCanvas();
    assert.equal(root.children.length,1);
    assert.equal(loads,2);
    // Tear down must invalidate in-flight image loads and remove Pixi nodes.
    const events={};
    globalThis.Hooks={on:(name,fn)=>{events[name]=fn;}};
    installPhysicalItemCanvas();
    events.canvasTearDown();
    assert.equal(layer.children.length,0);
  }finally{
    for(const [key,value] of Object.entries(old))if(value===undefined)delete globalThis[key];else globalThis[key]=value;
  }
});
