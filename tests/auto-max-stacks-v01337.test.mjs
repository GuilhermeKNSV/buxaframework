import test from 'node:test';
import assert from 'node:assert/strict';
import {MODULE_ID,DEFAULT_SHEET_CONFIG} from '../scripts/core/constants.js';
import {normalizeItemRules} from '../scripts/core/item-config.js';
import {maxStackOf,stackRoom,planStackTransfer} from '../scripts/core/stack-capacity.js';
import {importStackableToActor} from '../scripts/core/stack-native-import.js';
import {groundDirectItems} from '../scripts/core/ground-container.js';
import {receiveGroundStacks} from '../scripts/core/ground-stack-receiver.js';

let seq=0;
const get=(o,path)=>String(path).split('.').reduce((p,key)=>p?.[key],o);
const set=(o,path,value)=>{const keys=path.split('.');let p=o;for(const key of keys.slice(0,-1))p=p[key]??={};p[keys.at(-1)]=value;};
const rules=(maxStack=10)=>({multiple:{enabled:true,maxStack},shape:{width:1,height:1,cells:[{x:0,y:0}]}});
function data(quantity,max=10) {return {name:'Arrows',type:'loot',img:'arrow.png',system:{quantity},
  flags:{[MODULE_ID]:{item:rules(max),itemInstance:{originUuid:'Item.arrows'}}}};}
const view=value=>({...value,getFlag(ns,key){return get(this.flags?.[ns],key);}});
function fixture(slots=5) {
 const before=Object.fromEntries(['game','foundry','Hooks','CONST'].map(key=>[key,globalThis[key]]));
 globalThis.foundry={utils:{deepClone:structuredClone,randomID:()=>`stack-instance-${++seq}`,equals:(a,b)=>JSON.stringify(a)===JSON.stringify(b),getProperty:get,setProperty:set,hasProperty:(o,p)=>get(o,p)!==undefined}};
 globalThis.Hooks={callAll(){}};
 globalThis.game={system:{id:'dnd5e'}};
 const config=structuredClone(DEFAULT_SHEET_CONFIG);config.inventory.mode='simple';config.inventory.slots=slots;
 const items=new(class extends Map{[Symbol.iterator](){return this.values();}})();
 let failCreate=false;
 const actor={id:'a',isOwner:true,items,flags:{[MODULE_ID]:{inventory:{version:4,tracked:[],placements:{},autoSort:false}}},
  getFlag(ns,key){return get(this.flags[ns],key);},
  async update(patch){for(const [key,value]of Object.entries(patch))set(this,key,value);},
  async createEmbeddedDocuments(_type,records) {
   if(failCreate)throw Error('Creation refused');
   return records.map(row=>{const doc=view(structuredClone(row));doc.id=`created-${++seq}`;
      doc.parent=actor;doc.toObject=()=>({...structuredClone(row),_id:doc.id,system:structuredClone(doc.system)});
      items.set(doc.id,doc);return doc;});
  },
  async deleteEmbeddedDocuments(_type,ids){return ids.map(id=>{const item=items.get(id);items.delete(id);return item;}).filter(Boolean);},
  async updateEmbeddedDocuments(_type,patches){for(const patch of patches){const item=items.get(patch._id);if(!item)throw Error('Item missing');item.system.quantity=patch['system.quantity'];}return patches;}
 };
 const placeExisting=(id,quantity,index,max=10)=>{
   const doc=view({...data(quantity,max),id,parent:actor,toObject(){return {...data(this.system.quantity,max),_id:id};}});
   items.set(id,doc);actor.flags[MODULE_ID].inventory.tracked.push(id);
   actor.flags[MODULE_ID].inventory.placements[id]={area:'inventory',index};return doc;
 };
 const source=view({...data(23),id:'source',uuid:'Item.arrows',toObject(){return {...data(23),_id:'source'};}});
 return {config,actor,source,placeExisting,set failCreate(v){failCreate=v;},restore(){for(const [key,value]of Object.entries(before))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}};
}

test('Max Stack normalizes with safe backward-compatible defaults and bounds',()=>{
 assert.equal(normalizeItemRules({multiple:{enabled:true}}).multiple.maxStack,99);
 assert.equal(normalizeItemRules({multiple:{enabled:true,maxStack:10}}).multiple.maxStack,10);
 assert.equal(normalizeItemRules({multiple:{enabled:true,maxStack:0}}).multiple.maxStack,1);
 assert.equal(normalizeItemRules({multiple:{enabled:true,maxStack:999999999}}).multiple.maxStack,999999);
 assert.equal(maxStackOf(view(data(10)),{items:{}}),10);
});
test('capacity planner fills partial stacks, never exceeds either target maximum',()=>{
 const config=structuredClone(DEFAULT_SHEET_CONFIG);
 const source=view(data(27));const six=view(data(6));const full=view(data(10));
 assert.equal(stackRoom(source,full,config),0);
 const plan=planStackTransfer(source,27,[full,six],config);
 assert.deepEqual(plan.merges.map(entry=>entry.amount),[4]);
 assert.deepEqual(plan.chunks,[10,10,3]);
});
test('world Item imported into inventory fills existing six arrows and creates 10 + 9',async()=>{
 const f=fixture();try{
  const prior=f.placeExisting('old',6,0);
  const receipt=await importStackableToActor(f.actor,f.source,null,f.config);
  assert.equal(prior.system.quantity,10);
  assert.deepEqual(receipt.created.map(item=>item.system.quantity),[10,9]);
  assert.deepEqual([...f.actor.items].map(item=>item.system.quantity).sort((a,b)=>a-b),[9,10,10]);
  assert.deepEqual(new Set(Object.values(f.actor.getFlag(MODULE_ID,'inventory').placements).map(p=>p.index)),new Set([0,1,2]));
  assert.equal(f.source.system.quantity,23,'world template unchanged');
 }finally{f.restore();}
});
test('complete fit merges into existing inventory stack without consuming any slot',async()=>{
 const f=fixture(1);try{
  const existing=f.placeExisting('old',9,0);
  f.source.system.quantity=1;f.source.toObject=()=>({...data(1),_id:'source'});
  const receipt=await importStackableToActor(f.actor,f.source,null,f.config);
  assert.equal(existing.system.quantity,10);
  assert.equal(receipt.created.length,0);
  assert.equal(f.actor.items.size,1);
  assert.equal(receipt.item.id,'old');
  await receipt.rollback();assert.equal(existing.system.quantity,9);
 }finally{f.restore();}
});
test('insufficient capacity rejects all new stacks and restores existing quantities',async()=>{
 const f=fixture(2);try{
  const existing=f.placeExisting('old',6,0);
  await assert.rejects(importStackableToActor(f.actor,f.source,null,f.config),/room|space|stack/i);
  assert.equal(existing.system.quantity,6);
  assert.equal(f.actor.items.size,1);
  assert.equal(f.source.system.quantity,23);
 }finally{f.restore();}
});
test('receiving ground chest items combines compatible arrows and creates capped overflow',()=>{
 const bag={id:'bag',mode:'complex',columns:4,rows:2,cells:[0,1,2,3,4,5,6,7]};
 const packed=[{sourceId:'first',providerId:'root',compartmentId:'bag',index:0,rotation:0,data:data(6)}];
 const box={id:'box',data:{name:'Chest',flags:{[MODULE_ID]:{item:{storage:{slots:{external:[bag]}}},backpackContents:packed}}}};
 const received=receiveGroundStacks(box,data(27),[],{storageId:'root:bag'},()=>`new-${++seq}`,structuredClone(DEFAULT_SHEET_CONFIG));
 const stacks=groundDirectItems(received);
 assert.deepEqual(stacks.map(item=>item.data.system.quantity).sort((a,b)=>a-b),[3,10,10,10]);
 assert.equal(groundDirectItems(box)[0].data.system.quantity,6,'pure transform leaves original record untouched');
});
test('ground storage rejects overflow without changing original chest',()=>{
 const bag={id:'bag',mode:'complex',columns:1,rows:1,cells:[0]};
 const stored={sourceId:'one',providerId:'root',compartmentId:'bag',index:0,rotation:0,data:data(6)};
 const box={id:'box',data:{name:'Chest',flags:{[MODULE_ID]:{item:{storage:{slots:{external:[bag]}}},backpackContents:[stored]}}}};
 assert.throws(()=>receiveGroundStacks(box,data(8),[],{storageId:'root:bag'},()=>`new-${++seq}`,structuredClone(DEFAULT_SHEET_CONFIG)),/insufficient room/);
 assert.equal(groundDirectItems(box)[0].data.system.quantity,6);
});

test('moving an oversized old stack into an inventory area splits it and fills neighbors',async()=>{
 const {autoStackMovedItem}=await import('../scripts/core/stack-on-move.js');
 const f=fixture(5);try{
  const moved=f.placeExisting('moved',27,0);
  const other=f.placeExisting('other',6,1);
  await autoStackMovedItem(f.actor,'moved',f.config);
  assert.equal(moved.system.quantity,10);
  assert.equal(other.system.quantity,10);
  assert.deepEqual([...f.actor.items].map(item=>item.system.quantity).sort((a,b)=>a-b),[3,10,10,10]);
 }finally{f.restore();}
});

test('Max Stack 1 means each incoming item takes its own slot',async()=>{
 const f=fixture(3);try{
  const source=view({...data(3,1),uuid:'Item.arrows',toObject(){return {...data(3,1),_id:'original'};}});
  const receipt=await importStackableToActor(f.actor,source,null,f.config);
  assert.deepEqual(receipt.created.map(item=>item.system.quantity),[1,1,1]);
  assert.equal(f.actor.items.size,3);
 }finally{f.restore();}
});

test('explicit chest drop into a matching partial stack fills it and leaves extras elsewhere',()=>{
 const bag={id:'pouch',mode:'complex',columns:2,rows:1,cells:[0,1]};
 const old={sourceId:'old',providerId:'root',compartmentId:'pouch',index:0,rotation:0,data:data(8)};
 const box={id:'box',data:{flags:{[MODULE_ID]:{item:{storage:{slots:{external:[bag]}}},backpackContents:[old]}}}};
 const next=receiveGroundStacks(box,data(4),[],{storageId:'root:pouch',index:0},()=>`extra-${++seq}`);
 assert.deepEqual(groundDirectItems(next).map(x=>x.data.system.quantity),[10,2]);
 assert.deepEqual(groundDirectItems(next).map(x=>x.index),[0,1]);
});

test('stack import never carries Foundry-mutated parent options into another Item creation or merge',async()=>{
 const f=fixture(5);try{
  const old=f.placeExisting('old',6,0);
  const create=f.actor.createEmbeddedDocuments.bind(f.actor);
  const merge=f.actor.updateEmbeddedDocuments.bind(f.actor);
  const deleteItems=f.actor.deleteEmbeddedDocuments.bind(f.actor);
  let creations=0,merges=0;
  f.actor.createEmbeddedDocuments=async(type,records,options)=>{
    assert.ok(options && !('parent' in options) && !('pack' in options),'new Item operations must have clean options');
    options.parent=f.actor;options.pack='a-stale-pack';creations++;
    return create(type,records);
  };
  f.actor.updateEmbeddedDocuments=async(type,records,options)=>{
    assert.ok(options && !('parent' in options) && !('pack' in options),'quantity updates must have clean options');
    options.parent=f.actor;options.pack='a-stale-pack';merges++;
    return merge(type,records);
  };
  f.actor.deleteEmbeddedDocuments=async(type,ids,options)=>{
    assert.ok(options && !('parent' in options) && !('pack' in options),'rollback must have clean options');
    options.parent=f.actor;return deleteItems(type,ids);
  };
  const receipt=await importStackableToActor(f.actor,f.source,null,f.config);
  assert.equal(creations,2);
  assert.equal(merges,1);
  assert.equal(old.system.quantity,10);
  assert.deepEqual(receipt.created.map(item=>item.system.quantity),[10,9]);
  await receipt.rollback();
  assert.equal(old.system.quantity,6);
  assert.equal(f.actor.items.size,1);
 }finally{f.restore();}
});

test('auto-stack moved item uses fresh options across merges and source changes',async()=>{
 const {autoStackMovedItem}=await import('../scripts/core/stack-on-move.js');
 const f=fixture(5);try{
  const source=f.placeExisting('moved',27,0), target=f.placeExisting('target',6,1);
  const update=f.actor.updateEmbeddedDocuments.bind(f.actor);
  let mutations=0;
  f.actor.updateEmbeddedDocuments=async(type,patches,options)=>{
    assert.ok(options && !('parent' in options) && !('pack' in options));
    options.parent=f.actor;options.pack='stale';mutations++;
    return update(type,patches);
  };
  await autoStackMovedItem(f.actor,'moved',f.config);
  assert.ok(mutations>=2);
  assert.equal(source.system.quantity,10);
  assert.equal(target.system.quantity,10);
  assert.deepEqual([...f.actor.items].map(item=>item.system.quantity).sort((a,b)=>a-b),[3,10,10,10]);
 }finally{f.restore();}
});

test('late stack rollback never overwrites an unrelated newer quantity',async()=>{
 const f=fixture(1);try{
  const existing=f.placeExisting('old',9,0);
  f.source.system.quantity=1;f.source.toObject=()=>({...data(1),_id:'source'});
  const receipt=await importStackableToActor(f.actor,f.source,null,f.config);
  assert.equal(existing.system.quantity,10);
  existing.system.quantity=7; // Another user edited the live document.
  await assert.rejects(receipt.rollback(),/GM to reconcile quantities/);
  assert.equal(existing.system.quantity,7,'must not restore stale quantity');
 }finally{f.restore();}
});

test('late stack rollback does not delete a newly imported stack altered by another operation',async()=>{
 const f=fixture(2);try{
  f.source.system.quantity=1;f.source.toObject=()=>({...data(1),_id:'source'});
  const receipt=await importStackableToActor(f.actor,f.source,null,f.config);
  assert.equal(receipt.created.length,1);
  receipt.created[0].system.quantity=2;
  await assert.rejects(receipt.rollback(),/GM to reconcile quantities/);
  assert.equal(f.actor.items.get(receipt.created[0].id)?.system.quantity,2);
 }finally{f.restore();}
});


test('concurrent refill while importing cannot overfill the originally planned stack',async()=>{
 const f=fixture(5);try{
  const old=f.placeExisting('old',6,0);
  const create=f.actor.createEmbeddedDocuments.bind(f.actor);
  let changed=false;
  f.actor.createEmbeddedDocuments=async(type,records,options)=>{
    if(!changed){changed=true;old.system.quantity=9;}
    return create(type,records,options);
  };
  await assert.rejects(importStackableToActor(f.actor,f.source,null,f.config),/quantity changed/);
  assert.equal(old.system.quantity,9,'new external quantity remains intact');
  assert.equal(f.actor.items.size,1,'newly created overflow stacks were rolled back');
 }finally{f.restore();}
});

test('auto stack refuses stale target quantities changed during overflow creation',async()=>{
 const {autoStackMovedItem}=await import('../scripts/core/stack-on-move.js');
 const f=fixture(6);try{
  const moved=f.placeExisting('moved',27,0);
  const other=f.placeExisting('other',6,1);
  const create=f.actor.createEmbeddedDocuments.bind(f.actor);
  let changed=false;
  f.actor.createEmbeddedDocuments=async(...args)=>{
    const result=await create(...args);
    if(!changed){changed=true;other.system.quantity=9;}
    return result;
  };
  await assert.rejects(autoStackMovedItem(f.actor,'moved',f.config),/Target stack changed/);
  assert.equal(moved.system.quantity,27);
  assert.equal(other.system.quantity,9,'remote target edit must survive rollback');
  assert.equal(f.actor.items.size,2,'overflow copies must be deleted');
 }finally{f.restore();}
});

test('auto stack refuses stale source quantities changed during overflow creation',async()=>{
 const {autoStackMovedItem}=await import('../scripts/core/stack-on-move.js');
 const f=fixture(6);try{
  const moved=f.placeExisting('moved',27,0);
  const other=f.placeExisting('other',6,1);
  const create=f.actor.createEmbeddedDocuments.bind(f.actor);
  let changed=false;
  f.actor.createEmbeddedDocuments=async(...args)=>{
    const result=await create(...args);
    if(!changed){changed=true;moved.system.quantity=28;}
    return result;
  };
  await assert.rejects(autoStackMovedItem(f.actor,'moved',f.config),/changed|rolled back/);
  assert.equal(moved.system.quantity,28,'remote source edit must survive rollback');
  assert.equal(other.system.quantity,6);
  assert.equal(f.actor.items.size,2);
 }finally{f.restore();}
});

test('auto stack treats a post-delete hook exception as success only after deletion persisted',async()=>{
 const {autoStackMovedItem}=await import('../scripts/core/stack-on-move.js');
 const f=fixture(3);try{
  const moved=f.placeExisting('moved',2,0);
  const other=f.placeExisting('other',8,1);
  const remove=f.actor.deleteEmbeddedDocuments.bind(f.actor);
  f.actor.deleteEmbeddedDocuments=async(...args)=>{await remove(...args);throw Error('post-delete hook failed');};
  await autoStackMovedItem(f.actor,moved.id,f.config);
  assert.equal(f.actor.items.get(moved.id),undefined);
  assert.equal(other.system.quantity,10);
 }finally{f.restore();}
});

test('invalid source and target stack quantities never become one transfer unit',async()=>{
 const {autoStackMovedItem}=await import('../scripts/core/stack-on-move.js');
 const f=fixture(5);try{
  const moved=f.placeExisting('moved',4,0);
  const other=f.placeExisting('other',7,1);
  for (const broken of ['not-a-number', '', 1.5, -1, true]) {
    moved.system.quantity=broken;
    await assert.rejects(autoStackMovedItem(f.actor,moved.id,f.config),/invalid stack quantity/i);
    assert.throws(()=>planStackTransfer(moved,1,[other],f.config),/Invalid source stack quantity/);
    assert.equal(other.system.quantity,7);
  }
  moved.system.quantity=4;
  other.system.quantity=Number.NaN;
  assert.equal(stackRoom(moved,other,f.config),0,'corrupt target cannot accept a merge');
 }finally{f.restore();}
});
