import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {physicalItemVisible} from '../scripts/core/physical-item-visibility.js';
import {cellIndexAt,resolveComplexPointerHit} from '../scripts/core/inventory-pointer-hit.js';
import {rotatedCells} from '../scripts/core/inventory-shapes.js';
import {buildComplexHitMap} from '../scripts/core/inventory-hit-map.js';
const record={x:100,y:130,size:60};
const player={id:"test-player",isGM:false},gm={id:"test-gm",isGM:true};
const scene={id:'s',tokenVision:true};

test('physical item artwork, label and rarity effects are hidden when a player lacks current LOS',()=>{
  const calls=[];
  const visibility={tokenVision:true,testVisibility(points,opts){calls.push([points,opts]);return false;}};
  assert.equal(physicalItemVisible(record,{user:player,scene,visibility}),false);
  assert.equal(calls.length,1);
  assert.equal(calls[0][0].length,1,'test each point separately, rather than letting Foundry accept any visible corner');
  assert.deepEqual(calls[0][1],{tolerance:0});
  assert.equal(physicalItemVisible(record,{user:gm,scene,visibility}),true);
});
test('a visible corner cannot reveal the whole item; disabled token vision reveals items; missing API is fail-closed',()=>{
  const visibility={tokenVision:true,testVisibility(points){return points.some(p=>p.x>140);}};
  assert.equal(physicalItemVisible(record,{user:player,scene,visibility}),false,'one exposed corner cannot expose an item in fog');
  assert.equal(physicalItemVisible(record,{user:player,scene,visibility:{...visibility,testVisibility(){return true;}}}),true,'all samples in current vision reveals item');
  assert.equal(physicalItemVisible(record,{user:player,scene:{tokenVision:false},visibility:{tokenVision:false}}),true);
  assert.equal(physicalItemVisible(record,{user:player,scene,visibility:{tokenVision:true}}),false);
  assert.equal(physicalItemVisible(null,{user:player,scene,visibility}),false);
});
test('fallback to individual points supports older vision API signatures safely',()=>{
  const visibility={tokenVision:true,testVisibility(point){if(Array.isArray(point))throw Error('individual only');return point.x>140;}};
  assert.equal(physicalItemVisible(record,{user:player,scene,visibility}),false);
  const fullyLit={tokenVision:true,testVisibility(point){if(Array.isArray(point))throw Error('individual only');return true;}};
  assert.equal(physicalItemVisible(record,{user:player,scene,visibility:fullyLit}),true);
});
test('hit testing targets occupied grid cells, never irregular artwork bounding boxes',()=>{
  const geom={left:20,top:30,columns:5,rows:5,cellSize:40,cellHeight:40};
  const axe={id:'axe',index:0,pieces:rotatedCells({cells:[{x:0,y:0},{x:1,y:0},{x:0,y:1},{x:0,y:2}]},0)};
  const occupied=buildComplexHitMap([axe],5);
  const hit=(x,y)=>resolveComplexPointerHit(geom,20+(x+.5)*40,30+(y+.5)*40,occupied);
  assert.deepEqual(hit(0,0),{index:0,itemId:'axe'});
  assert.deepEqual(hit(0,2),{index:10,itemId:'axe'});
  assert.deepEqual(hit(1,1),{index:6,itemId:null},'hole must stay empty');
  assert.equal(cellIndexAt(geom,220,35),null,'right border outside board');
  assert.equal(cellIndexAt(geom,20,230),null,'bottom border outside board');
});
test('rotated footprints and adjacent items cannot steal each others pointer hits',()=>{
  const geom={left:0,top:0,columns:5,rows:5,cellSize:50,cellHeight:50};
  const shapes=[{id:'rune',index:0,pieces:rotatedCells({cells:[{x:0,y:0},{x:0,y:1},{x:0,y:2},{x:1,y:1}]},1)},
    {id:'coin',index:13,pieces:[{x:0,y:0}]}];
  const owners=buildComplexHitMap(shapes,5);
  assert.equal(resolveComplexPointerHit(geom,175,125,owners).itemId,'coin');
  assert.equal(resolveComplexPointerHit(geom,25,75,owners).itemId,null);
});
test('canvas listens to Foundry vision refresh and inventory uses authoritative occupied-cell routing',()=>{
  const canvas=readFileSync(new URL('../scripts/integrations/physical-item-canvas.js',import.meta.url),'utf8');
  const controls=readFileSync(new URL('../scripts/apps/inventory-controls.js',import.meta.url),'utf8');
  const bindings=readFileSync(new URL('../scripts/apps/inventory-board-hit-bindings.js',import.meta.url),'utf8');
  assert.match(canvas,/Hooks\.on\('sightRefresh',syncPhysicalItemVisibility\)/);
  assert.match(canvas,/Hooks\.on\('visibilityRefresh',syncPhysicalItemVisibility\)/);
  assert.match(canvas,/parent\.visible=physicalItemVisible/);
  assert.match(canvas,/parent\.eventMode=parent\.visible \? 'passive' : 'none'/);
  assert.match(bindings,/resolveComplexPointerHit\(geometry\(\),event\.clientX,event\.clientY,itemCells\)/);
  assert.match(controls,/if \(sourceBoard && !grabbedCell\) return;/);
});

test('real physical canvas group toggles item interaction and drawing on Foundry vision refresh',async()=>{
  const old=Object.fromEntries(['canvas','PIXI','game','document','Hooks','window','foundry'].map(k=>[k,globalThis[k]]));
  class Display {
    constructor(){this.children=[];this.parent=null;this.x=0;this.y=0;this.events={};
      this.position={set:(x,y)=>{this.x=x;this.y=y;}};this.anchor={set(){}};this.scale={set(){}};}
    addChild(child){this.children.push(child);child.parent=this;return child;}
    on(name,fn){this.events[name]=fn;return this;}
    destroy(){this.parent?.children.splice(this.parent.children.indexOf(this),1);this.parent=null;
      for(const child of [...this.children])child.destroy?.();this.children=[];}
  }
  class Sprite extends Display {constructor(texture){super();this.texture=texture;}}
  const record={id:'fogItem',x:100,y:150,size:60,quantity:1,
    data:{name:'Hidden Sword',img:'sword.webp',flags:{buxaframework:{item:{rarityId:'rare'}}},system:{quantity:1}}};
  const sceneObj={id:'fog',tokenVision:true,grid:{size:100,distance:5},flags:{buxaframework:{physicalItems:[record]}},
    getFlag(scope,key){return this.flags[scope]?.[key];}};
  const layer=new Display();const events={};let currentVisible=false, edgeX=Infinity, loads=0;
  globalThis.PIXI={Container:Display,Sprite,Assets:{async load(){loads++;return {width:64,height:64};}}};
  globalThis.game={user:{id:'p',isGM:false},settings:{get(){return {visualMode:'shadow'};}}};
  globalThis.document={addEventListener(){},getElementById(){return null;}};
  globalThis.window={addEventListener(){},removeEventListener(){}};
  globalThis.Hooks={on:(name,callback)=>{events[name]=callback;}};
  globalThis.canvas={ready:true,scene:sceneObj,interface:layer,visibility:{tokenVision:true,testVisibility(points){return currentVisible && points.some(point=>point.x<edgeX);}},
    stage:{},app:{ticker:{add(){},remove(){}}}};
  try {
    const {installPhysicalItemCanvas}=await import('../scripts/integrations/physical-item-canvas.js');
    installPhysicalItemCanvas();
    await new Promise(setImmediate);
    const item=layer.children[0].children[0];
    assert.equal(item.visible,false);
    assert.equal(item.eventMode,'none');
    assert.equal(item.children.length,1,'sprite mounted, but inaccessible while hidden');
    currentVisible=true;
    edgeX=145; // center is visible; right-hand core corners are not
    events.visibilityRefresh();
    assert.equal(item.visible,false,'a partially visible item cannot leak artwork, loot or beams into fog');
    edgeX=Infinity;
    events.visibilityRefresh();
    assert.equal(item.visible,true);
    assert.equal(item.eventMode,'passive');
    currentVisible=false;
    events.sightRefresh();
    assert.equal(item.visible,false);
    assert.equal(loads,1,'vision changes reuse the sprite and never load images');
  }finally{
    events.canvasTearDown?.();
    for(const [key,value] of Object.entries(old))if(value===undefined)delete globalThis[key];else globalThis[key]=value;
  }
});
