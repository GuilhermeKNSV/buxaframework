import test from 'node:test';
import assert from 'node:assert/strict';
const get = (obj, path) => String(path).split('.').reduce((o,k)=>o?.[k],obj);
const set = (obj,path,value) => {const bits=path.split('.');let p=obj;for(const key of bits.slice(0,-1)) p=p[key]??={};p[bits.at(-1)]=structuredClone(value);};
globalThis.foundry={utils:{deepClone:structuredClone,getProperty:get,setProperty:set,escapeHTML:String,randomID:()=> 'abcd',hasProperty:(o,p)=>get(o,p)!==undefined},dice:{},documents:{}};
globalThis.game={user:{id:'gm',isGM:true},system:{id:'dnd5e'},settings:{get:()=>({})},items:{get:()=>undefined}};
globalThis.Hooks={callAll:()=>{}};
const {executeItemUse,itemUseState}=await import('../scripts/core/item-use-runtime.js');
const {resolveItemDice}=await import('../scripts/core/item-dice.js');
function fixture(effects=[],limits={}){
 const config={resources:[{id:'hp',label:'HP',link:'buxa',startMax:100},{id:'mp',label:'MP',link:'buxa',startMax:20}],attributes:{entries:[]},proficiencies:{entries:[]},items:{}};
 const contents=[]; contents.get=id=>contents.find(i=>i.id===id);
 const actor={id:'hero',documentName:'Actor',isOwner:true,items:contents,flags:{buxaframework:{resources:{hp:{value:50,max:100},mp:{value:20,max:20}}}},getFlag(n,k){return get(this.flags,`${n}.${k}`);},async update(changes){for(const [k,v] of Object.entries(changes))set(this,k,v);}};
 const item={id:'sword',name:'Sword',type:'weapon',img:'sword.png',parent:actor,system:{quantity:1},flags:{buxaframework:{item:{resourceEffects:effects,limits},itemUsage:{used:0}}},getFlag(n,k){return get(this.flags,`${n}.${k}`);},async update(changes){for(const [k,v] of Object.entries(changes))set(this,k,v);}};
 contents.push(item);return{actor,item,config};
}
test('resource dice apply advantage and disadvantage to d4/d10, not only d20',()=>{
 const {actor,item,config}=fixture();
 assert.equal(resolveItemDice(item,{count:2,faces:10,flat:3,rollMode:'advantage'},{actor,config}).formula,'4d10kh2 + 3');
 assert.equal(resolveItemDice(item,{count:3,faces:4,rollMode:'disadvantage'},{actor,config}).formula,'6d4kl3');
 assert.equal(resolveItemDice(item,{count:1,faces:6,rollMode:'normal'},{actor,config}).formula,'1d6');
});
test('failed roll rolls back only mana drained by this use, retaining a separate HP edit',async()=>{
 const {actor,item,config}=fixture([{resourceId:'mp',action:'drain',timing:'before',amount:5}]);
 await assert.rejects(executeItemUse(item,{actor,config,performRoll:async()=>{
   assert.equal(get(actor,'flags.buxaframework.resources.mp.value'),15);
   set(actor,'flags.buxaframework.resources.hp.value',43);
   return false;
 }}),/could not be completed/);
 assert.equal(get(actor,'flags.buxaframework.resources.mp.value'),20);
 assert.equal(get(actor,'flags.buxaframework.resources.hp.value'),43);
});
test('external mana change during roll is never overwritten by after phase or rollback',async()=>{
 const {actor,item,config}=fixture([
  {resourceId:'mp',action:'drain',timing:'before',amount:2},
  {resourceId:'mp',action:'fill',timing:'after',amount:3}
 ]);
 await assert.rejects(executeItemUse(item,{actor,config,performRoll:async()=>{
   assert.equal(get(actor,'flags.buxaframework.resources.mp.value'),18);
   set(actor,'flags.buxaframework.resources.mp.value',17);
   return {};
 }}),/resource recovery needs review/);
 assert.equal(get(actor,'flags.buxaframework.resources.mp.value'),17);
});
test('external use-counter updates during async roll are preserved, not refunded',async()=>{
 const {actor,item,config}=fixture([],{enabled:true,maxUses:4});
 await assert.rejects(executeItemUse(item,{actor,config,performRoll:async()=>{
   set(item,'flags.buxaframework.itemUsage',{used:1});return {};
 }}),/Item (?:uses|charges) changed/);
 assert.equal(itemUseState(item,config).usage.used,1);
});
test('post-save hook failure restores the use counter without granting a free charge',async()=>{
 const {actor,item,config}=fixture([],{enabled:true,maxUses:4});
 const update=item.update; item.update=async function(change){await update.call(this,change);throw Error('Post-save hook failure');};
 await assert.rejects(executeItemUse(item,{actor,config}),/Post-save hook failure/);
 assert.equal(itemUseState(item,config).usage.used,0);
});

test('missing dice and modifier sources reject use before spending any HP/MP',async()=>{
 for(const invalid of [
   {attributeDice:{enabled:true,attributeId:'deleted',faces:10}},
   {modifier:{source:'attribute',id:'deleted'}},
   {modifier:{source:'proficiency',id:'deleted'}}
 ]) {
   const {actor,item,config}=fixture([{resourceId:'mp',amountType:'dice',count:1,faces:10,...invalid}]);
   let called=false;
   await assert.rejects(executeItemUse(item,{actor,config,performRoll:async()=>{called=true;return{};}}),/missing.*(attribute|proficiency)/);
   assert.equal(called,false);
   assert.equal(get(actor,'flags.buxaframework.resources.mp.value'),20);
 }
});
