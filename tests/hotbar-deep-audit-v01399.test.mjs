import test from 'node:test';
import assert from 'node:assert/strict';
import * as hotbar from '../scripts/core/hotbar-state.js';
const { defaultHotbarState, normalizeHotbarState, assignHotbarSlot,
  hotbarSlots, mergeHotbarConfiguration } = hotbar;

const owner = 'Actor.audit';
const unique = n => `valid-${n}`;

// Distinct saved layouts: Foundry settings sometimes collect duplicate or
// empty entries ahead of later valid tabs. A fixed leading slice discards them.
for (let n = 0; n < 35; n++) {
  test(`saved tabs ${n + 1}: valid trailing tab survives ${12 + n % 5} duplicate predecessors`, () => {
    const tabs = Array.from({ length: 12 + n % 5 }, (_, i) => ({ id: 'first', name: `duplicate ${i}` }));
    tabs.push({ id: unique(n), name: `last ${n}` });
    const state = normalizeHotbarState({ tabs, activeTab: unique(n), bindings: { [owner]: { [unique(n)]: ['potion'] } } });
    assert.ok(state.tabs.some(t => t.id === unique(n)));
    assert.equal(state.activeTab, unique(n));
    assert.equal(hotbarSlots(state, owner)[0], 'potion');
  });
}

for (let n = 0; n < 25; n++) {
  test(`saved tabs ${n + 36}: trailing valid tab survives ${12 + n % 4} malformed prefixes`, () => {
    const tabs = Array.from({length:12 + n % 4}, (_, i) => ({id: i % 2 ? '?' : '', name: 'bad'}));
    tabs.push({id: unique(100 + n), name:'valid'});
    const state = normalizeHotbarState({tabs});
    assert.equal(state.tabs.length, 1);
    assert.equal(state.tabs[0].id, unique(100 + n));
  });
}

for (let n = 0; n < 25; n++) {
  test(`shortcut ${n + 1}: cannot save an overlong item reference`, () => {
    const id = `item-${n}-` + 'a'.repeat(150);
    assert.equal(assignHotbarSlot(defaultHotbarState(), owner, 'tab-1', n % 10, id), null);
  });
}

for (let n = 0; n < 20; n++) {
  test(`shortcut ${n + 26}: cannot save whitespace-only item reference`, () => {
    assert.equal(assignHotbarSlot(defaultHotbarState(), owner, 'tab-1', n % 10, ' '.repeat(1 + n)), null);
  });
}

const badValues = [0, 1, 99, -1, 3.14, NaN, Infinity, -Infinity, true, false, [], {}, ['id'], {id:'abc'},
  new Date(0), /abc/, Symbol('abc'), 10n, new Map(), new Set()];
for (let n = 0; n < badValues.length; n++) {
  test(`shortcut ${n + 46}: rejects non-string item ID type ${n}`, () => {
    assert.equal(assignHotbarSlot(defaultHotbarState(), owner, 'tab-1', n % 10, badValues[n]), null);
  });
}

for (let n = 0; n < 25; n++) {
  test(`actor ${n + 1}: oversized Actor reference is rejected instead of vanishing on reload`, () => {
    const actorId = `Actor-${n}-` + 'z'.repeat(152);
    assert.equal(assignHotbarSlot(defaultHotbarState(), actorId, 'tab-1', n % 10, 'potion'), null);
  });
}

test('reserved __proto__ tab ID remains a real tab with its own shortcut array', () => {
  const actorSlots = Object.create(null); actorSlots.__proto__ = ['dagger'];
  const actorBindings = Object.create(null); actorBindings[owner] = actorSlots;
  const state = normalizeHotbarState({tabs:[{id:'__proto__',name:'Magic'}],bindings:actorBindings});
  assert.equal(Object.hasOwn(state.bindings[owner], '__proto__'), true);
  assert.equal(hotbarSlots(state, owner, '__proto__')[0], 'dagger');
});

test('reserved __proto__ Actor ID is saved without overwriting an object prototype', () => {
  const raw = Object.create(null); raw.__proto__ = {'tab-1':['sword']};
  const state = normalizeHotbarState({ bindings: raw });
  assert.equal(Object.hasOwn(state.bindings, '__proto__'), true);
  assert.equal(hotbarSlots(state, '__proto__')[0], 'sword');
});

test('malformed per-tab slots inherited through a prototype are not trusted', () => {
  const inherited = Object.create({'tab-1':['secret']});
  const state = normalizeHotbarState({bindings: {[owner]: inherited}});
  assert.equal(hotbarSlots(state, owner)[0], null);
});

test('configuration saves preserve slots added while a dialog was open', () => {
  let live = assignHotbarSlot(defaultHotbarState(), owner, 'tab-1', 0, 'potion');
  const dialog = structuredClone(defaultHotbarState()); dialog.color = '#334455';
  live = assignHotbarSlot(live, owner, 'tab-1', 1, 'sword');
  const merged = mergeHotbarConfiguration(live, dialog);
  assert.deepEqual(hotbarSlots(merged,owner).slice(0,2), ['potion','sword']);
  assert.equal(merged.color, '#334455');
});

test('configuration edits do not switch GM selection, lock state, or tab unexpectedly', () => {
  const live = defaultHotbarState();
  live.locked = true; live.activeTab = 'tab-2'; live.activeActorId = 'npc';
  const dialog = structuredClone(defaultHotbarState()); dialog.columns = 12;
  const merged = mergeHotbarConfiguration(live,dialog);
  assert.equal(merged.locked,true); assert.equal(merged.activeTab,'tab-2');
  assert.equal(merged.activeActorId,'npc'); assert.equal(merged.columns,12);
});

test('deleting a tab from configuration removes only that tabs shortcut references', () => {
  let live = assignHotbarSlot(defaultHotbarState(),owner,'tab-1',0,'potion');
  live = assignHotbarSlot(live,owner,'tab-2',0,'staff');
  const dialog = structuredClone(defaultHotbarState()); dialog.tabs.splice(1,1);
  const merged = mergeHotbarConfiguration(live,dialog);
  assert.equal(Object.hasOwn(merged.bindings[owner],'tab-2'),false);
  assert.equal(hotbarSlots(merged,owner,'tab-1')[0],'potion');
});

// Blank form inputs and browser checkbox values must not become a tiny 4-slot
// hotbar by coercing ''/false to zero, especially in imported world settings.
const blankValues = ['', ' ', '\t', '\n', ' \t\n ', null, undefined, false, true, [], {}, NaN];
for (let n = 0; n < blankValues.length; n++) {
  test(`layout numeric ${n + 1}: blank/non-numeric columns restore default width`, () => {
    assert.equal(normalizeHotbarState({ columns: blankValues[n] }).columns, 10);
  });
}


test('adding a tab in hotbar settings activates that newly created tab without erasing earlier bindings', () => {
  let live = assignHotbarSlot(defaultHotbarState(),owner,'tab-1',0,'sword');
  const dialog = structuredClone(defaultHotbarState());
  dialog.tabs.push({id:'tab-4',name:'Spells'}); dialog.activeTab = 'tab-4';
  const merged = mergeHotbarConfiguration(live,dialog);
  assert.equal(merged.activeTab, 'tab-4');
  assert.equal(hotbarSlots(merged,owner,'tab-1')[0], 'sword');
});
