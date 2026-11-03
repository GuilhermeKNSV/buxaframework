import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveComplexPlacement} from '../scripts/core/complex-drop-resolution.js';
import {createPlacementScanner} from '../scripts/core/inventory-shapes.js';
const geometry={left:100,top:100,right:500,bottom:400,columns:8,rows:6,cellSize:50};
const shapes={L:{cells:[{x:0,y:0},{x:0,y:1},{x:1,y:1}]}, block:{cells:[{x:0,y:0}]}, coin:{cells:[{x:0,y:0}]}};
const scan=()=>createPlacementScanner(shapes,{columns:8,rows:6});
const resolve=(s,x,y,turn=0,grip=[18,65])=>resolveComplexPlacement(geometry,x,y,grip[0],grip[1],s,'L',turn);

test('the top-left footprint is used unchanged when free',()=>{
  const value=resolve(scan(),248,220);
  assert.equal(value.index,8+2); // col 2, row 1
  assert.equal(value.left,200);
  assert.equal(value.top,150);
  assert.equal(value.valid,true);
  assert.equal(value.assisted,false);
});

test('tight placement avoids occupied cells only within one neighboring origin',()=>{
  const s=scan();
  s.occupy('block',10); // block original top cell at (2,1)
  const placement=resolve(s,248,220);
  assert.equal(placement.valid,true);
  assert.notEqual(placement.index,10);
  assert.equal(s.fits('L',placement.index,0),true);
  assert.equal(placement.assisted,true);
});

test('surrounded shape remains visibly invalid instead of silently landing elsewhere',()=>{
  const s=scan();
  for (let row=0;row<5;row++) for(let col=0;col<5;col++) s.occupied.set(row*8+col,'block');
  const location=resolve(s,248,220);
  assert.equal(location.valid,false);
  assert.equal(location.index,10);
});

test('shape clamps at board edges while keeping all cells inside',()=>{
  const s=scan();
  const location=resolve(s,105,125);
  assert.equal(location.index,0);
  assert.equal(location.valid,true);
  assert.equal(location.left,100);
});

test('rotation uses the rotated shape and preserves exact preview/drop geometry',()=>{
  const s=scan();
  const location=resolve(s,245,225,1,[45,15]);
  assert.equal(location.valid,true);
  assert.equal(location.index, (location.top-100)/50*8+(location.left-100)/50);
  assert.equal(s.fits('L',location.index,1),true);
});

test('outside, nonsensical coordinates and outsize shapes cannot be placed',()=>{
  const s=scan();
  assert.equal(resolve(s,75,125),null);
  assert.equal(resolve(s,NaN,150),null);
  const big=createPlacementScanner({huge:{cells:Array.from({length:8},(_,x)=>({x,y:0}))}},{columns:4,rows:4});
  assert.equal(resolveComplexPlacement({left:0,top:0,right:200,bottom:200,columns:4,rows:4,cellSize:50},70,70,0,0,big,'huge'),null);
});
