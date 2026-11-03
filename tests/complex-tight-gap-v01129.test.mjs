import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPlacementScanner, rotatedCells } from '../scripts/core/inventory-shapes.js';
import { pickedOccupiedShapeCell, rotateGrabbedShapeCell, resolveAnchoredComplexPlacement } from '../scripts/core/complex-grid-anchor.js';
import { measureComplexBoard } from '../scripts/core/complex-drag-geometry.js';
import { pointerCellIndex } from '../scripts/core/complex-stack-target.js';
import { getInventoryDropDestination } from '../scripts/apps/inventory-drop-target.js';
import { getInventoryState, moveInventoryItem } from '../scripts/core/inventory.js';
import { normalizeItemSystemConfig } from '../scripts/core/item-config.js';

const axe = { cells: [{x:0,y:0},{x:1,y:0},{x:0,y:1},{x:0,y:2},{x:0,y:3}] };
const sword = { cells: [{x:0,y:0},{x:0,y:1}] };
const rune = { cells: [{x:0,y:0},{x:1,y:0},{x:2,y:0},{x:1,y:1}] };
const coin = { cells:[{x:0,y:0}] };
const gem = { cells:[{x:0,y:0}] };
const shapes = {axe,sword,rune,coin,gem};
const dimensions = {columns:6,rows:6,activeCells:36};
const basePlacements = {
  axe:{area:'inventory',index:0,rotation:0},
  sword:{area:'inventory',index:1*6+2,rotation:0},
  rune:{area:'inventory',index:4*6+0,rotation:0},
  coin:{area:'inventory',index:2*6+1,rotation:0},
  gem:{area:'inventory',index:3*6+4,rotation:0}
};
const geometry = {left:20,top:23,right:368,bottom:371,columns:6,rows:6,cellSize:58,cellHeight:58};
const scan = (exclude='gem', placements=basePlacements) => {
  const s=createPlacementScanner(shapes,dimensions);
  for(const [id,p] of Object.entries(placements)) if(id!==exclude)s.occupy(id,p.index,p.rotation||0);
  return s;
};
const at=(x,y)=>({x:geometry.left+(x+.5)*58,y:geometry.top+(y+.5)*58});
const located=(scanner,id,grab,col,row,rotation=0)=>{
  const p=at(col,row);
  return resolveAnchoredComplexPlacement(geometry,p.x,p.y,grab,scanner,id,rotation);
};

test('screenshot layout: every genuinely vacant gap fits a 1x1, despite irregular neighboring bounds',()=>{
  const scanner=scan();
  // Gap at (1,1) is INSIDE the axe's bounding box, but not its occupied mask.
  assert.equal(scanner.occupied.has(1*6+1),false);
  for(const [x,y] of [[1,1],[1,3],[2,0],[3,2],[3,3]]){
    const p=located(scanner,'gem',{x:0,y:0},x,y);
    assert.equal(p.index,y*6+x);
    assert.equal(p.valid,true,`cell ${x},${y} must accept gem`);
  }
  for(const [x,y] of [[0,2],[1,2],[2,1],[1,4]]){
    assert.equal(located(scanner,'gem',{x:0,y:0},x,y).valid,false,`occupied ${x},${y}`);
  }
});

test('explicit occupied-square pickup chooses tile not rectangular area; hole never makes a hit',()=>{
  const tiles=rotatedCells(axe,0);
  assert.deepEqual(pickedOccupiedShapeCell(tiles,{pieceX:0,pieceY:3}),{x:0,y:3});
  assert.deepEqual(pickedOccupiedShapeCell(tiles,{hitIndex:3*6,originIndex:0,columns:6}),{x:0,y:3});
  assert.equal(pickedOccupiedShapeCell(tiles,{pieceX:1,pieceY:1}),null);
  assert.equal(pickedOccupiedShapeCell(tiles,{hitIndex:1*6+1,originIndex:0,columns:6}),null);
  assert.deepEqual(pickedOccupiedShapeCell(tiles,{pieceX:1,pieceY:1,hitIndex:0,originIndex:0,columns:6}),{x:0,y:0});
});

test('rotated axe follows the actual grabbed tile without overlaps through all four turns',()=>{
  const rotatedBoard={...geometry,right:geometry.left+8*58,bottom:geometry.top+8*58,columns:8,rows:8};
  const scanner=createPlacementScanner({axe,blocker:coin},{columns:8,rows:8});
  scanner.occupy('blocker',7*8+7,0);
  let anchor={x:0,y:3};
  for(let turns=0;turns<4;turns++){
    const x=rotatedBoard.left+3.5*58, y=rotatedBoard.top+3.5*58;
    const point=resolveAnchoredComplexPlacement(rotatedBoard,x,y,anchor,scanner,'axe',turns);
    assert.equal(point.valid,true,`turn ${turns}: free destination`);
    assert.equal(point.index,(3-anchor.y)*8+3-anchor.x);
    const shape=rotatedCells(axe,turns);
    const height=Math.max(...shape.map(c=>c.y))+1;
    for(const cell of shape){
      const sx=point.index%8+cell.x,sy=Math.floor(point.index/8)+cell.y;
      assert.ok(sx>=0&&sx<8&&sy>=0&&sy<8);
      assert.equal(scanner.occupied.has(sy*8+sx),false);
    }
    anchor=rotateGrabbedShapeCell(anchor,height);
  }
});

test('non-square browser board dimensions align visual pickup and saved cell',()=>{
  const board={style:{getPropertyValue:k=>k.endsWith('columns')?'6':'6'},getBoundingClientRect:()=>({left:20,top:23,right:368,bottom:365,width:348,height:342})};
  const g=measureComplexBoard(board);
  assert.equal(g.cellSize,58);assert.equal(g.cellHeight,57);
  const cursor={x:20+1.5*58,y:23+1.5*57};
  assert.equal(pointerCellIndex(g,cursor.x,cursor.y),7);
  const result=resolveAnchoredComplexPlacement(g,cursor.x,cursor.y,{x:0,y:0},scan(),'gem',0);
  assert.equal(result.index,7);assert.equal(result.valid,true);
  assert.equal(result.top,80);assert.equal(result.left,78);
});

test('board chrome cannot create phantom hitboxes; native drop shares measured cell geometry',()=>{
  const board={
    style:{getPropertyValue:k=>k.endsWith('columns')?'4':'2'},
    getBoundingClientRect:()=>({left:20,top:30,right:220,bottom:154,width:200,height:124}),
    querySelector:()=>({getBoundingClientRect:()=>({left:21,top:31,width:50,height:50})})
  };
  const geom=measureComplexBoard(board);
  assert.equal(geom.left,21);assert.equal(geom.top,31);
  assert.equal(geom.bottom,131); // 2 * 50, not the extra 24px of board chrome
  const target={closest:selector=>selector==='[data-complex-board]'?board:null};
  assert.deepEqual(getInventoryDropDestination({target,clientX:75,clientY:105}),{area:'inventory',index:5});
  assert.equal(getInventoryDropDestination({target,clientX:75,clientY:145}),null);
});

test('actor move to a real 1x1 gap persists its exact cell, without repacking other shapes',async()=>{
  const all=Object.entries(shapes).map(([id,shape])=>({id,name:id,img:'icons/svg/item-bag.svg',type:'loot',system:{quantity:1},getFlag:(namespace,key)=>namespace==='buxaframework'&&key==='item'?{shape}:null}));
  const items={get:id=>all.find(item=>item.id===id),[Symbol.iterator]:function*(){yield* all;}};
  const saved={version:4,autoSort:false,sortMode:'alphabetic',tracked:all.map(item=>item.id),placements:structuredClone(basePlacements),equipmentActive:{}};
  const actor={id:'actor1',isOwner:true,items,getFlag:(_,key)=>key==='inventory'?saved:null,
    update:async payload=>{Object.assign(saved,structuredClone(payload['flags.buxaframework.inventory']));}};
  const config={items:normalizeItemSystemConfig(),resources:[],inventory:{mode:'complex',complex:dimensions}};
  globalThis.foundry={utils:{deepClone:structuredClone,equals:(a,b)=>JSON.stringify(a)===JSON.stringify(b),getProperty:(data,path)=>path.split('.').reduce((value,k)=>value?.[k],data)}};
  globalThis.Hooks={callAll:()=>{}};
  const result=await moveInventoryItem(actor,'gem',{area:'inventory',index:7,rotation:0},config);
  assert.ok(result);
  assert.equal(result.placements.gem.index,7);
  for(const [id,placement] of Object.entries(basePlacements)){
    if(id!=='gem') { assert.equal(result.placements[id]?.index,placement.index); assert.equal(result.placements[id]?.area,placement.area); assert.equal(result.placements[id]?.rotation||0,placement.rotation||0); }
  }
  assert.equal(getInventoryState(actor,config).placements.gem.index,7);
});

test('templates and runtime carry exact click-tile coordinates for complex items, including pouches',()=>{
 const markup=readFileSync(new URL('../templates/player-sheet.hbs',import.meta.url),'utf8');
 const controls=readFileSync(new URL('../scripts/apps/inventory-controls.js',import.meta.url),'utf8');
 assert.match(markup,/data-buxa-piece-x="{{x}}" data-buxa-piece-y="{{y}}"/);
 assert.match(controls,/pickedOccupiedShapeCell\(sourceCells/);
 assert.match(controls,/if \(!dragging\) \{ cleanup\(\); return; \}/);
});
