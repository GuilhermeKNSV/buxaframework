import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { physicalDropArtworkOrigin, physicalDropRange, canDropPhysical, normalizePhysicalSettings } from '../scripts/core/physical-items.js';
import { beginPhysicalInventoryDrag, activePhysicalInventoryRotation, rotatePhysicalInventoryPreview,
  endPhysicalInventoryDrag } from '../scripts/integrations/physical-inventory-preview.js';
const scene={width:1200,height:850,grid:{size:100,distance:5}};
const player={id:'player',isGM:false};
const gm={id:'gm',isGM:true};
const actor={id:'knight',getFlag:(_,key)=>key==='linkedUsers'?['player']:null};
const tokens=[{actorId:'knight',x:100,y:200,width:1,height:1,hidden:false}];
const settings={playerDropRangeEnabled:true,dropDistance:10,showDropRangeOutline:true};
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('drop preview and saved image use exactly the same pointer center',()=>{
  const center={x:388,y:410}, size=76;
  const saved=physicalDropArtworkOrigin(center,size,scene);
  assert.deepEqual(saved,{x:350,y:372});
  assert.equal(saved.x+size/2,center.x);
  assert.equal(saved.y+size/2,center.y);
  assert.equal(physicalDropArtworkOrigin({x:20,y:300},size,scene),null);
  assert.equal(physicalDropArtworkOrigin({x:1180,y:300},size,scene),null);
});
test('10 ft range uses the token center and includes exactly the boundary',()=>{
  const result=physicalDropRange({user:player,actorId:'knight',scene,actors:[actor],tokens,settings});
  assert.equal(result.radius,200);
  assert.deepEqual(result.centers,[{x:150,y:250}]);
  assert.equal(canDropPhysical({user:player,actorId:'knight',scene,actors:[actor],tokens,settings,
    point:{x:350,y:250}}).allowed,true);
  assert.equal(canDropPhysical({user:player,actorId:'knight',scene,actors:[actor],tokens,settings,
    point:{x:350.5,y:250}}).allowed,false);
  assert.equal(canDropPhysical({user:gm,actorId:'knight',scene,actors:[actor],tokens,settings,
    point:{x:1100,y:750}}).allowed,true);
  assert.equal(normalizePhysicalSettings({showDropRangeOutline:false}).showDropRangeOutline,false);
});
test('rotation state cycles through 4 turns, and is independent for the next external drag',()=>{
  beginPhysicalInventoryDrag({id:'axe'});
  assert.equal(rotatePhysicalInventoryPreview(),true);
  assert.equal(activePhysicalInventoryRotation(),1);
  rotatePhysicalInventoryPreview();rotatePhysicalInventoryPreview();rotatePhysicalInventoryPreview();
  assert.equal(activePhysicalInventoryRotation(),0);
  beginPhysicalInventoryDrag({id:'sword'});
  assert.equal(activePhysicalInventoryRotation(),0);
  endPhysicalInventoryDrag();
  assert.equal(rotatePhysicalInventoryPreview(),false);
});
test('native directory and Pixi drags share saved rotation and masked artwork preview',()=>{
  const bridge=source('scripts/integrations/physical-item-handoff.js');
  const preview=source('scripts/integrations/physical-inventory-preview.js');
  const pointer=source('scripts/integrations/physical-item-pointer.js');
  const board=source('scripts/integrations/physical-item-ghost.js');
  assert.match(bridge,/externalInventoryDropPosition\(item,target,event\.clientX,event\.clientY\)/);
  assert.match(bridge,/externalInventoryDropPosition\(\{id:item\.id,\.\.\.item\.data\},target,clientX,clientY\)/);
  assert.match(preview,/shapeArtworkStyle\(shape,rotation\)/);
  assert.match(preview,/createComplexDecorationSvg\(document,cells\)/);
  assert.match(preview,/rotation,grid:inventory\.complex/);
  assert.match(pointer,/clear\(state\.moved\)/);
  assert.match(board,/physicalDropArtworkOrigin\(center,Math\.round\(size\),scene\)/);
  assert.match(source('scripts/apps/gm-physical-panel.js'),/showDropRangeOutline/);
});

test('the temporary on-canvas outline matches the 10 ft validation radius',async()=>{
  const keys=['PIXI','canvas','game','document'];
  const before=Object.fromEntries(keys.map(key=>[key,globalThis[key]]));
  const circles=[];
  const board={getBoundingClientRect:()=>({left:0,top:0,width:1200,height:850}),contains:()=>false};
  const image={src:'',getAttribute(name){return name==='src'?this.src:null;}};
  const node={style:{},classList:{toggle(){}},setAttribute(){},append(child){this.image=child;},
    querySelector(){return image;},remove(){this.removed=true;}};
  class Graphics {
    constructor(){this.eventMode='none';}
    clear(){circles.length=0;}
    circle(x,y,r){circles.push([x,y,r]);return this;}
    stroke(){return this;}
    destroy(){this.destroyed=true;}
  }
  try {
    globalThis.PIXI={Point:class Point{constructor(x,y){this.x=x;this.y=y;}},Graphics};
    globalThis.document={getElementById:()=>board,elementFromPoint:()=>board,
      createElement:()=>({...node,style:{},classList:{toggle(){}},append:node.append,querySelector:node.querySelector}),body:{append(){}}};
    globalThis.game={user:player,actors:{contents:[actor]},settings:{get:()=>settings}};
    globalThis.canvas={ready:true,scene:{...scene,tokens:{contents:tokens}},grid:{size:100},
      stage:{scale:{x:1},toLocal:point=>point},app:{renderer:{screen:{width:1200,height:850},
        events:{mapPositionToPoint(point,x,y){point.x=x;point.y=y;}}}},interface:{addChild(){}}};
    const {showPhysicalDropGhost,clearPhysicalDropGhost}=await import('../scripts/integrations/physical-item-ghost.js');
    const result=showPhysicalDropGhost({img:'axe.png'},350,250,{actor});
    assert.equal(result,true);
    assert.deepEqual(circles,[[150,250,200]]);
    clearPhysicalDropGhost();
  }finally {for(const [key,value] of Object.entries(before)){
    if(value===undefined)delete globalThis[key];else globalThis[key]=value;
  }}
});
