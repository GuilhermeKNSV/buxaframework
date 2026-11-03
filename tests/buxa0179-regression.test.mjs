import test from 'node:test';
import assert from 'node:assert/strict';
import {bindRosterTokens, initiativeAfterMove, initiativeReorderUpdates} from '../scripts/core/combat-encounter-model.js';
import {archiveEncounterDeaths, isEncounterDeathAuthority, isCombatantDefeated, validCombatHp} from '../scripts/core/combat-encounter-death.js';
import {withInventoryMutation} from '../scripts/core/inventory.js';
import {beginActorResourceUse, withActorStackMutation} from '../scripts/core/actor-transactions.js';

const npc=(id,tokenId='')=>({id,actorId:'goblin',npc:true,tokenId});
const token=(id,tag=null)=>({id,actorId:'goblin',actorLink:false,flags:{buxaframework:{encounterEntryId:tag}}});

test('tagged tokens remain unique, independent of roster order',()=>{
  const tokens=[token('t1','g1'),token('t2','g2'),token('other')];
  const rows=[npc('g2'),npc('g1'),npc('g3')];
  assert.deepEqual(bindRosterTokens(rows,tokens).map(r=>r.tokenId),['t2','t1','']);
  assert.deepEqual(bindRosterTokens(rows.reverse(),tokens).map(r=>r.tokenId),['','t1','t2']);
  assert.deepEqual(bindRosterTokens([npc('g1','t2'),npc('g2')],tokens).map(r=>r.tokenId),['t1','t2']);
});

test('unlinked existing NPC tokens are not silently adopted or shared',()=>{
  const roster=[npc('g1'),npc('g2')];
  assert.deepEqual(bindRosterTokens(roster,[token('world-unrelated')]).map(r=>r.tokenId),['','']);
});

test('unknown and empty HP cannot be classified as death',()=>{
  for (const value of [undefined,null,'', '  ',NaN,true,false]) assert.equal(validCombatHp(value),null);
  assert.equal(isCombatantDefeated(null,undefined),false);
  assert.equal(isCombatantDefeated(1,'0'),true);
  assert.equal(isCombatantDefeated(-1,null),true);
  assert.equal(isCombatantDefeated('2',null),false);
});

test('one selected GM is death-archive authority',()=>{
  const users=[{id:'gm2',isGM:true,active:true},{id:'gm1',isGM:true,active:true}];
  assert.equal(isEncounterDeathAuthority({contents:users},users[0]),false);
  assert.equal(isEncounterDeathAuthority({contents:users},users[1]),true);
  assert.equal(isEncounterDeathAuthority({contents:users,activeGM:users[0]},users[0]),true);
  assert.equal(isEncounterDeathAuthority({contents:users,activeGM:users[0]},users[1]),false);
});

test('death archive is persisted before deletion and retries only remaining Combatants',async()=>{
  const prior=globalThis.game;
  globalThis.game={user:{id:'gm',isGM:true},users:{activeGM:{id:'gm',isGM:true,active:true}}};
  let saved=[],calls=0, fail=true;
  const deadActor={id:'orc',name:'Orc',img:'orc.webp',system:{attributes:{hp:{value:0,max:25}}}};
  const entry={id:'turn1',actorId:'orc',tokenId:'tok1',actor:deadActor};
  const combat={combatants:[entry],getFlag:()=>saved,
    async setFlag(_ns,_name,rows){saved=structuredClone(rows)},
    async deleteEmbeddedDocuments(_type,ids){calls++;if(fail)throw Error('network');this.combatants=this.combatants.filter(c=>!ids.includes(c.id));}};
  try {
    await assert.rejects(archiveEncounterDeaths(combat,[entry]),/network/);
    assert.equal(saved.length,1);
    assert.equal(combat.combatants.length,1);
    fail=false;
    assert.deepEqual(await archiveEncounterDeaths(combat,[entry]),['turn1']);
    assert.equal(saved.length,1);
    assert.equal(combat.combatants.length,0);
    assert.deepEqual(await archiveEncounterDeaths(combat,[entry]),[]);
    assert.equal(calls,2);
  } finally { globalThis.game=prior; }
});

test('initiative tie triggers stable full-order repair',()=>{
  const turns=[{id:'a',initiative:20},{id:'b',initiative:20},{id:'c',initiative:10}];
  assert.equal(initiativeAfterMove(turns,'c','b'),null);
  const updates=initiativeReorderUpdates(turns,'c','b');
  assert.deepEqual(updates.map(e=>e._id),['a','c','b']);
  assert.ok(updates[0].initiative>updates[1].initiative);
  assert.ok(updates[1].initiative>updates[2].initiative);
});

test('inventory writes serialize same Actor but not other Actors', async()=>{
  let resolveFirst;
  const a={uuid:'Actor.a'},b={uuid:'Actor.b'},seen=[];
  const first=withInventoryMutation(a, async()=>{seen.push('a1-start');await new Promise(r=>resolveFirst=r);seen.push('a1-end');});
  const second=withInventoryMutation(a,()=>seen.push('a2'));
  const third=withInventoryMutation(b,()=>seen.push('b1'));
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(seen,['a1-start','b1']);
  resolveFirst();await Promise.all([first,second,third]);
  assert.deepEqual(seen,['a1-start','b1','a1-end','a2']);
});

test('item use and recharge reject overlapping Actor resource payments, releases are idempotent',()=>{
  const actor={uuid:'Actor.hp'};
  const release=beginActorResourceUse(actor);
  assert.throws(()=>beginActorResourceUse({uuid:'Actor.hp'}),/Another Item action/);
  release();release();
  beginActorResourceUse(actor)();
});

test('stack split/merge queue preserves order after a rejected operation',async()=>{
  const actor={uuid:'Actor.stack'};let resume;const steps=[];
  const one=withActorStackMutation(actor,async()=>{steps.push('one');await new Promise(r=>resume=r);throw Error('failed');});
  const two=withActorStackMutation(actor,async()=>{steps.push('two');return 2;});
  await new Promise(resolve=>setImmediate(resolve));resume();
  await assert.rejects(one,/failed/);
  assert.equal(await two,2);
  assert.deepEqual(steps,['one','two']);
});
