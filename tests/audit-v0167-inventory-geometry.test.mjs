import test from 'node:test';
import assert from 'node:assert/strict';
import { gridDimensions, rotatedCells, createPlacementScanner } from '../scripts/core/inventory-shapes.js';

const malformed=Array.from({length:24},(_,index)=>index+2).flatMap(n=>[{
  label:`array containing ${n}`,value:[n]
},{
  label:`number-coercible object for ${n}`,value:{ valueOf(){return n;} }
}]);
const bent={cells:[{x:0,y:0},{x:1,y:0},{x:0,y:1}]};
const normal = rotatedCells(bent,0);
for(const {label,value} of malformed){
  test(`Complex inventory ignores ${label} for columns`,()=>assert.equal(gridDimensions({columns:value}).columns,10));
  test(`Complex inventory ignores ${label} for rows`,()=>assert.equal(gridDimensions({rows:value}).rows,5));
  test(`Complex inventory ignores ${label} for quarter-turns`,()=>assert.deepEqual(rotatedCells(bent,value),normal));
  test(`Complex scanner ignores ${label} as saved rotation`,()=>{
    const scan=createPlacementScanner({axe:bent},{columns:10,rows:5});
    assert.deepEqual(scan.cellsFor('axe',value),normal);
  });
}
for(const value of [true,false]){
 test(`Complex inventory ignores boolean ${value} for columns`,()=>assert.equal(gridDimensions({columns:value}).columns,10));
 test(`Complex inventory ignores boolean ${value} for rows`,()=>assert.equal(gridDimensions({rows:value}).rows,5));
 test(`Complex inventory ignores boolean ${value} for rotation`,()=>assert.deepEqual(rotatedCells(bent,value),normal));
}

test('legacy zero dimensions still use saved-grid defaults',()=>assert.deepEqual(gridDimensions({columns:0,rows:0}),{columns:10,rows:5,activeCells:50}));
