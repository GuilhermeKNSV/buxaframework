import test from 'node:test';
import assert from 'node:assert/strict';
import { MODULE_ID } from '../scripts/core/constants.js';
import { normalizeNpcDropping, npcDropCapacity, npcDropResource, normalizeNpcDropEntry, rollNpcDrops } from '../scripts/core/npc-dropping.js';
import { canPutInDirectoryTab } from '../scripts/apps/directory-tabs.js';

const template = { id:'axe-12345', data:{name:'Axe', system:{quantity:1}}, chance:100, min:1, max:5, destination:'ground' };
const config = { npc:{ dropping:{defaultSlots:12,resourceId:'mana'} }, resources:[{id:'mana'},{id:'hp'}] };
const invalidNumeric = Array.from({length:24}, (_,i) => i + 2).flatMap(n => [
  {name:`array containing ${n}`,value:[n]},
  {name:`coercible object for ${n}`,value:{valueOf(){return n;}}}
]);
for (const {name,value} of invalidNumeric) {
  test(`NPC default capacity ignores invalid ${name}`, () => assert.equal(normalizeNpcDropping({defaultSlots:value}).defaultSlots,12));
  test(`NPC per-Actor capacity ignores invalid ${name}`, () => assert.equal(npcDropCapacity({getFlag:()=>value},config),12));
  test(`NPC item drop chance ignores invalid ${name}`, () => assert.equal(normalizeNpcDropEntry({...template,chance:value}).chance,100));
  test(`NPC item minimum ignores invalid ${name}`, () => assert.equal(normalizeNpcDropEntry({...template,min:value}).min,1));
  test(`NPC item maximum ignores invalid ${name}`, () => assert.equal(normalizeNpcDropEntry({...template,max:value}).max,1));
}
for (const value of [true,false,new Boolean(true),new Number(4)]) {
  test(`NPC chance rejects Boolean/boxed input ${String(value)}`, () => assert.equal(normalizeNpcDropEntry({...template,chance:value}).chance,100));
  test(`NPC default capacity rejects Boolean/boxed input ${String(value)}`, () => assert.equal(normalizeNpcDropping({defaultSlots:value}).defaultSlots,12));
}
for(const [name,resource] of [
 ['missing','missing'],['empty',''],['unknown','stamina'],['array',['mana']],['object',{id:'mana'}],['number',42],['bool',true]
]) {
 test(`NPC resource override ${name} never masks configured world resource`,()=>{
   const actor={getFlag:()=>resource};
   assert.equal(npcDropResource(actor,config)?.id,'mana');
 });
}
for(const [name,system] of [['string','invalid'],['number',2],['boolean',true],['array',[]]]) {
 test(`NPC loot rolls with malformed legacy Item system (${name})`,()=>{
   const result=rollNpcDrops([{...template,data:{name:'Axe',system}}],()=>0.1);
   assert.equal(result.length,1);
   assert.equal(result[0].data.system.quantity,1);
 });
}
for (const bad of [NaN, Infinity, -Infinity]) {
 test(`NPC RNG ${String(bad)} does not silently force a guaranteed drop`,()=>{
   assert.deepEqual(rollNpcDrops([template],()=>bad),[]);
 });
}
for(const type of ['Item','Actor','Scene']) {
 test(`${type} tabs reject wrong-collection destination`,()=>{
   const entry={id:'doc',documentName:type};
   const wrong={id:'other',type:type==='Item'?'Scene':'Item'};
   assert.equal(canPutInDirectoryTab(entry,type,'other',id=>id==='other'?wrong:null),false);
 });
 test(`${type} tabs reject missing destination folders`,()=>{
   const entry={id:'doc',documentName:type};
   assert.equal(canPutInDirectoryTab(entry,type,'missing',()=>null),false);
 });
}

test('NPC legacy Item snapshot with uncloneable data is rejected without throwing',()=>{
  assert.equal(normalizeNpcDropEntry({...template,data:{name:'Invalid',script(){}}}),null);
});
test('NPC legacy weight flag saved as string false stays disabled',()=>{
  const entry=normalizeNpcDropEntry({...template,weights:'1:100,2:0',weightsEnabled:'false'});
  assert.equal(entry.weightsEnabled,false);
});
test('NPC invalid Actor override respects explicit non-hp module selection',()=>{
  assert.equal(npcDropResource({getFlag:()=> 'missing'},config)?.id,'mana');
});
test('NPC valid Actor override still takes precedence over module resource',()=>{
  assert.equal(npcDropResource({getFlag:()=> 'hp'},config)?.id,'hp');
});
