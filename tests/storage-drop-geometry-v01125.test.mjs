import test from 'node:test';import assert from 'node:assert/strict';
import {storageBoardAt, storagePlacementAt} from '../scripts/core/storage-drop-geometry.js';
const board={storageId:'b:bag',columns:3,rows:3,complex:true,rect:{left:100,top:200,right:250,bottom:350,width:150,height:150}};
test('storage board geometry hit test does not read layout per pointermove',()=>{
 assert.equal(storageBoardAt([board],112,212),board);
 assert.equal(storageBoardAt([board],260,212),null);
});
test('external placement tracks grabbed complex cell and supports rotation',()=>{
 assert.deepEqual(storagePlacementAt(board,175,225,{x:1,y:0},1),{area:'storage',storageId:'b:bag',index:0,rotation:1});
 assert.equal(storagePlacementAt(board,125,225,{x:1,y:0},0),null);
});
test('simple compartment targets pointer tile, never shape anchor',()=>{
 assert.equal(storagePlacementAt({...board,complex:false},225,275,{x:2,y:1},3).index,5);
});
