import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addEncounterActor,
  normalizeEncounterRoster,
  bindRosterTokens,
  unplacedNPCs,
  encounterPlacements,
  initiativeAfterMove,
  normalizeEncounterDead,
  mergeEncounterDead
} from '../scripts/core/combat-encounter-model.js';

const goblin={id:'goblin',type:'npc'};
const player={id:'hero',type:'character'};

test('independent NPC copies stay separate, players remain a single global actor',()=>{
  let roster=[];
  roster=addEncounterActor(roster,goblin,'g1'); roster=addEncounterActor(roster,goblin,'g2');
  roster=addEncounterActor(roster,player,'p1'); roster=addEncounterActor(roster,player,'p2');
  assert.equal(roster.length,3);
  assert.deepEqual(roster.map(x=>x.id),['g1','g2','p1']);
});

test('actor roster normalizes stale and malformed entries',()=>{
  assert.equal(normalizeEncounterRoster({}).length,0);
  assert.equal(normalizeEncounterRoster([{id:'1',actorId:'2',npc:true},{id:'1',actorId:'3',npc:true},{id:'3'},{id:'4',actorId:'2',npc:true}]).length,2);
});

test('dead roster normalizes and merges without duplicates',()=>{
  const normalized=normalizeEncounterDead([{id:'dead-1',name:'Goblin',summary:'HP 0/7',at:5},{id:'dead-1',name:'Other'},{id:'dead-2',name:'Orc',at:10}]);
  assert.equal(normalized.length,2);
  assert.equal(normalized[0].name,'Goblin');
  const merged=mergeEncounterDead(normalized,[{id:'dead-2',name:'Orc',summary:'HP 0/12',at:10},{id:'dead-3',name:'Troll',at:20}]);
  assert.deepEqual(merged.map(entry=>entry.id),['dead-1','dead-2','dead-3']);
  assert.equal(merged[1].summary,'HP 0/12');
});

test('NPC placement excludes linked world tokens, preserves assigned copy',()=>{
  const roster=[{id:'g1',actorId:'goblin',npc:true,tokenId:''},{id:'g2',actorId:'goblin',npc:true,tokenId:''}];
  const tokens=[{id:'global',actorId:'goblin',actorLink:true,hidden:false},{id:'separate',actorId:'goblin',actorLink:false,hidden:false}];
  const output=bindRosterTokens(roster,tokens);
  assert.deepEqual(output.map(x=>x.tokenId),['','']);
  assert.equal(unplacedNPCs(roster,tokens).length,2);
  const tagged=[{id:'tagged',actorId:'goblin',npc:true,tokenId:''}];
  assert.equal(bindRosterTokens(tagged,[{id:'preexisting',actorId:'goblin',actorLink:false,hidden:true,flags:{buxaframework:{encounterEntryId:'tagged'}}}])[0].tokenId,'preexisting');
  const placed=[{...roster[0],tokenId:'hidden'}];
  assert.equal(bindRosterTokens(placed,[{id:'hidden',actorId:'goblin',actorLink:false,hidden:true}])[0].tokenId,'hidden');
});

test('placement spreads actors across unique grid cells away from occupied cells',()=>{
  for(const count of [1,3,10,28]) {
    const result=encounterPlacements(count,{x:300,y:300},100,[{x:300,y:300},{x:400,y:300}]);
    assert.equal(result.length,count);
    assert.equal(new Set(result.map(p=>`${p.x}/${p.y}`)).size,count);
    assert.ok(result.every(p=>p.x>=0&&p.y>=0));
    assert.ok(result.every(p=>p.x!==300||p.y!==300));
  }
});

test('large NPC tokens do not overlap existing scene tokens or each other',()=>{
  const occupied=[{x:100,y:100,width:2,height:2}];
  const placed=encounterPlacements(3,{x:100,y:100},100,occupied,{footprints:[{width:2,height:2},{width:3,height:1},{width:1,height:2}]});
  assert.equal(placed.length,3);
  const cells=new Set(); for(const p of occupied) for(let x=0;x<p.width;x++)for(let y=0;y<p.height;y++)cells.add(`${p.x/100+x}/${p.y/100+y}`);
  for(let i=0;i<placed.length;i++){const size=[{width:2,height:2},{width:3,height:1},{width:1,height:2}][i]; for(let x=0;x<size.width;x++)for(let y=0;y<size.height;y++){const key=`${placed[i].x/100+x}/${placed[i].y/100+y}`;assert.equal(cells.has(key),false,key);cells.add(key);}}
});

test('initiative reorder places dragged combatant above target',()=>{
  const turns=[{id:'a',initiative:20},{id:'b',initiative:16},{id:'c',initiative:10}];
  assert.equal(initiativeAfterMove(turns,'c','b'),18);
  assert.equal(initiativeAfterMove(turns,'a','c'),13);
  assert.equal(initiativeAfterMove(turns,'a','a'),null);
  assert.equal(initiativeAfterMove(turns,'a','missing'),null);
});

test('combat UI has inline actor expansion, double-click sheet action, and dead drawer management',async()=>{
  const fs=await import('node:fs');
  const source=fs.readFileSync(new URL('../scripts/apps/combat-encounters.js',import.meta.url),'utf8');
  for(const key of [
    'renderCombatTracker',
    'Combat.create',
    'createEmbeddedDocuments(\'Combatant\'',
    'archiveEncounterDeaths',
    'rollInitiative(ids)',
    'actor.getTokenDocument',
    'hidden:true',
    'actorLink:false',
    'buxa-enc-place-ghost',
    'buildHotbarAttributeTray',
    'activateHotbarItem',
    'encounterRoster',
    'encounterDead',
    "dblclick",
    'buxa-enc-inline-detail',
    'toggle-dead',
    'delete-combat',
    'buxa-enc-tab-delete'
  ]) assert.ok(source.includes(key),key);
});
