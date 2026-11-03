import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initialGrabOffset, rotateGrabOffset, complexPointerDestination, exteriorShapeEdges, edgeBorderStyle} from '../scripts/core/complex-drag-geometry.js';
import {rotatedCells, shapeBounds} from '../scripts/core/inventory-shapes.js';
const read=p=>fs.readFileSync(new URL(`../${p}`, import.meta.url),'utf8');
const L={cells:[{x:0,y:0},{x:0,y:1},{x:1,y:1}]};
const board=()=>({style:{getPropertyValue:n=>n.includes('columns')?'8':'6'},getBoundingClientRect:()=>({left:100,top:80,width:400,height:300,right:500,bottom:380})});

test('complex drag destination follows snapped ghost origin, not cursor cell',()=>{
 const b=board();
 const grip=initialGrabOffset({x:30,y:70,sourceWidth:100,sourceHeight:100,cellSize:50,width:2,height:2});
 assert.deepEqual(grip,{x:30,y:70});
 const drop=complexPointerDestination(b,239,222,grip.x,grip.y);
 assert.deepEqual(drop,{area:'inventory',index:10,left:200,top:130,cellSize:50});
 assert.equal(complexPointerDestination(b,101,100,grip.x,grip.y),null);
 assert.equal(complexPointerDestination(b,540,200,grip.x,grip.y),null);
});

test('four 90-degree turns preserve same grabbed cursor point without accumulating drift',()=>{
 const b=board();let cells=rotatedCells(L,0),bounds=shapeBounds(cells);
 let grip=initialGrabOffset({x:24,y:49,sourceWidth:100,sourceHeight:100,cellSize:50,width:bounds.width,height:bounds.height});
 const initial={...grip};
 for(let r=1;r<=4;r++){
   const previousHeight=bounds.height*50;
   grip=rotateGrabOffset(grip,previousHeight);
   cells=rotatedCells(L,r);bounds=shapeBounds(cells);
   assert.ok(grip.x>=0 && grip.x<=bounds.width*50);
   assert.ok(grip.y>=0 && grip.y<=bounds.height*50);
   const pointX=215,pointY=206;
   const destination=complexPointerDestination(b,pointX,pointY,grip.x,grip.y);
   if(destination){
      assert.equal(destination.index,Math.floor((pointY-grip.y-80)/50)*8+Math.floor((pointX-grip.x-100)/50));
      assert.equal(destination.left,100+(destination.index%8)*50);
   }
 }
 assert.ok(Math.abs(initial.x-grip.x)<1e-8);
 assert.ok(Math.abs(initial.y-grip.y)<1e-8);
});

test('only exterior borders are drawn for neighboring squares, including L shape',()=>{
 const cells=exteriorShapeEdges(rotatedCells(L,0));
 const at=(x,y)=>cells.find(c=>c.x===x&&c.y===y);
 assert.equal(at(0,0).bottom,false);
 assert.equal(at(0,1).top,false);
 assert.equal(at(0,1).right,false);
 assert.equal(at(1,1).left,false);
 assert.match(edgeBorderStyle(at(0,1)),/--buxa-edge-top:0px/);
 const rect=exteriorShapeEdges(Array.from({length:16},(_,i)=>({x:i%4,y:Math.floor(i/4)})));
 assert.ok(rect.filter(c=>c.top).length===4);
 assert.ok(rect.filter(c=>c.left).length===4);
 assert.ok(rect.filter(c=>c.right).length===4);
 assert.ok(rect.filter(c=>c.bottom).length===4);
});

test('manual complex placement never triggers auto pack and drag release recomputes latest position',()=>{
 const inv=read('scripts/core/inventory.js');
 const ctl=read('scripts/apps/inventory-controls.js');
 const release=ctl.slice(ctl.indexOf('const finish ='),ctl.indexOf('const cancel ='));
 assert.match(inv,/if \(isComplex\(inventoryConfig\) && nextDestination\.area === "inventory"\) state\.autoSort = false/);
 assert.match(release,/dropAt\(endEvent\.clientX, endEvent\.clientY, underPointer\)/);
 assert.match(ctl,/resolveAnchoredComplexPlacement\(boardGeometry, x, y, grabbedCell/);
 assert.match(ctl,/ghost\.style\.transform = `translate3d\(\${drawX}px, \${drawY}px, 0\)`/);
 assert.match(ctl,/rotateGrabbedShapeCell\(grabbedCell, previousHeight\)/);
});

test('complex items render a masked rarity backdrop with uninterrupted artwork and corner-only rectangular accents',()=>{
 const tpl=read('templates/player-sheet.hbs');
 const css=read('styles/136-complex-drag-alignment.css');
 assert.match(tpl,/class="buxa-complex-backdrop"/);
 assert.match(tpl,/is-rectangular-shape/);
 assert.match(css,/\.buxa-complex-item\.is-rectangular-shape::after/);
 assert.match(css,/border-width: 0 !important/);
 assert.match(css,/--buxa-edge-top/);
 assert.match(read('styles/buxa.css'),/136-complex-drag-alignment\.css/);
});
