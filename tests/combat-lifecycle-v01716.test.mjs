import test from 'node:test';
import assert from 'node:assert/strict';
import { captureCombatLifecycle, diffCombatLifecycle } from '../scripts/core/combat-lifecycle-model.js';
import {
  COMBAT_LIFECYCLE_HOOK, COMBAT_LIFECYCLE_HISTORY_LIMIT,
  installCombatLifecycleTracking, getCombatLifecycleSnapshot,
  getCombatLifecycleHistory, onCombatLifecycle
} from '../scripts/integrations/combat-lifecycle.js';

let nextId = 0;
const uid = () => `lifecycle-${++nextId}`;
const wait = () => new Promise(resolve => setTimeout(resolve,0));
const combatant = (id,initiative=10) => ({id,actorId:`actor-${id}`,tokenId:`token-${id}`,name:`Hero ${id}`,initiative,defeated:false,hidden:false});
function mockCombat({id=uid(),started=false,round=0,turn=null,active=false,
  participants=[combatant('one'),combatant('two')],order,flags={}}={}) {
  const combat = {id,scene:'scene-1',started,round,turn,active,
    combatants:participants,turns:order || [...participants],flags,
    getFlag(module,key) { return this.flags?.[`${module}.${key}`]; },
    writes:[],async setFlag(module,key,data) {
      this.writes.push({module,key,data:structuredClone(data)});
      this.flags[`${module}.${key}`] = structuredClone(data);
      emit('updateCombat',this,{[`flags.${module}.${key}`]:data});
      return this;
    }
  };
  Object.defineProperty(combat,'combatant',{get(){return this.started && this.turn!=null ? this.turns[this.turn] || null : null;}});
  return combat;
}
const hooks = new Map();
function emit(name,...args) { for(const fn of hooks.get(name) || []) fn(...args); }
globalThis.Hooks = {on(name,fn){const all=hooks.get(name)||[];all.push(fn);hooks.set(name,all);},callAll(name,...args){emit(name,...args);}};
globalThis.game = {user:{id:'gm',isGM:true},users:{activeGM:{id:'gm',isGM:true,active:true}},combats:[],combat:null};
installCombatLifecycleTracking();
function register(combat) {game.combats.push(combat);emit('createCombat',combat);return combat;}
function read(combat){return getCombatLifecycleHistory(combat.id);}
function baseline(combat) {game.combats.push(combat);getCombatLifecycleSnapshot(combat.id);return combat;}

// Pure snapshots and transitions are deterministic and exercise both Foundry
// collection shapes and Buxa-specific preparation/death rosters.
test('snapshot captures round, active combatant, initiative, rosters and scene identity',()=>{
  const c=mockCombat({started:true,round:3,turn:1,flags:{
    'buxaframework.encounterRoster':[{id:'roster-1',actorId:'a',npc:true}],
    'buxaframework.encounterDead':[{id:'dead-1',actorId:'b'}]
  }});
  const state=captureCombatLifecycle(c);
  assert.equal(state.combatId,c.id);
  assert.equal(state.currentCombatantId,'two');
  assert.equal(state.round,3);
  assert.equal(state.turn,1);
  assert.equal(state.combatants[0].initiative,10);
  assert.equal(state.roster[0].id,'roster-1');
  assert.equal(state.dead[0].id,'dead-1');
  c.combatants={contents:c.combatants};
  assert.equal(captureCombatLifecycle(c).combatants.length,2);
});

test('start emits exact lifecycle boundaries; baseline discovery never fabricates a start',()=>{
  const c=mockCombat(); const seen=[];
  const off=onCombatLifecycle('*',event=>seen.push(event));
  register(c);
  assert.deepEqual(seen.map(e=>e.type),['combat:created']);
  c.started=true;c.round=1;c.turn=0;
  emit('updateCombat',c,{started:true,round:1,turn:0});
  assert.deepEqual(seen.slice(1).map(e=>e.type),['combat:started','round:started','turn:started']);
  assert.equal(seen.at(-1).combatantId,'one');
  assert.equal(seen[1].combatId,c.id);
  assert.equal(getCombatLifecycleSnapshot(c.id).round,1);
  assert.equal(read(c).filter(e=>e.type==='combat:started').length,1);
  off();
});

test('turn advance emits end then begin, round crossing closes round before opening next',()=>{
  const c=register(mockCombat()); c.started=true;c.round=1;c.turn=0;emit('updateCombat',c,{started:true});
  c.turn=1;emit('updateCombat',c,{turn:1});
  assert.deepEqual(read(c).slice(-2).map(e=>e.type),['turn:ended','turn:started']);
  assert.equal(read(c).at(-2).combatantId,'one');
  assert.equal(read(c).at(-2).turn,0);
  assert.equal(read(c).at(-1).combatantId,'two');
  assert.equal(read(c).at(-1).turn,1);
  c.round=2;c.turn=0;emit('updateCombat',c,{round:2,turn:0});
  assert.deepEqual(read(c).slice(-4).map(e=>e.type),['turn:ended','round:ended','round:started','turn:started']);
  assert.equal(read(c).at(-2).roundsElapsed,1);
  assert.equal(read(c).at(-3).round,1);
  assert.equal(read(c).at(-4).combatantId,'two');
});

test('skipped rounds and explicit rewinds retain direction and elapsed counts',()=>{
  const c=baseline(mockCombat({started:true,round:1,turn:1}));
  c.round=5;c.turn=0;emit('updateCombat',c,{round:5,turn:0});
  assert.equal(read(c).findLast(e=>e.type==='round:started').skippedRounds,3);
  c.round=2;c.turn=1;emit('updateCombat',c,{round:2,turn:1});
  assert.equal(read(c).findLast(e=>e.type==='round:started').reason,'rewind');
});

test('initiative reorder does not synthesize a new turn or round',()=>{
  const c=baseline(mockCombat({started:true,round:2,turn:0}));
  c.turns=[...c.turns].reverse();emit('updateCombatant',{parent:c});
  const types=read(c).map(e=>e.type);
  assert.ok(types.includes('initiative:order-changed'));
  assert.ok(types.includes('turn:reassigned'));
  assert.ok(!types.includes('turn:started'));
  emit('updateCombat',c,{flags:{arbitrary:true}});
  assert.equal(read(c).filter(e=>e.type==='turn:reassigned').length,1);
});

test('combatant removal and replacement at same index do not look like passing turns',()=>{
  const c=baseline(mockCombat({started:true,round:2,turn:0}));
  c.combatants.shift();c.turns.shift();emit('deleteCombatant',{parent:c});
  const history=read(c);
  assert.equal(history.filter(e=>e.type==='combatant:left').length,1);
  assert.equal(history.filter(e=>e.type==='turn:reassigned').length,1);
  assert.equal(history.filter(e=>e.type==='turn:started').length,0);
});

test('initiative resort that changes the numeric index but keeps the same actor is not a turn',()=>{
  const c=baseline(mockCombat({started:true,round:4,turn:0}));
  c.turns=[c.turns[1],c.turns[0]];
  c.turn=1;
  emit('updateCombatant',{parent:c});
  assert.ok(read(c).some(e=>e.type==='turn:reindexed'));
  assert.ok(!read(c).some(e=>e.type==='turn:started' || e.type==='turn:ended'));
});

test('participant identity, initiative, death archive and prep roster updates are all observed',()=>{
  const c=register(mockCombat());
  c.combatants[0].initiative=30;emit('updateCombatant',{parent:c});
  c.flags['buxaframework.encounterRoster']=[{id:'prep',actorId:'a',npc:true}];
  emit('updateCombat',c,{flags:{buxaframework:{encounterRoster:[]}}});
  c.flags['buxaframework.encounterDead']=[{id:'dead',actorId:'a'}];
  emit('updateCombat',c,{flags:{buxaframework:{encounterDead:[]}}});
  c.flags['buxaframework.encounterDead']=[];
  emit('updateCombat',c,{flags:{buxaframework:{encounterDead:[]}}});
  assert.deepEqual(read(c).filter(e=>e.type==='combatant:updated')[0].fields,['initiative']);
  assert.ok(read(c).some(e=>e.type==='roster:changed'));
  assert.equal(read(c).filter(e=>e.type==='combatant:archived').length,1);
  assert.equal(read(c).filter(e=>e.type==='combatant:unarchived').length,1);
});

test('stopping and deleting do not emit the final turn twice',()=>{
  const c=baseline(mockCombat({started:true,round:1,turn:0}));
  c.started=false;c.round=0;c.turn=null;
  emit('updateCombat',c,{started:false,round:0,turn:null});
  emit('deleteCombat',c);
  assert.equal(read(c).filter(e=>e.type==='turn:ended').length,1);
  assert.equal(read(c).filter(e=>e.type==='round:ended').length,1);
  assert.equal(read(c).filter(e=>e.type==='combat:ended').length,1);
  assert.equal(read(c).filter(e=>e.type==='combat:deleted').length,1);
  assert.equal(getCombatLifecycleSnapshot(c.id),null);
});

test('deleting still-running combat records all ending boundaries',()=>{
  const c=baseline(mockCombat({started:true,round:3,turn:0}));
  emit('deleteCombat',c);
  assert.deepEqual(read(c).slice(-4).map(e=>e.type),['turn:ended','round:ended','combat:ended','combat:deleted']);
});

test('unrelated flag update, duplicate document events and microtasks cannot duplicate boundaries',async()=>{
  const c=baseline(mockCombat({started:true,round:1,turn:0}));
  c.turn=1;emit('updateCombat',c,{turn:1});
  emit('updateCombat',c,{turn:1});
  emit('updateCombatant',{parent:c});
  await wait();
  assert.equal(read(c).filter(e=>e.type==='turn:started').length,1);
  assert.equal(read(c).filter(e=>e.type==='turn:ended').length,1);
});

test('readers get independent copies and subscriber errors cannot stop the stream',()=>{
  const c=register(mockCombat());const seen=[];
  const offError=onCombatLifecycle('combat:started',()=>{throw Error('subscriber test');});
  const off=onCombatLifecycle('combat:started',e=>seen.push(e));
  const oldConsole=console.error;console.error=()=>{};
  try {c.started=true;c.round=1;c.turn=0;emit('updateCombat',c,{started:true,round:1,turn:0});}
  finally {console.error=oldConsole;off();offError();}
  assert.equal(seen.length,1);
  seen[0].round=900;
  const returned=read(c);returned.at(-1).round=800;
  assert.equal(read(c).at(-1).round,1);
  const snapshot=getCombatLifecycleSnapshot(c.id);snapshot.combatants.length=0;
  assert.equal(getCombatLifecycleSnapshot(c.id).combatants.length,2);
});

test('history is bounded and sequence numbers remain monotonic when evicting old events',()=>{
  const c=baseline(mockCombat({started:true,round:1,turn:0}));
  for(let round=2;round<=110;round++) {c.round=round;c.turn=(round%2);emit('updateCombat',c,{round,turn:c.turn});}
  assert.equal(read(c).length,COMBAT_LIFECYCLE_HISTORY_LIMIT);
  const a=read(c);
  assert.ok(a[0].sequence>1);
  assert.ok(a.at(-1).sequence>a[0].sequence);
  assert.equal(getCombatLifecycleHistory(c.id,{type:'round:started',limit:3}).length,3);
  assert.deepEqual(getCombatLifecycleHistory(c.id,{limit:0}),[]);
});

test('nonprimary clients observe without writing flags',()=>{
  const c=register(mockCombat()); const before=c.writes.length;
  game.user={id:'client',isGM:false};
  c.started=true;c.round=1;c.turn=0;emit('updateCombat',c,{started:true});
  assert.equal(read(c).filter(e=>e.type==='combat:started').length,1);
  assert.equal(c.writes.length,before);
  game.user={id:'gm',isGM:true};
});

test('GM serializes flag persistence; flag-only update never creates recursive events',async()=>{
  const c=register(mockCombat());
  c.started=true;c.round=1;c.turn=0;emit('updateCombat',c,{started:true});
  c.turn=1;emit('updateCombat',c,{turn:1});
  await wait();await wait();
  const flag=c.getFlag('buxaframework','lifecycleHistory');
  assert.equal(flag.version,1);
  assert.equal(flag.sequence,read(c).at(-1).sequence);
  assert.deepEqual(flag.events.map(e=>e.sequence),read(c).map(e=>e.sequence));
  const count=read(c).length;
  emit('updateCombat',c,{'flags.buxaframework.lifecycleHistory':flag});
  assert.equal(read(c).length,count);
});

test('stored prior history seeds sequence without emitting fake transitions',()=>{
  const c=mockCombat({started:true,round:10,turn:1,flags:{
    'buxaframework.lifecycleHistory':{version:1,sequence:43,events:[{type:'combat:started',combatId:'bogus',sequence:12}]}
  }});
  // A first-seen document is a baseline, even if there is no create hook.
  game.combats.push(c);
  emit('updateCombat',c,{flags:{some:true}});
  assert.equal(read(c).length,0);
  c.round=11;c.turn=0;emit('updateCombat',c,{round:11,turn:0});
  assert.equal(read(c)[0].sequence,44);
});

test('core model can report the full diff without the integration',()=>{
  const c=mockCombat({started:true,round:1,turn:0});
  const from=captureCombatLifecycle(c);
  c.active=true;c.turn=1;
  const to=captureCombatLifecycle(c);
  assert.deepEqual(diffCombatLifecycle(from,to,{clockUpdated:true}).map(e=>e.type),
    ['combat:activated','turn:ended','turn:started']);
  assert.equal(COMBAT_LIFECYCLE_HOOK,'buxaCombatLifecycle');
});

test('reentrant subscribers cannot interleave round and turn boundary notifications',()=>{
  const c=baseline(mockCombat({started:true,round:1,turn:0}));
  const seen=[];
  const off=onCombatLifecycle('*', event=>{
    if (event.combatId!==c.id) return;
    seen.push(`${event.type}:${event.turn}`);
    if (event.type==='round:started' && event.round===2) {
      c.turn=1;
      emit('updateCombat',c,{turn:1});
    }
  });
  c.round=2;emit('updateCombat',c,{round:2});
  off();
  assert.deepEqual(seen,[
    'turn:ended:0','round:ended:0','round:started:0','turn:started:0',
    'turn:ended:0','turn:started:1'
  ]);
  assert.deepEqual(read(c).map(e=>e.type),[
    'turn:ended','round:ended','round:started','turn:started','turn:ended','turn:started'
  ]);
});

test('public Foundry hook publishes cloned events without any visible UI integration',()=>{
  const c=register(mockCombat());
  const logged=[];
  Hooks.on(COMBAT_LIFECYCLE_HOOK, event=>{if(event.combatId===c.id){logged.push(event);event.round=987;}});
  c.started=true;c.round=1;c.turn=0;emit('updateCombat',c,{started:true});
  assert.equal(logged.length,3);
  assert.equal(read(c).at(-1).round,1);
});

test('install is idempotent and late redundant hooks do not resurrect deleted state',()=>{
  const original=hooks.get('updateCombat').length;
  installCombatLifecycleTracking();
  assert.equal(hooks.get('updateCombat').length,original);
  const c=baseline(mockCombat({started:true,round:3,turn:0}));
  emit('deleteCombat',c);
  const length=read(c).length;
  c.turn=1;emit('updateCombat',c,{turn:1});
  assert.equal(read(c).length,length);
});

test('active and scene changes do not generate turn advances',()=>{
  const c=baseline(mockCombat({started:true,round:2,turn:0}));
  c.active=true;c.scene='another-scene';
  emit('updateCombat',c,{active:true,scene:'another-scene'});
  assert.deepEqual(read(c).map(e=>e.type),['combat:scene-changed','combat:activated']);
});
