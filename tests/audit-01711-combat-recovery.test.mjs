import test from 'node:test';
import assert from 'node:assert/strict';
import { createEncounterNpcTokens,createdEncounterTokenMap } from '../scripts/core/combat-npc-staging.js';
import { encounterPlacements } from '../scripts/core/combat-encounter-model.js';

const drafts = ['a','b'].map(id=>({flags:{buxaframework:{encounterEntryId:id}}}));
const tok = (id,entry)=>({id,flags:{buxaframework:{encounterEntryId:entry}}});
const fixture = (create) => {
  const scene={ tokens:{contents:[tok('prior','other')]},
    async createEmbeddedDocuments(_type,payload){return create(scene,payload);},
    async deleteEmbeddedDocuments(_type,ids){scene.tokens.contents=scene.tokens.contents.filter(t=>!ids.includes(t.id));return ids;}
  };
  return scene;
};

test('partial NPC creation followed by thrown hook removes only newly tagged Tokens',async()=>{
  const scene=fixture(async s=>{
    s.tokens.contents.push(tok('created-a','a'));
    throw Error('hook failed after saving partial token');
  });
  await assert.rejects(createEncounterNpcTokens(scene,drafts,{commit:async()=>{throw Error('should not commit');}}), /hook failed/);
  assert.deepEqual(scene.tokens.contents.map(t=>t.id),['prior']);
});

test('post-create hook error with all tokens also removes the untracked tokens',async()=>{
  const scene=fixture(async s=>{
    s.tokens.contents.push(tok('a-1','a'),tok('b-1','b'));
    throw Error('post create');
  });
  await assert.rejects(createEncounterNpcTokens(scene,drafts,{commit:async()=>{}}),/post create/);
  assert.deepEqual(scene.tokens.contents.map(t=>t.id),['prior']);
});

test('post-save roster hook failure keeps committed tokens when fully bound',async()=>{
  const scene=fixture(async s=>{
    const created=[tok('a-1','a'),tok('b-1','b')];
    s.tokens.contents.push(...created);return created;
  });
  let committed=false;
  const result=await createEncounterNpcTokens(scene,drafts,{
    commit:async()=>{committed=true;throw Error('post roster hook');},
    isCommitted:async()=>committed
  });
  assert.deepEqual(result.map(t=>t.id),['a-1','b-1']);
  assert.deepEqual(scene.tokens.contents.map(t=>t.id),['prior','a-1','b-1']);
});

test('failed roster persistence cleans up new NPC Tokens without touching originals',async()=>{
  const scene=fixture(async s=>{const created=[tok('a-1','a'),tok('b-1','b')];s.tokens.contents.push(...created);return created;});
  await assert.rejects(createEncounterNpcTokens(scene,drafts,{commit:async()=>{throw Error('save failed');}}),/save failed/);
  assert.deepEqual(scene.tokens.contents.map(t=>t.id),['prior']);
});

test('crowded combat placement handles more than 200 NPCs without truncation or duplicate cells',()=>{
  const positions=encounterPlacements(215,{x:500,y:500},100);
  assert.equal(positions.length,215);
  assert.equal(new Set(positions.map(p=>`${p.x}/${p.y}`)).size,215);
  assert.throws(()=>encounterPlacements(2001,{x:0,y:0}),/0–2000/);
});


test('partial NPC roster commit recovers stale binding after deleting partial staged Tokens',async()=>{
  const scene=fixture(async s=>{const created=[tok('a-1','a'),tok('b-1','b')];s.tokens.contents.push(...created);return created;});
  const roster=new Map();
  await assert.rejects(createEncounterNpcTokens(scene,drafts,{
    commit:async()=>{roster.set('a','a-1');throw Error('partial roster save');},
    isCommitted:async()=>false,
    clearFailedRoster:async ids=>{for(const [key,id] of roster)if(ids.includes(id))roster.delete(key);}
  }), /partial roster save/);
  assert.equal(roster.size,0);
  assert.deepEqual(scene.tokens.contents.map(t=>t.id),['prior']);
});

test('roster verification exception still runs best-effort NPC cleanup',async()=>{
  const scene=fixture(async s=>{const created=[tok('a-1','a'),tok('b-1','b')];s.tokens.contents.push(...created);return created;});
  await assert.rejects(createEncounterNpcTokens(scene,drafts,{
    commit:async()=>{throw Error('save failed');},
    isCommitted:async()=>{throw Error('read error');}
  }), /save failed/);
  assert.deepEqual(scene.tokens.contents.map(t=>t.id),['prior']);
});


test('NPC create receipt binds by encounter flag even if Foundry returns reversed Tokens',async()=>{
  const scene=fixture(async s=>{
    const created=[tok('a-1','a'),tok('b-1','b')];s.tokens.contents.push(...created);
    return [...created].reverse();
  });
  let mapped;
  await createEncounterNpcTokens(scene,drafts,{commit:async created=>{mapped=createdEncounterTokenMap(created);}});
  assert.equal(mapped.get('a'),'a-1');
  assert.equal(mapped.get('b'),'b-1');
});
