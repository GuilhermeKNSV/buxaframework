import test from 'node:test';
import assert from 'node:assert/strict';
import { getPackedContents, packedContentsCount } from '../scripts/core/backpack-transfers.js';
import { validateGroundChildBundle, groundAddBranch } from '../scripts/core/ground-container.js';

const NS='buxaframework';
const bad=value=>({name:'Chest',flags:{[NS]:{backpackContents:value,
  item:{storage:{slots:{external:[{id:'main',mode:'complex',columns:2,rows:2,cells:[0,1,2,3]}]}}}}}});
const item={name:'Gold',img:'gold.png',type:'loot',system:{quantity:1},flags:{[NS]:{item:{shape:{cells:[{x:0,y:0}]}}}}};

test('corrupted chest contents never masquerade as an empty container during a transfer',()=>{
 for(const value of [{sourceId:'lost'},'not-json',42]){
  assert.throws(()=>getPackedContents(bad(value)),/metadata is corrupt/);
  assert.throws(()=>packedContentsCount(bad(value)),/metadata is corrupt/);
  const chest={id:'chest',data:bad(value)};
  assert.throws(()=>groundAddBranch(chest,item,[],'root:main',0,0,()=>'new'),/metadata is corrupt/);
  assert.strictEqual(chest.data.flags[NS].backpackContents,value,'the original remains untouched');
 }
 assert.deepEqual(getPackedContents({}),[]);
 assert.equal(packedContentsCount({}),0);
});

test('ground bundle rejects invalid quarter-turns instead of persisting a corrupt rotation',()=>{
 for(const rotation of [-1,4,90,1.5]){
  assert.throws(()=>validateGroundChildBundle([{sourceId:'one',providerId:'root',compartmentId:'main',index:0,rotation,data:item}]),/Invalid nested container placement metadata/);
 }
 assert.equal(validateGroundChildBundle([{sourceId:'one',providerId:'root',compartmentId:'main',index:0,rotation:3,data:item}]),true);
});
