import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const get=(o,p)=>String(p).split('.').reduce((v,k)=>v?.[k],o);
const set=(o,p,v)=>{let n=o;const parts=p.split('.');for(const key of parts.slice(0,-1)) n=n[key]??={};n[parts.at(-1)]=structuredClone(v);};
globalThis.foundry={utils:{deepClone:structuredClone,getProperty:get,setProperty:set,hasProperty:(o,p)=>get(o,p)!==undefined,randomID:()=> 'unique'},dice:{},documents:{}};
const handlers={};
globalThis.Hooks={on:(id,fn)=>{handlers[id]=fn;}};
globalThis.game={user:{id:'gm',isGM:true},users:{activeGM:{id:'gm'}},system:{id:'dnd5e'},settings:{get:()=>({})},items:{get:()=>undefined}};
const {normalizeItemLimits}=await import('../scripts/core/item-use-config.js');
const {rechargeItem,canRechargeWithItem}=await import('../scripts/core/item-recharge.js');
const {combatTurnAdvance,applyCombatRecharge,registerCombatItemRecharge}=await import('../scripts/integrations/combat-item-recharge.js');
const config={resources:[{id:'mp',label:'MP',link:'buxa',startMax:20}],attributes:{entries:[]},proficiencies:{entries:[]},items:{}};
function setup({used=3,button={},material=false,combat={}}={}) {
  const list=[];list.get=id=>list.find(item=>item.id===id);
  const actor={id:'actor',documentName:'Actor',uuid:'Actor.actor',isOwner:true,flags:{buxaframework:{resources:{mp:{value:14,max:20}}}},items:list,
    getFlag(ns,key){return get(this.flags,`${ns}.${key}`);},
    async update(changes){for(const [key,value] of Object.entries(changes))set(this,key,value);},
    async deleteEmbeddedDocuments(_type,ids){for(const id of ids){const index=list.findIndex(i=>i.id===id);if(index>=0)list.splice(index,1);}}
  };
  function item(id,rules,quantity=1,origin='') {const instance={id,parent:actor,name:id,system:{quantity},flags:{buxaframework:{item:rules,itemUsage:{used:id==='target'?used:0},itemInstance:{originUuid:origin}}},
    getFlag(ns,key){return get(this.flags,`${ns}.${key}`);},
    async update(changes){for(const [key,value] of Object.entries(changes))set(this,key,value);}}
    ;list.push(instance);return instance;}
  const rules={limits:{enabled:true,maxUses:4,recharge:{button:{enabled:true,charges:2,resourceId:'mp',cost:3,...button},item:{enabled:material,templateId:'battery',charges:2},combat:{enabled:true,charges:2,everyTurns:3,...combat}}}};
  const target=item('target',rules);
  const source=material?item('battery-owned',{},2,'Item.battery'):null;
  return {actor,target,source};
}
test('legacy Items have recharge disabled by default; all methods clamp their numeric settings',()=>{
  const rules=normalizeItemLimits({});assert.equal(rules.recharge.button.enabled,false);assert.equal(rules.recharge.item.enabled,false);
  assert.equal(normalizeItemLimits({recharge:{combat:{enabled:true,everyTurns:0,charges:10000000}}}).recharge.combat.charges,999999);
});
test('right-click recharges at most spent charges and deducts configured MP cost',async()=>{
  const {actor,target}=setup();const result=await rechargeItem(target,{actor,config});
  assert.equal(result.added,2);assert.equal(result.remaining,3);assert.equal(target.getFlag('buxaframework','itemUsage').used,1);
  assert.equal(actor.getFlag('buxaframework','resources.mp.value'),11);
  const result2=await rechargeItem(target,{actor,config});assert.equal(result2.added,1);assert.equal(result2.remaining,4);
  await assert.rejects(rechargeItem(target,{actor,config}),/fully charged/);
});
test('resource shortage does not grant free charges',async()=>{
  const {actor,target}=setup({button:{cost:17}});
  await assert.rejects(rechargeItem(target,{actor,config}),/Not enough MP/);
  assert.equal(target.getFlag('buxaframework','itemUsage').used,3);
});
test('dragging selected world template copy consumes one unit, preserves another and adds charges',async()=>{
  const {actor,target,source}=setup({material:true});
  assert.equal(canRechargeWithItem(source,target,config),true);
  const r=await rechargeItem(target,{actor,config,method:'item',source});
  assert.equal(r.added,2);assert.equal(source.system.quantity,1);
  assert.equal(actor.items.get('target'),target);
  await rechargeItem(target,{actor,config,method:'item',source});assert.equal(actor.items.get(source.id),undefined);
});
test('invalid material and unowned item cannot recharge',async()=>{
  const {actor,target,source}=setup({material:true});
  assert.equal(canRechargeWithItem({...source,id:'other',getFlag:()=>({originUuid:'Item.other'})},target,config),false);
  await assert.rejects(rechargeItem(target,{actor,config,method:'item',source:{...source,id:'wrong',getFlag:()=>({originUuid:'Item.other'})}}),/selected recharge Item/);
});
test('combat counter includes round rollover, rejects rewind and keeps remainder',()=>{
  assert.equal(combatTurnAdvance({round:2,turn:2},{round:3,turn:1},4),3);
  assert.equal(combatTurnAdvance({round:2,turn:3},{round:2,turn:1},4),0);
  assert.deepEqual(applyCombatRecharge({used:3},2,{everyTurns:3,charges:2},1),{usage:{used:1},progress:0,triggers:1});
});
test('combat hooks process turn progression once and do not recharge when turn replays after rewind',async()=>{
  const {actor,target}=setup({combat:{everyTurns:2,charges:1}});
  const combat={id:'encounter',round:1,turn:1,started:true,turns:[{actor},{actor:{id:'npc',items:[]}}],previous:{round:1,turn:0},flags:{buxaframework:{}},
    getFlag(ns,k){return get(this.flags,`${ns}.${k}`);},async setFlag(ns,k,v){set(this.flags,`${ns}.${k}`,v);}};
  registerCombatItemRecharge();
  const tick=async(round,turn)=>{combat.round=round;combat.turn=turn;handlers.updateCombat(combat,{turn,round});await new Promise(r=>setTimeout(r,5));};
  await tick(1,1);assert.equal(target.getFlag('buxaframework','itemUsage').used,3);
  await tick(2,0);assert.equal(target.getFlag('buxaframework','itemUsage').used,2);
  await tick(1,1);await tick(2,0);assert.equal(target.getFlag('buxaframework','itemUsage').used,2,'rewind and replay cannot farm charges');
  await tick(2,1);assert.equal(target.getFlag('buxaframework','itemUsage').used,2);
});
test('item configuration and inventory paths advertise the three recharge methods',()=>{
  const file=name=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
  assert.match(file('scripts/apps/item-use-editor.js'),/WORLD ITEM TO CONSUME/);
  assert.match(file('scripts/apps/item-context-menu.js'),/data-action='recharge'/);
  assert.match(file('scripts/apps/inventory-controls.js'),/inventoryRechargeTarget/);
  assert.match(file('templates/item-sheet.hbs'),/rechargeLabels/);
});
test('material failure before consumption rolls back newly granted uses',async()=>{
  const {actor,target,source}=setup({material:true});
  const initial=target.getFlag('buxaframework','itemUsage').used;
  source.update=async()=>{throw Error('Item not saved');};
  await assert.rejects(rechargeItem(target,{actor,config,method:'item',source}),/Item not saved/);
  assert.equal(target.getFlag('buxaframework','itemUsage').used,initial);
  assert.equal(source.system.quantity,2);
});
test('material post-save hook exception does not undo already consumed material',async()=>{
  const {actor,target,source}=setup({material:true});
  source.update=async changes=>{for(const [p,v] of Object.entries(changes))set(source,p,v);throw Error('hook failed after save');};
  const result=await rechargeItem(target,{actor,config,method:'item',source});
  assert.equal(result.added,2);assert.equal(source.system.quantity,1);
  assert.equal(target.getFlag('buxaframework','itemUsage').used,1);
});
test('rapid combat updates are queued and every advancing turn is counted',async()=>{
  const {actor,target}=setup({combat:{everyTurns:1,charges:1}});
  const original=target.update;
  target.update=async changes=>{await new Promise(r=>setTimeout(r,10));return original.call(target,changes);};
  const combat={id:'fast',round:1,turn:0,started:true,turns:[{actor},{actor:{id:'enemy',items:[]}}],previous:{round:1,turn:0},flags:{buxaframework:{}},
    getFlag(ns,k){return get(this.flags,`${ns}.${k}`);},async setFlag(ns,k,v){set(this.flags,`${ns}.${k}`,v);}};
  combat.turn=1;handlers.updateCombat(combat,{turn:1});
  combat.round=2;combat.turn=0;handlers.updateCombat(combat,{round:2,turn:0});
  await new Promise(r=>setTimeout(r,65));
  assert.equal(target.getFlag('buxaframework','itemUsage').used,1);
});

test('malformed recharge material cannot grant charges or silently consume a unit',async()=>{
  const {actor,target,source}=setup({material:true});
  for (const broken of ['', 'broken', 1.5, -2, true]) {
    source.system.quantity=broken;
    const before=target.getFlag('buxaframework','itemUsage').used;
    assert.equal(canRechargeWithItem(source,target,config),false);
    await assert.rejects(rechargeItem(target,{actor,config,method:'item',source}),/invalid quantity/);
    assert.equal(target.getFlag('buxaframework','itemUsage').used,before);
    assert.equal(actor.items.get(source.id),source);
  }
});
