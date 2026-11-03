import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DEFAULT_SHEET_CONFIG, MODULE_ID, HOOKS } from '../scripts/core/constants.js';
import { normalizeEffectRules, normalizeActiveEffect, getItemKind } from '../scripts/core/effect-config.js';
import { getActiveEffects, applyEffectToActor, removeEffectFromActor, tickActorEffects, isEffectExpired } from '../scripts/core/effect-runtime.js';

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url),'utf8');
function harness(behavior = 'timed') {
  globalThis.foundry ??= {utils:{deepClone:structuredClone,randomID:()=>`unique-${Math.random()}`}};
  globalThis.foundry.utils.deepClone ??= structuredClone;
  const emit = [];
  globalThis.Hooks = {callAll:(type,value)=>emit.push({type,value})};
  globalThis.game = {user:{id:'gm',isGM:true},users:{activeGM:{id:'gm',isGM:true,active:true}},
    settings:{get:()=>structuredClone(DEFAULT_SHEET_CONFIG)}};
  const flags={};
  let writes=0;
  const actor = {id:'actor',documentName:'Actor',items:new Map(),getFlag:(_scope,key)=>flags[key],
    setFlag:async (_scope,key,value)=>{writes++;flags[key]=structuredClone(value);return value;},
    update:async()=>{}};
  const rules={behavior,duration:{mode:'turns',value:2},stackBehavior:'refresh',triggers:{onApply:true,onCombatTurnStart:true}};
  const effect={id:'fx',name:'Fire',img:'icons/svg/aura.svg',getFlag:(_scope,key)=>key==='itemKind'?'effect':key==='effect'?rules:undefined};
  actor.items.set('fx',effect);game.items=new Map([['fx',effect]]);
  return {actor,effect,rules,flags,emit,writes:()=>writes};
}

test('Effects are flagged Foundry Items, not additional document types',()=>{
  assert.equal(getItemKind({flags:{[MODULE_ID]:{itemKind:'magic'}}}),'magic');
  assert.equal(getItemKind({flags:{[MODULE_ID]:{itemKind:'unknown'}}}),'item');
  assert.deepEqual(Object.keys(HOOKS).filter(key=>key.startsWith('EFFECT_')).sort(),['EFFECT_APPLIED','EFFECT_REMOVED','EFFECT_TICK']);
});
test('Effect schema validates values and reuses Item normalizers',()=>{
  const normalized=normalizeEffectRules({rarityId:'missing',behavior:'oops',stackBehavior:'oops',
    triggers:{onCombatTurnStart:true},tickLabel:'A'.repeat(90),duration:{value:-3},
    resourceEffects:[{action:'fill',amountType:'percent',amount:20}],
    dice:[{count:2,faces:6}],increases:[{target:'stat:initiative:value',value:2}]});
  assert.equal(normalized.rarityId,'common');assert.equal(normalized.behavior,'timed');
  assert.equal(normalized.duration.value,1);assert.equal(normalized.stackBehavior,'refresh');
  assert.equal(normalized.tickLabel.length,80);assert.equal(normalized.resourceEffects[0].amount,20);
  assert.equal(normalized.dice[0].faces,6);assert.equal(normalized.increases[0].value,2);
  assert.equal(normalizeActiveEffect({stackCount:-9,progress:-1}).stackCount,1);
});
test('GM-only operations use one active-effects flag write and stack, replace, refresh correctly',async()=>{
  const h=harness();
  let active=await applyEffectToActor(h.actor,h.effect);
  assert.equal(h.writes(),1);assert.equal(getActiveEffects(h.actor).length,1);
  assert.ok(h.emit.some(e=>e.type===HOOKS.EFFECT_APPLIED));
  h.rules.stackBehavior='stack';
  active=await applyEffectToActor(h.actor,h.effect);
  assert.equal(active.stackCount,2);assert.equal(getActiveEffects(h.actor).length,1);
  h.rules.stackBehavior='refresh';
  const before=active.instanceId;
  active=await applyEffectToActor(h.actor,h.effect);
  assert.equal(active.stackCount,2);assert.equal(active.instanceId,before);
  h.rules.stackBehavior='replace';
  active=await applyEffectToActor(h.actor,h.effect);
  assert.equal(active.stackCount,1);assert.notEqual(active.instanceId,before);
  assert.equal(await removeEffectFromActor(h.actor,active.instanceId),true);
  assert.equal(getActiveEffects(h.actor).length,0);
  const count=h.writes();game.user.isGM=false;
  assert.equal(await applyEffectToActor(h.actor,h.effect),null);
  assert.equal(await removeEffectFromActor(h.actor,'missing'),false);
  assert.deepEqual(await tickActorEffects(h.actor,{id:'one',round:1,turn:0,turns:[{}]}),[]);
  assert.equal(h.writes(),count);
});
test('combat turn ticks are deduplicated and expire timed effects',async()=>{
  const h=harness();const combat={id:'one',started:true,round:1,turn:0,turns:[{id:'a'},{id:'b'}]};
  await applyEffectToActor(h.actor,h.effect,{combat});
  const before=h.writes();
  await tickActorEffects(h.actor,combat,'onCombatTurnStart');
  assert.equal(getActiveEffects(h.actor)[0].progress,1);
  await tickActorEffects(h.actor,combat,'onCombatTurnStart');
  assert.equal(getActiveEffects(h.actor)[0].progress,1);
  combat.turn=1;
  await tickActorEffects(h.actor,combat,'onCombatTurnStart');
  assert.equal(getActiveEffects(h.actor).length,0);
  assert.ok(h.emit.some(e=>e.type===HOOKS.EFFECT_REMOVED));
  assert.equal(h.writes(),before+3);
});
test('effect config and HUD expose dedicated views with proper cleanup',()=>{
  assert.match(read('templates/effect-config.hbs'),/data-bfx-trigger="onCombatTurnEnd"/);
  assert.match(read('templates/effect-config.hbs'),/data-item-increase-row/);
  assert.match(read('templates/effect-config.hbs'),/data-item-dice-row/);
  assert.match(read('templates/effect-sheet.hbs'),/bfx-effect-summary/);
  assert.match(read('scripts/apps/effect-hud.js'),/WeakMap/);
  assert.match(read('scripts/apps/effect-hud.js'),/MutationObserver/);
  assert.match(read('scripts/apps/effect-hud.js'),/\.disconnect\(\)/);
  assert.match(read('scripts/apps/effect-hud.js'),/applyRarityVisual\(card,rarity\)/);
  assert.match(read('styles/183-effects.css'),/pointer-events:none/);
});

test('replacing an instance emits a removal, while a changed effect retains another instance tick ledger',async()=>{
  const h=harness();const combat={id:'x',started:true,round:4,turn:1,turns:[{},{},{}]};
  await applyEffectToActor(h.actor,h.effect,{combat});
  await tickActorEffects(h.actor,combat,'onCombatTurnStart');
  assert.equal(getActiveEffects(h.actor)[0].progress,1);
  const other={id:'other',getFlag:(_scope,key)=>key==='itemKind'?'effect':key==='effect'?{behavior:'passive'}:undefined};
  await applyEffectToActor(h.actor,other,{combat});
  await tickActorEffects(h.actor,combat,'onCombatTurnStart');
  assert.equal(getActiveEffects(h.actor).find(e=>e.effectItemId==='fx').progress,1);
  h.rules.stackBehavior='replace';
  await applyEffectToActor(h.actor,h.effect,{combat});
  assert.ok(h.emit.some(e=>e.type===HOOKS.EFFECT_REMOVED && e.value.reason==='replaced'));
});
test('serialized boolean strings do not accidentally enable effect triggers',()=>{
  const rules=normalizeEffectRules({description:{enabled:'false'},triggers:{onApply:'false',onRemove:'0',onCombatTurnEnd:'true'}});
  assert.equal(rules.description.enabled,false);
  assert.equal(rules.triggers.onApply,false);
  assert.equal(rules.triggers.onRemove,false);
  assert.equal(rules.triggers.onCombatTurnEnd,true);
});
