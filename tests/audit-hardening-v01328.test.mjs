import test from 'node:test';
import assert from 'node:assert/strict';
import { physicalDistanceFt, nearestLinkedToken, canInteractPhysical, physicalDropRange, normalizePhysicalArtwork } from '../scripts/core/physical-items.js';
import { fitsExternalStorage, normalizeStorageTooltip, normalizeItemStorage } from '../scripts/core/item-storage.js';
import { validateGroundChildBundle, groundAddBranch, groundRemoveBranch, groundMoveWithin } from '../scripts/core/ground-container.js';

const ns='buxaframework';
const unit={grid:{size:100,distance:5}};
const shape=(cells=[{x:0,y:0}])=>({flags:{[ns]:{item:{shape:{cells}}}},system:{quantity:1},name:'Item'});
const chest=()=>({id:'c',data:{flags:{[ns]:{item:{storage:{slots:{external:[{
  id:'main',mode:'complex',columns:3,rows:3,cells:[0,1,2,3,4,5,6,7,8]
}]}}},backpackContents:[]}}}});
let next=0;
const uid=()=>`item-${++next}`;
const child=(sourceId,providerId='root')=>({sourceId,providerId,compartmentId:'main',index:0,rotation:0,data:shape()});

test('distance authorization fails closed on invalid coordinates',()=>{
  assert.equal(physicalDistanceFt({x:NaN,y:10},{x:0,y:0},unit),Infinity);
  assert.equal(physicalDistanceFt({x:null,y:10},{x:0,y:0},unit),Infinity);
  assert.equal(physicalDistanceFt({x:'',y:10},{x:0,y:0},unit),Infinity);
  assert.equal(physicalDistanceFt({x:100,y:10},{x:undefined,y:0},unit),Infinity);
  assert.equal(physicalDistanceFt({x:100,y:10},{x:Infinity,y:0},unit),Infinity);
  const viewer={id:'u',isGM:false};
  const actors=[{id:'a',getFlag:()=>['u']}];
  const tokens=[{actorId:'a',x:NaN,y:100,width:1,height:1},
    {actorId:'a',x:200,y:200,width:1,height:1,document:{hidden:true}}];
  assert.equal(nearestLinkedToken(viewer,unit,{x:200,y:200},actors,tokens),null);
  assert.equal(canInteractPhysical({user:viewer,scene:unit,item:{x:200,y:200,size:70},actors,tokens,
    settings:{lootDistance:500},operation:'loot'}).allowed,false);
  assert.equal(physicalDropRange({user:viewer,actorId:'a',scene:unit,actors,tokens}).allowed,false);
});

test('nested branch import rejects duplicate IDs, missing parents, and cycles',()=>{
  assert.equal(validateGroundChildBundle([child('a'),child('b','a')]),true);
  assert.throws(()=>validateGroundChildBundle([child('a'),child('a')]),/Duplicate/);
  assert.throws(()=>validateGroundChildBundle([child('a','b'),child('b','a')]),/Circular/);
  assert.throws(()=>validateGroundChildBundle([child('a','missing')]),/missing its parent/);
  assert.throws(()=>validateGroundChildBundle([child('same'),child('same')]),/Duplicate/);
  assert.throws(()=>validateGroundChildBundle([child('a',{ref:'bad'})]),/metadata/);
  assert.throws(()=>validateGroundChildBundle([{...child('a'),index:-1}]),/metadata/);
});

test('a malicious nested bundle cannot modify a chest or allocate duplicate item IDs',()=>{
  const base=chest();
  assert.throws(()=>groundAddBranch(base,shape(),[child('bad','missing')],'root:main',0,0,uid),/missing its parent/);
  assert.equal(base.data.flags[ns].backpackContents.length,0);
  const sourceId='same';
  const corrupt=()=>sourceId;
  assert.throws(()=>groundAddBranch(base,shape(),[child('nested')],'root:main',0,0,corrupt),/unique nested item IDs/);
  const stored=groundAddBranch(base,shape(),[],'root:main',0,0,uid);
  const nested=structuredClone(stored);
  nested.data.flags[ns].backpackContents.push(child('broken','missing'));
  const id=stored.data.flags[ns].backpackContents[0].sourceId;
  assert.throws(()=>groundRemoveBranch(nested,id),/missing its parent/);
  assert.throws(()=>groundMoveWithin(nested,id,'root:main',1),/missing its parent/);
});

test('a backpack cannot be put in a grandchild container, and invalid rotations are rejected',()=>{
  const bag={columns:3,rows:2,storageId:'child:pocket',providerId:'child',mode:'simple'};
  const placements={parent:{area:'inventory',index:0},child:{area:'storage',storageId:'parent:pocket',index:0}};
  assert.equal(fitsExternalStorage(bag,placements,{},'parent',1),false);
  assert.equal(fitsExternalStorage(bag,placements,{},'other',1),true);
  assert.equal(fitsExternalStorage(bag,placements,{},'other',1,0.5),false);
  assert.equal(fitsExternalStorage({...bag,columns:0},placements,{},'other',0),false);
});

test('invalid existing 2-cell footprint does not wrap into a later row',()=>{
  const bag={columns:3,rows:2,storageId:'root:main',providerId:'root',mode:'complex',itemMode:'complex',cells:[0,1,2,3,4,5]};
  const shapes={broken:{cells:[{x:0,y:0},{x:1,y:0}]},incoming:{cells:[{x:0,y:0}]}};
  const placements={broken:{area:'storage',storageId:'root:main',index:2,rotation:0}};
  assert.equal(fitsExternalStorage(bag,placements,shapes,'incoming',3),true);
});

test('storage tooltip rows are uniquely addressable, limited to 40 characters',()=>{
  const rows=[{id:'same',label:'A',value:'a'}, {id:'same',label:'B',value:'b'},
    {id:'s'.repeat(40),label:'C',value:'c'}, {id:'s'.repeat(40),label:'D',value:'d'}];
  const clean=normalizeStorageTooltip({rows}).rows;
  assert.equal(clean.length,4);
  assert.equal(new Set(clean.map(row=>row.id)).size,4);
  assert.ok(clean.every(row=>row.id.length<=40));
});

test('duplicate maximum-length compartment IDs remain within schema limits',()=>{
  const id='a'.repeat(48);
  const slots=normalizeItemStorage({slots:{external:[{id},{id},{id}]}}).slots.external;
  assert.equal(new Set(slots.map(s=>s.id)).size,3);
  assert.ok(slots.every(s=>s.id.length<=48));
});

test('partial artwork edits do not reset coordinates when form values are blank',()=>{
  const original={x:215,y:340,size:88,rotation:90};
  const artwork=normalizePhysicalArtwork({x:null,y:'',size:undefined,rotation:180},original);
  assert.deepEqual(artwork,{x:215,y:340,size:88,rotation:180});
});

test('a 250-item packed chest remains valid and accessible at the advertised limit',()=>{
  const packed=Array.from({length:250},(_,i)=>({...child(`packed-${i}`),index:i}));
  assert.equal(validateGroundChildBundle(packed),true);
  assert.throws(()=>validateGroundChildBundle([...packed,child('over-limit')]),/Invalid nested container item count/);
});
