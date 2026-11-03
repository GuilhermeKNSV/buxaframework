import test from 'node:test';
import assert from 'node:assert/strict';
import {diffGroundEntries,groundLayoutFingerprint} from '../scripts/apps/ground-container-view.js';
const cell=(id,index,qty=1)=>({sourceId:id,index,compartmentId:'main',rotation:0,data:{name:id,system:{quantity:qty}}});
test('keyed ground reconciliation only replaces changed items, preserving unchanged cell DOM',()=>{
 const before=diffGroundEntries(new Map(),[cell('axe',3),cell('gem',5)]).next;
 const result=diffGroundEntries(before,[cell('axe',3),cell('gem',5)]);
 assert.deepEqual(result.changed,[]);
 assert.deepEqual(result.removed,[]);
 const revised=diffGroundEntries(before,[cell('axe',3),cell('gem',6)]);
 assert.deepEqual(revised.changed.map(e=>e.sourceId),['gem']);
 assert.deepEqual(revised.removed,[]);
 assert.deepEqual(diffGroundEntries(revised.next,[cell('gem',6)]).removed,['axe']);
});
test('layout signature varies when masked cells or compartment bounds change',()=>{
 const rec={data:{name:'Bag',img:'bag.webp'}};
 const spec=(cells)=>[{bag:{storageId:'root:main',columns:5,rows:5,mode:'complex',cells},crop:{x:1,y:1,columns:3,rows:3}}];
 assert.notEqual(groundLayoutFingerprint(rec,spec([6,7,8])),groundLayoutFingerprint(rec,spec([6,7,8,11])));
});
