import test from 'node:test';
import assert from 'node:assert/strict';
import { actorCreationChoices, newActorPreset } from '../scripts/apps/actor-creation-presets.js';

const types = ['character', 'npc', 'encounter', 'group', 'vehicle'];

test('New Actor choices include Player, NPC Visual, NPC Quick, and preserve other D&D types', () => {
  assert.deepEqual(actorCreationChoices(types).map(choice => choice.label),
    ['Player', 'NPC Visual', 'NPC Quick', 'encounter', 'group', 'vehicle']);
  assert.deepEqual(actorCreationChoices(['npc']).map(choice => choice.id), ['npc-visual', 'npc-quick']);
});

test('Actor presets map UI choices to supported D&D document types and saved sheet modes', () => {
  assert.deepEqual(newActorPreset('player', types), {
    type: 'character', flags: {core: {sheetClass: 'buxaframework.BuxaPlayerSheet'}}
  });
  assert.deepEqual(newActorPreset('npc-visual', types), {
    type: 'npc', flags: {buxaframework: {npc: {sheetMode: 'visual'}},core: {sheetClass:'buxaframework.BuxaNpcSheet'}}
  });
  assert.deepEqual(newActorPreset('npc-quick', types), {
    type: 'npc', flags: {buxaframework: {npc: {sheetMode: 'quick'}},core: {sheetClass:'buxaframework.BuxaNpcSheet'}}
  });
  assert.deepEqual(newActorPreset('system:vehicle', types), {type:'vehicle'});
  for (const invalid of ['character','npc','system:npc','npc-fast','system:unknown','__proto__']) {
    assert.throws(() => newActorPreset(invalid, types), /Invalid actor type/);
  }
});

test('New Actor dialog uses preset selection and preserves folder targeting', async () => {
  const {readFileSync} = await import('node:fs');
  const directory = readFileSync(new URL('../scripts/apps/world-directory-generic.js', import.meta.url), 'utf8');
  assert.match(directory, /newActorPreset\(selection, types\.length/);
  assert.match(directory, /folderId \|\| \(await ensureMainFolder\(this\.type\)\)/);
  assert.match(directory, /Other D&amp;D actor types/);
});

test('NPC state initialization stays enabled with old character-only world settings', async () => {
  const {isTargetActorType} = await import('../scripts/core/config.js');
  const original = globalThis.CONFIG;
  globalThis.CONFIG = {Actor:{dataModels:{character:{},npc:{},vehicle:{}}}};
  try {
    const config = {actorTypes:['character']};
    assert.equal(isTargetActorType({type:'npc'},config),true);
    assert.equal(isTargetActorType({type:'character'},config),true);
    assert.equal(isTargetActorType({type:'vehicle'},config),false);
  } finally {globalThis.CONFIG=original;}
});

test('Foundry V14 sheet registration retains the private static receiver instead of crashing init', async () => {
  // registerSheet internally uses a private static #pending field. Calling a
  // detached reference to this static method crashes the Foundry init hook.
  class StrictRegistration {
    static #pending = [];
    static registerSheet(docClass, scope, sheetClass, options) {
      this.#pending.push({docClass,scope,sheetClass,options});
    }
    static get calls() {return [...this.#pending];}
  }
  const originals = {foundry:globalThis.foundry, CONFIG:globalThis.CONFIG, CONST:globalThis.CONST, Actor:globalThis.Actor};
  globalThis.CONST = {};
  globalThis.foundry = { applications: {
    api: {HandlebarsApplicationMixin: Base=>Base, ApplicationV2:class {}},
    sheets: {ActorSheetV2:class {}, ItemSheetV2:class {}},
    apps: {DocumentSheetConfig:StrictRegistration}
  }, utils:{randomID:()=> 'aaa', deepClone:structuredClone} };
  globalThis.Actor = class Actor {};
  globalThis.CONFIG = {Actor: {dataModels:{character:{},npc:{},vehicle:{}}}};
  try {
    const {registerBuxaActorSheets} = await import('../scripts/apps/actor-sheet-registration.js');
    registerBuxaActorSheets({actorTypes:['character'],makeDefault:true});
    assert.equal(StrictRegistration.calls.length,2);
    assert.deepEqual(StrictRegistration.calls.map(row=>row.options.types), [['character'],['npc']]);
    assert.deepEqual(StrictRegistration.calls.map(row=>row.options.makeDefault), [true,true]);
    assert.equal(StrictRegistration.calls[0].sheetClass.name, 'BuxaPlayerSheet');
    assert.equal(StrictRegistration.calls[1].sheetClass.name, 'BuxaNpcSheet');
  } finally {
    globalThis.foundry=originals.foundry;
    globalThis.CONFIG=originals.CONFIG;
    globalThis.Actor=originals.Actor;
    globalThis.CONST=originals.CONST;
  }
});
