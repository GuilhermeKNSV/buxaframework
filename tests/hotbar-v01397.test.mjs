import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  defaultHotbarState, normalizeHotbarState, hotbarSlots, assignHotbarSlot,
  nextHotbarSlot, addHotbarTab, removeHotbarTab
} from '../scripts/core/hotbar-state.js';
import { resolveHotbarActor } from '../scripts/apps/hotbar-actor.js';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const actorId = 'Actor.abc';

test('hotbar starts with 3 numbered tabs, a single row, 10 slots and two resource orbs', () => {
  const state = defaultHotbarState();
  assert.equal(state.enabled, false);
  assert.equal(state.rows, 1);
  assert.equal(state.columns, 10);
  assert.deepEqual(state.tabs.map(t => t.name), ['1','2','3']);
  assert.equal(state.orbs.length, 2);
  assert.equal(hotbarSlots(state, actorId).length, 10);
});

test('shortcuts are per Actor and tab; assigning never mutates an Item or its placement', () => {
  const first = defaultHotbarState();
  const item = { id: 'blade', parent: { id: 'abc' }, system: { quantity: 1 } };
  const before = structuredClone(item);
  const next = assignHotbarSlot(first, actorId, 'tab-1', 2, item.id);
  assert.deepEqual(item, before);
  assert.equal(hotbarSlots(next, actorId)[2], 'blade');
  assert.equal(hotbarSlots(next, 'Actor.other')[2], null);
  assert.equal(hotbarSlots(next, actorId, 'tab-2')[2], null);
  assert.equal(nextHotbarSlot(next, actorId, 'blade'), 2);
  assert.equal(hotbarSlots(first, actorId)[2], null);
});

test('moving shortcuts swaps identities and never destroys either binding', () => {
  let state = defaultHotbarState();
  state = assignHotbarSlot(state, actorId, state.activeTab, 0, 'sword');
  state = assignHotbarSlot(state, actorId, state.activeTab, 1, 'potion');
  state = assignHotbarSlot(state, actorId, state.activeTab, 1, 'sword', {actorId,tabId:'tab-1',index:0});
  assert.deepEqual(hotbarSlots(state, actorId).slice(0, 2), ['potion','sword']);
  assert.equal(assignHotbarSlot(state, actorId, state.activeTab, 0, 'wrong', {actorId,tabId:'tab-1',index:1}), null);
});

test('locked hotbar cannot add, move, overwrite or remove shortcuts', () => {
  let state = assignHotbarSlot(defaultHotbarState(), actorId, 'tab-1', 0, 'potion');
  state.locked = true;
  assert.equal(assignHotbarSlot(state, actorId, 'tab-1', 1, 'sword'), null);
  assert.equal(assignHotbarSlot(state, actorId, 'tab-1', 0, null), null);
  assert.equal(hotbarSlots(state, actorId)[0], 'potion');
});

test('malformed config is normalized without executing slot values or losing valid actor shortcuts', () => {
  const state = normalizeHotbarState({ enabled: 'true', color:'red', rows: 99, columns: -4,
    tabs: [{id:'one',name:'Equipment'},{id:'one',name:'duplicate'},{id:'two',name:'Potions'}],
    activeTab:'two', orbs:[{resourceId:'hp',showNumber:'true'}],
    bindings:{ [actorId]:{two:['potion',44,'sword']}} });
  assert.equal(state.enabled, false);
  assert.equal(state.rows, 4);
  assert.equal(state.columns, 4);
  assert.equal(state.color, '#bc965b');
  assert.equal(state.tabs.length, 2);
  assert.deepEqual(hotbarSlots(state, actorId, 'two').slice(0,3), ['potion',null,'sword']);
  assert.equal(state.orbs[0].showNumber, false);
});

test('tabs can be created, renamed and removed without destroying unrelated tab bindings', () => {
  let state = defaultHotbarState();
  state = assignHotbarSlot(state, actorId, 'tab-1', 0, 'sword');
  state = addHotbarTab(state);
  const tab = state.activeTab;
  state.tabs.find(t => t.id === tab).name = 'Spells';
  state = assignHotbarSlot(state, actorId, tab, 0, 'staff');
  state = removeHotbarTab(state, tab);
  assert.equal(state.tabs.some(t => t.id === tab), false);
  assert.equal(hotbarSlots(state, actorId, 'tab-1')[0], 'sword');
  assert.equal(state.bindings[actorId]?.[tab], undefined);
});

test('player hotbar stays linked to assigned character even when selecting other controlled tokens', () => {
  const player = {id:'player',isOwner:true,type:'character'};
  const npc = {id:'npc',isOwner:true,type:'npc'};
  const unavailable = {id:'private',isOwner:false};
  const gameRef = {user:{isGM:false,character:player},actors:new Map([['npc',npc],['player',player]])};
  assert.equal(resolveHotbarActor({activeActorId:'npc'}, {gameRef,canvasRef:{tokens:{controlled:[]}}}),player);
  assert.equal(resolveHotbarActor({activeActorId:'npc'}, {gameRef,canvasRef:{tokens:{controlled:[{actor:npc}]}}}),player);
  assert.equal(resolveHotbarActor({activeActorId:'private'}, {gameRef,canvasRef:{tokens:{controlled:[{actor:unavailable}]}}}),player);
  const fallback = {user:{isGM:false,character:null},actors:new Map([['player',player]])};
  assert.equal(resolveHotbarActor({}, {gameRef:fallback}),player);
  fallback.actors.set('npc',npc);
  assert.equal(resolveHotbarActor({}, {gameRef:fallback}),null,'multiple owned Actors must not be chosen at random');
});

test('GM hotbar uses explicitly selected actor or token, not whichever token is controlled', () => {
  const gmActor = {id:'gm',isOwner:true,type:'npc'};
  const npc = {id:'npc',isOwner:true,type:'npc'};
  const linkedToken = {actor:npc,document:{id:'token-1'}};
  const gameRef = {user:{isGM:true,character:gmActor},actors:new Map([['npc',npc]])};
  const canvasRef = {scene:{id:'scene-1'},tokens:{controlled:[{actor:gmActor}],placeables:[linkedToken]}};
  assert.equal(resolveHotbarActor({activeActorId:'npc'}, {gameRef,canvasRef}),npc);
  assert.equal(resolveHotbarActor({activeTokenId:'token-1',activeSceneId:'scene-1',activeActorId:'npc'}, {gameRef,canvasRef}),npc);
  assert.equal(resolveHotbarActor({activeTokenId:'token-1',activeSceneId:'other',activeActorId:'npc'}, {gameRef,canvasRef}),npc);
});

test('native Foundry hotbar hides only while Buxa is active and custom hotbar offers restore', () => {
  const css = read('styles/163-hotbar.css');
  const view = read('scripts/apps/hotbar-view.js');
  const controller = read('scripts/apps/hotbar.js');
  assert.match(css, /body\.buxa-hotbar-active #hotbar\s*\{\s*display:\s*none !important/);
  assert.match(view, /Restore Foundry hotbar/);
  assert.match(controller, /classList\.toggle\('buxa-hotbar-active', state\.enabled\)/);
  assert.match(controller, /toggleAttribute\('hidden', state\.enabled\)/);
});

test('pointer drag from inventory creates shortcut before any placement operation', () => {
  const drag = read('scripts/apps/inventory-controls.js');
  const shortcut = drag.indexOf('assignInventoryHotbarDrop(');
  const ground = drag.indexOf('dropInventoryIntoGroundContainer(', shortcut);
  const scene = drag.indexOf('dropInventoryItemOnBoard(', shortcut);
  assert.ok(shortcut > 0 && ground > shortcut && scene > shortcut);
  assert.match(drag, /if \(assignInventoryHotbarDrop\([\s\S]+?\)\) \{ cleanup\(\); return; \}/);
  assert.match(read('scripts/apps/item-context-menu.js'), /ADD TO HOTBAR/);
});

test('hotbar actions reuse the item use/roll pipeline and original inventory context menu', () => {
  const actions = read('scripts/apps/hotbar-item-actions.js');
  assert.match(actions, /rollItemDice\(item, dice\.id/);
  assert.match(actions, /useItemWithoutDice\(item/);
  assert.match(actions, /openItemContextMenu\(sheet, item/);
  assert.match(actions, /item\.parent !== actor/);
});

test('reducing rows and later adding shortcuts does not erase bindings in hidden rows', () => {
  let state = defaultHotbarState(); state.rows = 3;
  state = assignHotbarSlot(state, actorId, 'tab-1', 23, 'amulet');
  state.rows = 1;
  state = assignHotbarSlot(state, actorId, 'tab-1', 0, 'sword');
  state.rows = 3;
  assert.equal(hotbarSlots(state, actorId)[23], 'amulet');
  assert.equal(hotbarSlots(state, actorId)[0], 'sword');
});
