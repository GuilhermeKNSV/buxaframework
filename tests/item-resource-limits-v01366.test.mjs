import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const get=(object,path)=>String(path).split('.').reduce((v,k)=>v?.[k],object);
function set(object,path,value){let o=object;const p=path.split('.');for(const k of p.slice(0,-1))o=o[k]??={};o[p.at(-1)]=structuredClone(value);}
globalThis.foundry={utils:{deepClone:structuredClone,getProperty:get,setProperty:set,escapeHTML:String,randomID:()=>`id-${Math.random()}`,hasProperty:(o,p)=>get(o,p)!==undefined},dice:{},documents:{}};
globalThis.game={user:{id:'gm',isGM:true},system:{id:'dnd5e'},settings:{get:()=>({})},items:{get:()=>undefined}};
globalThis.Hooks={callAll:()=>{}};
const {normalizeItemRules}=await import('../scripts/core/item-config.js');
const {normalizeItemResourceEffects,normalizeItemLimits,remainingItemUses}=await import('../scripts/core/item-use-config.js');
const {executeItemUse,itemUseState,preflightItemUse}=await import('../scripts/core/item-use-runtime.js');
function setup(effects=[],limits={}){
  const config={resources:[{id:'health',label:'HP',link:'buxa',startMax:100},{id:'mana',label:'MP',link:'buxa',startMax:20}],attributes:{entries:[]},proficiencies:{entries:[]},items:{}};
  const list=[];list.get=id=>list.find(item=>item.id===id);
  const actor={id:'actor',documentName:'Actor',isOwner:true,items:list,flags:{buxaframework:{resources:{health:{value:60,max:100},mana:{value:20,max:20}}}},writes:[],
    getFlag(ns,key){return get(this.flags,`${ns}.${key}`);},
    async update(changes){this.writes.push(changes);for(const [path,v] of Object.entries(changes))set(this,path,v);},
    async deleteEmbeddedDocuments(type,ids){assert.equal(type,'Item');for(const id of ids){const index=list.findIndex(i=>i.id===id);if(index>=0)list.splice(index,1);}}
  };
  const item={id:'instance1',name:'Potion',type:'loot',img:'icons/svg/potion.svg',parent:actor,system:{quantity:1},
    flags:{buxaframework:{item:{resourceEffects:effects,limits},itemUsage:{used:0}}},writes:[],
    getFlag(ns,key){return get(this.flags,`${ns}.${key}`);},
    async update(changes){this.writes.push(changes);for(const [path,v] of Object.entries(changes))set(this,path,v);},
  };list.push(item);return{config,actor,item};
}
test('legacy Items receive inert defaults, and invalid fields are clamped',()=>{
  const rules=normalizeItemRules({});assert.deepEqual(rules.resourceEffects,[]);
  assert.equal(rules.limits.enabled,false);
  assert.equal(remainingItemUses(rules.limits,{used:10}),null);
  const effects=normalizeItemResourceEffects([{amountType:'dice',count:300,faces:0,rollMode:'weird',resourceId:'mana'}]);
  assert.deepEqual([effects[0].count,effects[0].faces,effects[0].rollMode],[100,2,'normal']);
  assert.equal(normalizeItemLimits({enabled:true,maxUses:-9,onExhaust:'unknown'}).maxUses,1);
});
test('multiple before/after rules apply to distinct HP/MP including percent of maximum',async()=>{
  const {config,actor,item}=setup([
    {resourceId:'mana',action:'drain',timing:'before',amountType:'flat',amount:5},
    {resourceId:'health',action:'fill',timing:'after',amountType:'percent',amount:12.5}
  ]);
  let observed=-1;
  const result=await executeItemUse(item,{actor,config,performRoll:async()=>{
    observed=actor.getFlag('buxaframework','resources.mana.value');return{};
  }});
  assert.equal(observed,15,'before effect applies before performing the roll');
  assert.equal(actor.getFlag('buxaframework','resources.mana.value'),15);
  assert.equal(actor.getFlag('buxaframework','resources.health.value'),73);
  assert.equal(result.resources.length,2);
});
test('dice-based restore reuses Foundry formula with roll modifiers and clamps at max',async()=>{
  const {config,actor,item}=setup([{resourceId:'mana',action:'fill',timing:'after',amountType:'dice',count:2,faces:10,flat:3,rollMode:'advantage'}]);
  set(actor,'flags.buxaframework.resources.mana.value',2);
  const formulas=[];
  foundry.dice.Roll=class{constructor(formula){formulas.push(formula);this.total=22;}async evaluate(){return this;}};
  await executeItemUse(item,{actor,config});
  assert.deepEqual(formulas,['4d10kh2 + 3']);
  assert.equal(actor.getFlag('buxaframework','resources.mana.value'),20);
});
test('drain refuses insufficient MP without executing roll or modifying anything',async()=>{
  const {config,actor,item}=setup([{resourceId:'mana',action:'drain',timing:'before',amount:30}]);
  let rolled=false;
  await assert.rejects(executeItemUse(item,{actor,config,performRoll:async()=>{rolled=true;return{};}}),/Not enough MP/);
  assert.equal(rolled,false);assert.equal(actor.writes.length,0);
});
test('failed main roll restores spent resources and does not consume a use',async()=>{
  const {config,actor,item}=setup([{resourceId:'mana',action:'drain',amount:5}],{enabled:true,maxUses:4});
  await assert.rejects(executeItemUse(item,{actor,config,performRoll:async()=>false}),/could not be completed/);
  assert.equal(actor.getFlag('buxaframework','resources.mana.value'),20);
  assert.equal(itemUseState(item,config).remaining,4);
});
test('four successful uses then lock; fifth use does not spend resources',async()=>{
  const {config,actor,item}=setup([{resourceId:'mana',action:'drain',amount:2}],{enabled:true,maxUses:4,onExhaust:'disable'});
  for(let i=0;i<4;i++){
    const r=await executeItemUse(item,{actor,config});assert.equal(r.remaining,3-i);
  }
  assert.equal(itemUseState(item,config).exhausted,true);
  assert.equal(actor.getFlag('buxaframework','resources.mana.value'),12);
  await assert.rejects(executeItemUse(item,{actor,config}),/no (?:uses|charges) remaining/);
  assert.equal(actor.getFlag('buxaframework','resources.mana.value'),12);
});
test('last use destroys exactly the owned Item',async()=>{
  const {config,actor,item}=setup([],{enabled:true,maxUses:1,onExhaust:'destroy'});
  const result=await executeItemUse(item,{actor,config});
  assert.equal(result.outcome,'destroyed');assert.equal(actor.items.length,0);
});
test('transform updates the same Item ID and resets usage without losing inventory position',async()=>{
  const {config,actor,item}=setup([],{enabled:true,maxUses:1,onExhaust:'transform',transformItemId:'new-template'});
  const replacement={id:'new-template',name:'Empty flask',type:'loot',img:'icons/svg/bottle.svg',system:{quantity:1},
    getFlag:()=>undefined,toObject(){return structuredClone({name:this.name,img:this.img,type:this.type,system:this.system});}};
  game.items.get=id=>id==='new-template'?replacement:null;
  const r=await executeItemUse(item,{actor,config});
  assert.equal(r.outcome,'transformed');assert.equal(actor.items.get('instance1'),item);
  assert.equal(item.name,'Empty flask');assert.equal(itemUseState(item,config).exhausted,false);
});
test('bad transformation target rejects use BEFORE draining resources',async()=>{
  const {config,actor,item}=setup([{resourceId:'mana',action:'drain',amount:3}],{enabled:true,maxUses:1,onExhaust:'transform',transformItemId:'missing'});
  game.items.get=()=>null;
  await assert.rejects(executeItemUse(item,{actor,config}),/Choose a valid world Item/);
  assert.equal(actor.writes.length,0);
});
test('new tabs, sheet UI, context menu, and hover tooltip expose their working controls',()=>{
  const file=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
  for(const section of ['resource','limits']) assert.match(file('scripts/apps/item-use-editor.js'),new RegExp(`addTab\\('${section}'`));
  assert.match(file('scripts/apps/item-config.js'),/\.\.\.readItemUseEditor\(root\)/);
  assert.match(file('templates/item-sheet.hbs'),/buxa-item-use-caption[^\n]*> Charges<\/span>/);
  assert.match(file('scripts/apps/item-context-menu.js'),/data-action='use-item'/);
  assert.match(file('scripts/apps/item-tooltip.js'),/buxa-item-use-effect/);
});

test('limited-use Item copies must never auto-merge and lose an independent use counter',async()=>{
  const {config,item}=setup([], {enabled:true,maxUses:4});
  const second={...item,id:'instance2',uuid:'Actor.a.Item.other'};
  const {sameStackType}=await import('../scripts/core/stack-capacity.js');
  const raw={...item.flags.buxaframework.item,multiple:{enabled:true,stackKey:'potion-key'}};
  item.flags.buxaframework.item=raw; second.flags={buxaframework:{item:raw,itemUsage:{used:0}}};
  assert.equal(sameStackType(item,second,config),false);
});
test('destroying a charge-limited stack consumes one unit rather than deleting the whole stack',async()=>{
  const {config,actor,item}=setup([],{enabled:true,maxUses:1,onExhaust:'destroy'});
  item.system.quantity=3;
  const result=await executeItemUse(item,{actor,config});
  assert.equal(result.outcome,'one consumed');assert.equal(actor.items.length,1);
  assert.equal(item.system.quantity,2);assert.equal(itemUseState(item,config).remaining,1);
});
test('a multi-item stack cannot transform and silently consume all remaining units',async()=>{
  const {config,actor,item}=setup([],{enabled:true,maxUses:1,onExhaust:'transform',transformItemId:'flask'});
  item.system.quantity=3;
  await assert.rejects(executeItemUse(item,{actor,config}),/Unstack this item/);
  assert.equal(item.system.quantity,3);
});
test('post-update hook exceptions after HP drain still trigger a resource rollback',async()=>{
  const {config,actor,item}=setup([{resourceId:'mana',action:'drain',amount:3}]);
  const original=actor.update.bind(actor);let first=true;
  actor.update=async data=>{await original(data);if(first){first=false;throw new Error('Hook failure after save');}};
  await assert.rejects(executeItemUse(item,{actor,config}),/Hook failure/);
  assert.equal(actor.getFlag('buxaframework','resources.mana.value'),20);
});
