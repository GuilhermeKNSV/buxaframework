import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SHEET_CONFIG, HOOKS } from '../scripts/core/constants.js';
import { progressionChanges, progressionEventKey } from '../scripts/apps/scene-progression-events.js';
import { installSceneProgressionFx, progressionVisual, matchingProgressionTokens } from '../scripts/apps/scene-progression-fx.js';
import { fakeSceneFxDocument, fakeSceneFxCanvas } from './helpers/scene-fx-dom.mjs';

globalThis.foundry ??= { utils: { deepClone: structuredClone, randomID: () => 'id' } };

const attribute = { id: 'str', label: 'Strength', rebirth: { enabled: true, maxPoints: 100 }, appearance: {} };
const config = { attributes: { entries: [attribute] }, rebirthStyles: [{color:'#8090a0'},{color:'#9944ff'}] };

function harness({ svgAvailable = true, twoTokens = false } = {}) {
  const registered = new Map(), packets = [], scrolling = [], calls = [];
  globalThis.Hooks = { on(name, fn) { if (!registered.has(name)) registered.set(name, []); registered.get(name).push(fn); } };
  const emitHook = (name, ...args) => { for (const fn of registered.get(name) || []) calls.push(fn(...args)); };
  const layer = { scrolling: [], createScrollingText(at, message) { scrolling.push({at, message}); return Promise.resolve(); } };
  const first = { center: {x:100,y:100}, w:70,h:70, document:{ id:'t1', actorId:'a' } };
  const second = { center: {x:180,y:200}, w:70,h:70, document:{ id:'t2', actorId:'a' } };
  const doc = fakeSceneFxDocument();
  globalThis.document = svgAvailable ? doc : undefined;
  globalThis.canvas = fakeSceneFxCanvas(twoTokens ? [first,second] : [first]);
  globalThis.canvas.interface = layer;
  const raw = structuredClone(DEFAULT_SHEET_CONFIG);
  raw.attributes.entries = [attribute];
  raw.rebirthStyles = config.rebirthStyles;
  globalThis.game = { user:{ id:'author', isGM:true }, buxaframework: {},
    settings:{get:()=>raw}, actors:{get:id=>id==='a'?{id:'a'}:null},
    socket:{ emit:(_name,payload)=>packets.push(payload), on:(name,fn)=>emitHook.__socket=fn }
  };
  installSceneProgressionFx();
  return { layer,doc,packets,scrolling,first,second,emitHook,socket:payload=>emitHook.__socket(payload) };
}

test('decodes runtime progression from flattened and nested Foundry updates', () => {
  const actor = {id:'a'};
  const options = {'buxaframework.runtime':true};
  assert.deepEqual(progressionChanges(actor, {'flags.buxaframework.level':3},options,config), [{kind:'level',result:{newLevel:3}}]);
  assert.deepEqual(progressionChanges(actor,{flags:{buxaframework:{attributes:{str:{rebirths:2}}}}},options,config),
    [{kind:'rebirth',result:{attribute,after:2}}]);
  assert.deepEqual(progressionChanges(actor, {'flags.buxaframework.attributes.str.rebirths':3},options,config),
    [{kind:'rebirth',result:{attribute,after:3}}]);
  assert.deepEqual(progressionChanges(actor,{'flags.buxaframework.level':4}, {},config), []);
  assert.deepEqual(progressionChanges(actor,{'flags.buxaframework.level':'invalid'},options,config), []);
  assert.deepEqual(progressionChanges(actor,{'flags.buxaframework.attributes.str.rebirths':0},options,config), []);
  assert.deepEqual(progressionChanges(actor,{'flags.buxaframework.attributes.fake.rebirths':1},options,config), []);
});

test('Actor updates trigger level and rarity rebirth effects even if custom hooks never fire', () => {
  const h=harness();
  const actor={id:'a'};
  h.emitHook('updateActor',actor,{'flags.buxaframework.level':8},{'buxaframework.runtime':true},'author');
  assert.equal(h.doc.body.children.length,1);
  assert.equal(h.packets.length,1);
  h.emitHook('updateActor',actor,{'flags.buxaframework.attributes.str.rebirths':2}, {'buxaframework.runtime':true},'author');
  assert.equal(h.doc.body.children.length,2);
  assert.equal(h.packets.length,2);
  assert.equal(h.doc.body.children[1].querySelector('.buxa-celebration-label').textContent,'REBIRTH');
  h.emitHook('canvasTearDown');
});

test('custom hook + document update + socket delivery never play the same level twice', () => {
  const h=harness();
  const actor={id:'a'};
  h.emitHook('updateActor',actor,{'flags.buxaframework.level':6},{'buxaframework.runtime':true},'author');
  h.emitHook(HOOKS.LEVEL_UP,actor,{newLevel:6});
  h.socket({type:'progression-fx',sender:'other',sceneId:'scene',actorId:'a',visual:progressionVisual('level',{newLevel:6})});
  assert.equal(h.doc.body.children.length,1);
  assert.equal(h.packets.length,1);
  h.emitHook('canvasTearDown');
});

test('remote Actor updates render locally without rebroadcasting socket traffic', () => {
  const h=harness();
  h.emitHook('updateActor',{id:'a'}, {'flags':{'buxaframework':{'level':9}}},{'buxaframework.runtime':true},'other');
  assert.equal(h.doc.body.children.length,1);
  assert.equal(h.packets.length,0);
  h.emitHook('canvasTearDown');
});

test('unavailable SVG DOM falls back to native floating text above the token', () => {
  for (const setup of [{svgAvailable:false},{svgAvailable:false}]) {
    const h=harness(setup);
    h.emitHook(HOOKS.LEVEL_UP,{id:'a'},{newLevel:11});
    assert.equal(h.scrolling.length,1);
    assert.match(h.scrolling[0].message,/LEVEL UP.*11/);
    h.emitHook('canvasTearDown');
  }
});

test('multiple matching tokens show their own celebration and synthetic Actors target one token', () => {
  const h=harness({twoTokens:true});
  h.emitHook(HOOKS.LEVEL_UP,{id:'a'},{newLevel:5});
  assert.equal(h.doc.body.children.length,2);
  h.emitHook('canvasTearDown');
  const actor={id:'a',isToken:true,token:{id:'t2'}};
  assert.deepEqual(matchingProgressionTokens(actor,[h.first,h.second]),[h.second]);
  assert.notEqual(progressionEventKey(actor, progressionVisual('level',{newLevel:5}),'scene'),
    progressionEventKey({id:'a',isToken:true,token:{id:'t1'}},progressionVisual('level',{newLevel:5}),'scene'));
});

test('hidden or invisible tokens are not used for non-GM effects', () => {
  globalThis.game = {user:{isGM:false}};
  assert.deepEqual(matchingProgressionTokens({id:'a'}, [
    {document:{actorId:'a'},center:{x:1,y:2},visible:false},
    {document:{actorId:'a',hidden:true},center:{x:1,y:2}},
    {document:{actorId:'a'},center:{x:2,y:3}}
  ]).map(token=>token.center.x), [2]);
});

test('GM can preview the real token animation without changing progression or sending a socket packet', () => {
  const h = harness();
  const actor = {id:'a',getFlag:(_ns,path)=>path==='level'?12:2};
  assert.equal(game.buxaframework.previewProgressionFx(actor,'level'),true);
  assert.equal(game.buxaframework.previewProgressionFx(actor,'rebirth','str'),true);
  assert.equal(h.doc.body.children.length,2);
  assert.equal(h.packets.length,0);
  game.user.isGM = false;
  assert.equal(game.buxaframework.previewProgressionFx(actor,'level'),false);
  h.emitHook('canvasTearDown');
});

test('rebirth events on different attributes never collide when labels and tiers are identical', () => {
  const first = progressionVisual('rebirth', {attribute:{id:'one',label:'Power',rebirth:{enabled:true}},after:2},config);
  const second = progressionVisual('rebirth', {attribute:{id:'two',label:'Power',rebirth:{enabled:true}},after:2},config);
  assert.equal(first.subtitle,second.subtitle);
  assert.notEqual(progressionEventKey({id:'a'},first,'scene'),progressionEventKey({id:'a'},second,'scene'));
});

test('distinct consecutive level and rebirth values have distinct deduplication keys', () => {
  const actor = { id: 'a' };
  assert.notEqual(
    progressionEventKey(actor, progressionVisual('level', {newLevel:714}), 'scene'),
    progressionEventKey(actor, progressionVisual('level', {newLevel:715}), 'scene')
  );
  assert.notEqual(
    progressionEventKey(actor, progressionVisual('rebirth', {attribute, after:2}, config), 'scene'),
    progressionEventKey(actor, progressionVisual('rebirth', {attribute, after:3}, config), 'scene')
  );
});


test('socket synthetic Actor cannot display FX on a token with a different Actor ID', () => {
  const h=harness({twoTokens:true});
  const foreign={center:{x:500,y:500},document:{id:'t3',actorId:'someone-else'}};
  assert.deepEqual(matchingProgressionTokens({id:'a',isToken:true,token:{id:'t3'}},[foreign]),[]);
  h.first.document.actorId='someone-else';
  h.socket({type:'progression-fx',sender:'other',sceneId:'scene',actorId:'a',tokenId:'t1',
    visual:progressionVisual('level',{newLevel:100})});
  assert.equal(h.doc.body.children.length,0,'actor mismatch must not display on an unrelated token');
  h.emitHook('canvasTearDown');
});
