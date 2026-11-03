import test from 'node:test';
import assert from 'node:assert/strict';
import {
  groundAddBranch, groundDirectItems, groundMoveWithin, groundPlacement
} from '../scripts/core/ground-container.js';

const namespace='buxaframework';
const shape=cells=>({flags:{[namespace]:{item:{shape:{cells}}}},system:{quantity:1},name:'Test item'});
const one=shape([{x:0,y:0}]);
const two=shape([{x:0,y:0},{x:1,y:0}]);
const chest=(columns,rows)=>({id:'chest',data:{flags:{[namespace]:{
  item:{storage:{slots:{external:[{id:'main',mode:'complex',columns,rows,
    cells:Array.from({length:columns*rows},(_,i)=>i)}]}}},backpackContents:[]}}}});
let counter=0;
const id=()=>`child-${++counter}`;

test('repositioning the only ground-container item does not collide with its own saved footprint',()=>{
  const record=groundAddBranch(chest(4,1),two,[],'root:main',0,0,id);
  const stored=groundDirectItems(record)[0];
  // The new footprint at 1 overlaps its ORIGINAL position at 1, but the
  // moving item must be ignored while validating the placement.
  const moved=groundMoveWithin(record,stored.sourceId,'root:main',1,0);
  assert.equal(groundDirectItems(moved).length,1);
  assert.equal(groundDirectItems(moved)[0].index,1);
  assert.equal(groundDirectItems(record)[0].index,0);
  const stayed=groundMoveWithin(record,stored.sourceId,'root:main',0,0);
  assert.equal(groundDirectItems(stayed)[0].index,0);
});

test('out-of-bounds preferred indexes never skip the only free storage cell',()=>{
  let record=chest(3,1);
  record=groundAddBranch(record,one,[],'root:main',0,0,id);
  record=groundAddBranch(record,one,[],'root:main',1,0,id);
  assert.equal(groundPlacement(record,one,'root:main',0,-1),2);
  assert.equal(groundPlacement(record,one,'root:main',0,-4),2);
  assert.equal(groundPlacement(record,one,'root:main',0,999999),2);
});
