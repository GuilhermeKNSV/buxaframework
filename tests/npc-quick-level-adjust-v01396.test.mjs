import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_SHEET_CONFIG } from '../scripts/core/constants.js';
import { npcRewardDelta, npcApplyReward } from '../scripts/core/npc-level-rewards.js';
import { setNpcProgressionNumber } from '../scripts/core/npc-sheet.js';
import { getAttributePoints } from '../scripts/core/attributes.js';
import { getProficiencyPoints } from '../scripts/core/proficiencies.js';
import { getActorLevel } from '../scripts/core/leveling.js';
import { invalidateSheetConfigCache } from '../scripts/core/config.js';

const cfg = structuredClone(DEFAULT_SHEET_CONFIG);
cfg.level.startingLevel = 1;
cfg.attributes.points.enabled = true;
cfg.attributes.points.grantAmount = 3;
cfg.attributes.points.grantEveryLevels = 2;
cfg.proficiencies.enabled = true;
cfg.proficiencies.points.enabled = true;
cfg.proficiencies.points.grantAmount = 2;
cfg.proficiencies.points.grantEveryLevels = 3;
globalThis.game = {user:{isGM:true,id:'gm'}, settings:{get:()=>cfg}};
globalThis.foundry={utils:{deepClone:structuredClone,randomID:()=> 'abc',escapeHTML:String}};
const valueAt=(obj,path)=>String(path).split('.').reduce((v,key)=>v?.[key],obj);
function actor({ level=1, attributePoints=5, proficiencyPoints=4 }={}) {
  const data = { flags: { buxaframework: {level,attributePoints,proficiencyPoints} } };
  let calls = 0;
  return {
    id:'npc-actor', type:'npc', isOwner:true,
    getFlag:(module,path)=>module==='buxaframework'?valueAt(data.flags.buxaframework,path):undefined,
    async update(changes, options) {
      calls++;
      this.lastUpdate={changes, options};
      for(const [path,value] of Object.entries(changes)) {
        const keys=path.split('.'); let object=data;
        for(const k of keys.slice(0,-1)) object=object[k]??={};
        object[keys.at(-1)]=value;
      }
    },
    get calls(){return calls;}
  };
}

test('NPC level edits award configured attribute/proficiency milestones in ONE atomic actor update', async()=>{
  const a=actor();
  assert.equal(await setNpcProgressionNumber(a,'level',7),true);
  assert.equal(getActorLevel(a,cfg),7);
  assert.equal(getAttributePoints(a,cfg),14,'levels 2,4,6 each grant 3 attributes');
  assert.equal(getProficiencyPoints(a,cfg),8,'levels 3,6 each grant 2 proficiencies');
  assert.equal(a.calls,1);
  assert.equal(a.lastUpdate.options['buxaframework.npcDirectEdit'],true);
  assert.equal(a.lastUpdate.changes['flags.buxaframework.level'],7);
  assert.equal(await setNpcProgressionNumber(a,'level',2),true);
  assert.equal(getAttributePoints(a,cfg),8);
  assert.equal(getProficiencyPoints(a,cfg),4);
  assert.equal(a.calls,2);
});

test('a no-op level entry never writes or grants points',async()=>{
  const a=actor({level:6});
  assert.equal(await setNpcProgressionNumber(a,'level',6),true);
  assert.equal(a.calls,0);
  assert.equal(getAttributePoints(a,cfg),5);
});

test('lowering after spending accumulates debt without changing invested values or allowing point farming', async()=>{
  const a=actor({level:1,attributePoints:0,proficiencyPoints:0});
  const oldAttrRule={...cfg.attributes.points}, oldProfRule={...cfg.proficiencies.points};
  try {
    cfg.attributes.points.grantAmount=1; cfg.attributes.points.grantEveryLevels=1;
    cfg.proficiencies.points.grantAmount=1; cfg.proficiencies.points.grantEveryLevels=1;
    invalidateSheetConfigCache();
    await setNpcProgressionNumber(a,'level',5);
    assert.equal(getAttributePoints(a,cfg),4);
    assert.equal(getProficiencyPoints(a,cfg),4);
    // Simulate legitimately spending all newly awarded points on attributes.
    await a.update({'flags.buxaframework.attributePoints':0,'flags.buxaframework.proficiencyPoints':0});
    await setNpcProgressionNumber(a,'level',1);
    assert.equal(a.getFlag('buxaframework','npc.levelPointDebt.attributePoints'),4);
    assert.equal(a.getFlag('buxaframework','npc.levelPointDebt.proficiencyPoints'),4);
    await setNpcProgressionNumber(a,'level',3);
    assert.equal(getAttributePoints(a,cfg),0);
    assert.equal(a.getFlag('buxaframework','npc.levelPointDebt.attributePoints'),2);
    await setNpcProgressionNumber(a,'level',5);
    assert.equal(getAttributePoints(a,cfg),0);
    assert.equal(a.getFlag('buxaframework','npc.levelPointDebt.attributePoints'),0);
    await setNpcProgressionNumber(a,'level',6);
    assert.equal(getAttributePoints(a,cfg),1);
    assert.equal(getProficiencyPoints(a,cfg),1);
  } finally {Object.assign(cfg.attributes.points,oldAttrRule);Object.assign(cfg.proficiencies.points,oldProfRule);invalidateSheetConfigCache();}
});

test('manual NPC point edits clear the matching award debt',async()=>{
  const a=actor({level:2,attributePoints:0,proficiencyPoints:0});
  await a.update({'flags.buxaframework.npc.levelPointDebt.attributePoints':17,
    'flags.buxaframework.npc.levelPointDebt.proficiencyPoints':12});
  assert.equal(await setNpcProgressionNumber(a,'attributePoints',50),true);
  assert.equal(a.getFlag('buxaframework','npc.levelPointDebt.attributePoints'),0);
  assert.equal(a.getFlag('buxaframework','npc.levelPointDebt.proficiencyPoints'),12);
  assert.equal(await setNpcProgressionNumber(a,'proficiencyPoints',7),true);
  assert.equal(a.getFlag('buxaframework','npc.levelPointDebt.proficiencyPoints'),0);
});

test('disabled point grants remain disabled even when NPC Quick permits level edits',async()=>{
  const a=actor();
  const was={attr:cfg.attributes.points.enabled,prof:cfg.proficiencies.enabled};
  try {
    cfg.attributes.points.enabled=false;
    cfg.proficiencies.enabled=false;
    invalidateSheetConfigCache();
    await setNpcProgressionNumber(a,'level',2000);
    assert.equal(getAttributePoints(a,cfg),5);
    assert.equal(getProficiencyPoints(a,cfg),4);
    assert.equal(a.calls,1);
  } finally {cfg.attributes.points.enabled=was.attr;cfg.proficiencies.enabled=was.prof;invalidateSheetConfigCache();}
});

test('large level jumps require constant-time reward math and prevent unsafe point overflow', async()=>{
  assert.equal(npcRewardDelta(1,999999,{enabled:true,grantAmount:1,grantEveryLevels:1}),999998);
  assert.equal(npcRewardDelta(999999,1,{enabled:true,grantAmount:2,grantEveryLevels:3}),-666666);
  assert.deepEqual(npcApplyReward(3,0,-7),{points:0,debt:4});
  assert.deepEqual(npcApplyReward(3,4,7),{points:6,debt:0});
  const a=actor({attributePoints:5,proficiencyPoints:4});
  const old=cfg.attributes.points.grantAmount;
  try {
    cfg.attributes.points.grantAmount=1000;
    invalidateSheetConfigCache();
    assert.equal(await setNpcProgressionNumber(a,'level',999999),false);
    assert.equal(a.calls,0);
  } finally {cfg.attributes.points.grantAmount=old;invalidateSheetConfigCache();}
});

test('Quick-only attribute tiles show dice/name/MOD/value and preserve actor interaction hooks',()=>{
  const tpl=readFileSync(new URL('../templates/player-sheet.hbs',import.meta.url),'utf8');
  const style=readFileSync(new URL('../styles/161-npc-sheet.css',import.meta.url),'utf8');
  const context=readFileSync(new URL('../scripts/apps/player-sheet-context.js',import.meta.url),'utf8');
  assert.match(tpl,/\{\{#if \.\.\/npcQuick\}\}[\s\S]*?buxa-npc-attribute-tile/);
  assert.match(tpl,/buxa-npc-attribute-modifier[^\n]*MOD/);
  assert.match(tpl,/buxa-npc-attribute-value[^\n]*VALUE/);
  assert.match(tpl,/buxa-npc-attribute-dice[^\n]*data-action="attributeRoll"/);
  assert.match(tpl,/data-attribute-card="\{\{id\}\}"/);
  assert.match(context,/modifierEnabled: modifier !== null \|\| isNpcQuick\(sheet.actor\)/);
  assert.match(style,/grid-template-columns: 26px minmax\(0, 1fr\) auto auto/);
  assert.match(style,/min-height: 43px/);
  assert.doesNotMatch(style,/\.buxa-attribute-card\.is-expanded/,'Quick should not override visual/player cards');
});
