import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_SHEET_CONFIG } from '../scripts/core/constants.js';

const read = relative => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
function getPath(object, path) { return String(path).split('.').reduce((v,k)=>v?.[k], object); }
function setPath(object, path, value) {
  const parts = String(path).split('.'); let o=object;
  for(const part of parts.slice(0,-1)) o=o[part] ??= {};
  o[parts.at(-1)]=value;
}
const cfg = structuredClone(DEFAULT_SHEET_CONFIG);
const attr = { id:'str',label:'Strength',ability:'str',rebirth:{enabled:false}, modifier:{enabled:true,everyPoints:2} };
cfg.attributes.entries=[attr];
globalThis.game={ user:{ isGM:true, id:'gm' }, settings:{get:()=>cfg}, system:{id:'dnd5e'} };
globalThis.foundry={ utils:{deepClone:structuredClone, getProperty:getPath, hasProperty:(o,p)=>getPath(o,p)!==undefined, setProperty:setPath, randomID:()=> 'abc', escapeHTML:String } };
const npcCore = await import('../scripts/core/npc-sheet.js');
const attributes = await import('../scripts/core/attributes.js');
const { getActorLevel } = await import('../scripts/core/leveling.js');

function actor(type='npc') {
  const data={ flags:{buxaframework:{}},system:{abilities:{str:{value:10}}} };
  return { type, id:'npc-a', isOwner:true, ...data,
    getFlag: (ns,path)=>ns==='buxaframework'?getPath(data.flags.buxaframework,path):undefined,
    async update(changes){for(const [path,v] of Object.entries(changes)) setPath(data,path,v);return this;}
  };
}

test('NPC mode defaults quick, persists visual, and does not affect a character',async()=>{
  const a=actor(), p=actor('character');
  assert.equal(npcCore.getNpcSheetMode(a),'quick');
  assert.equal(npcCore.isNpcQuick(p),false);
  assert.equal(await npcCore.saveNpcSheetMode(a,'visual'),true);
  assert.equal(npcCore.getNpcSheetMode(a),'visual');
  assert.equal(await npcCore.saveNpcSheetMode(p,'quick'),false);
  assert.equal(await npcCore.saveNpcSheetMode(a,'not-a-mode'),false);
});

test('NPC attribute overrides change real calculation without spending a point',async()=>{
  const a=actor();
  assert.equal(attributes.getAttributeValue(a,attr,cfg),10);
  const initial=attributes.getAttributeModifier(attr,10,0,a,cfg);
  assert.equal(initial,5);
  assert.equal(await npcCore.saveNpcAttributeOverrides(a,'str',{value:'50',modifier:'-3',dice:'4'}),true);
  assert.equal(attributes.getAttributeValue(a,attr,cfg),50);
  assert.equal(attributes.getAttributeModifier(attr,50,0,a,cfg),-3);
  assert.equal(attributes.getAttributeDice(attr,0,a,cfg),4);
  assert.equal(a.getFlag('buxaframework','attributePoints'),undefined);
  assert.equal(a.system.abilities.str.value,10,'underlying ability investment is not rewritten');
  assert.equal(await npcCore.saveNpcAttributeOverrides(a,'str',{value:'',modifier:'',dice:''}),true);
  assert.equal(attributes.getAttributeValue(a,attr,cfg),10);
  assert.equal(attributes.getAttributeModifier(attr,10,0,a,cfg),initial);
  assert.equal(attributes.getAttributeDice(attr,0,a,cfg),1);
});

test('NPC cheats reject invalid/out-of-range inputs without altering any fields',async()=>{
  const a=actor();
  assert.equal(await npcCore.saveNpcAttributeOverrides(a,'str',{value:'4.5'}),false);
  assert.equal(await npcCore.saveNpcAttributeOverrides(a,'str',{value:'32',dice:'0'}),false);
  assert.equal(a.getFlag('buxaframework','npc.attributeOverrides.str.value'),undefined);
  assert.equal(await npcCore.setNpcProgressionNumber(a,'level',12),true);
  assert.equal(getActorLevel(a,cfg),12);
  assert.equal(await npcCore.setNpcProgressionNumber(a,'attributePoints',999),true);
  assert.equal(attributes.getAttributePoints(a,cfg),999);
  assert.equal(await npcCore.setNpcProgressionNumber(a,'proficiencyPoints',7),true);
  assert.equal(await npcCore.setNpcProgressionNumber(a,'level',-1),false);
  assert.equal(await npcCore.setNpcProgressionNumber(a,'other','1'),false);
  assert.equal(getActorLevel(a,cfg),12);
});

test('Only GM with actor ownership can set NPC cheats',async()=>{
  const a=actor();
  game.user.isGM=false;
  try {
    assert.equal(await npcCore.setNpcProgressionNumber(a,'level',20),false);
    assert.equal(await npcCore.saveNpcAttributeOverrides(a,'str',{dice:5}),false);
    assert.equal(await npcCore.saveNpcSheetMode(a,'visual'),false);
  } finally {game.user.isGM=true;}
  a.isOwner=false;
  assert.equal(await npcCore.saveNpcAttributeOverrides(a,'str',{dice:5}),false);
});

test('NPC template renders quick stats on basic and preserves native inventory markup',()=>{
  const sheet=read('templates/player-sheet.hbs');
  assert.match(sheet,/\{\{#unless npcQuick\}\}<span class="buxa-sheet-tab/);
  assert.match(sheet,/data-sheet-panel="\{\{#if npcQuick\}\}basic\{\{else\}\}stats/);
  assert.match(sheet,/data-sheet-panel="inventory"/);
  assert.match(sheet,/data-attribute-card="\{\{id\}\}"/);
  assert.match(sheet,/Open NPC Settings/);
  assert.match(read('scripts/apps/npc-sheet.js'),/extends BuxaPlayerSheet/);
});

test('NPC Quick suppresses scene effects at source, on receiving client and on tokens',()=>{
  const src=read('scripts/apps/scene-progression-fx.js');
  assert.match(src,/!globalThis\.canvas\?\.ready \|\| !scene \|\| isNpcQuick\(actor\)/);
  assert.match(src,/if \(isNpcQuick\(token\.actor\)\) continue/);
  assert.match(src,/if \(!actor \|\| isNpcQuick\(actor\)\) return/);
});

test('scene progression events for a Quick NPC create no effects or socket broadcasts', async()=>{
  const { installSceneProgressionFx } = await import('../scripts/apps/scene-progression-fx.js');
  const { HOOKS } = await import('../scripts/core/constants.js');
  const callbacks = new Map(), packets = [];
  globalThis.Hooks = { on:(key,fn)=>{callbacks.set(key,fn);}, callAll(){} };
  globalThis.canvas = {ready:true,scene:{id:'scene'},tokens:{placeables:[{
    center:{x:100,y:100}, w:80,h:80, document:{id:'token',actorId:'npc-a'}, actor:actor()
  }]}};
  const quick=actor();
  game.socket={ emit:(_name,packet)=>packets.push(packet), on:(_name,fn)=>callbacks.set('socket',fn)};
  game.buxaframework={};
  game.actors={get:()=>quick};
  installSceneProgressionFx();
  callbacks.get(HOOKS.LEVEL_UP)(quick,{newLevel:20});
  callbacks.get(HOOKS.ATTRIBUTE_REBIRTH)(quick,attr,{after:2});
  callbacks.get('updateActor')(quick,{'flags.buxaframework.level':20},{'buxaframework.runtime':true},game.user.id);
  assert.equal(packets.length,0,'Quick NPCs must not broadcast level/rebirth animation');
  assert.doesNotThrow(()=>callbacks.get('socket')({type:'progression-fx',sender:'other',sceneId:'scene',actorId:'npc-a',visual:{kind:'level',value:'20'}}));
  callbacks.get('canvasTearDown')();
});
