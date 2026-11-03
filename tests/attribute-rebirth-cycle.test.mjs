import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const id = 'buxaframework';
const attribute = {
  id: 'str', label: 'Strength', ability: 'str',
  rebirth: { enabled: true, maxPoints: 100, gainDieEveryRebirths: 1, lockModifier: false },
  modifier: { enabled: false }
};
const cfg = {
  numberDisplay: { mode: 'truncate' },
  attributes: { points: { enabled: true, startingPoints: 0,
    allowBelowZero: true, playersCanDecrease: true, directValueEntry: true }, entries: [attribute] },
  rebirthStyles: Array.from({ length: 4 }, (_, i) => ({
    color: ['#8b93a1', '#55b86a', '#4d8fe6', '#9b6de3'][i],
    decoration: ['I','II','III','IV'][i]
  }))
};

function getPath(object, path) {
  return String(path).split('.').reduce((value, key) => value?.[key], object);
}
function setPath(object, path, value) {
  const keys = String(path).split('.');
  let current = object;
  for (const key of keys.slice(0, -1)) current = current[key] ??= {};
  current[keys.at(-1)] = value;
}
let notificationMessages = [];
globalThis.game = {
  system: { id: 'dnd5e' }, user: { id: 'GM', isGM: true },
  settings: { get: (_id, key) => key === 'sheetConfig' ? cfg : undefined },
  i18n: { lang: 'en' }
};
globalThis.Hooks = { callAll() {} };
globalThis.ui = { notifications: {
  warn: (message) => notificationMessages.push(message),
  info: () => {}, error: () => {}
} };
globalThis.foundry = { utils: {
  getProperty: getPath, hasProperty: (o, p) => getPath(o, p) !== undefined,
  setProperty: setPath, deepClone: structuredClone, escapeHTML: String,
  randomID: () => 'abcd1234'
}, applications: { api: { DialogV2: { confirm: async () => true } } } };

const { getAttributePoints, getAttributeRebirthState, getAttributeVisual,
  changeAttribute, rebirthAttribute, getAttributeDice, setAttributeDirect, addAttributePoints } =
  await import('../scripts/core/attributes.js');
const { getAttributeBaseProgress, getAttributeProgressState } =
  await import('../scripts/core/attribute-progress.js');
const { normalizeSheetConfig } = await import('../scripts/core/config.js');

function actorAt(progress, { points = 10, rebirths = 0, effectItems = [] } = {}) {
  const data = { flags: { [id]: { attributePoints: points,
    attributes: { str: { progress, rebirths } } } },
    system: { abilities: { str: { value: progress - 100 * rebirths } } } };
  const updates = [];
  return {
    ...data, isOwner: true, items: effectItems,
    getFlag: (scope, path) => scope === id ? getPath(data.flags[id], path) : undefined,
    async update(update, options) {
      updates.push({ ...update });
      for (const [path, value] of Object.entries(update)) setPath(data, path, value);
      return this;
    },
    updates
  };
}

test('100 invested points can be claimed as a rebirth, which resets the cycle and advances die and styling', async () => {
  const actor = actorAt(100);
  assert.equal(getAttributeRebirthState(actor, attribute, cfg).readyToRebirth, true);
  assert.equal((await rebirthAttribute(actor, 'str', { ask: false })).after, 1);
  const after = getAttributeRebirthState(actor, attribute, cfg);
  assert.equal(after.claimedRebirths, 1);
  assert.equal(after.activeRebirths, 1);
  assert.equal(after.value, 0);
  assert.equal(after.readyToRebirth, false);
  assert.equal(getAttributePoints(actor, cfg), 10);
  assert.equal(getAttributeDice(attribute, after.activeRebirths, actor, cfg), 2);
  assert.equal(getAttributeVisual(attribute, after.activeRebirths, cfg).color, '#8b93a1');
  assert.equal(actor.system.abilities.str.value, 0);
  assert.equal(await changeAttribute(actor, 'str', -1), false);
  assert.equal(getAttributePoints(actor, cfg), 10);
  assert.equal((await rebirthAttribute(actor, 'str', { ask: false })), false);
});

test('100-point attribute cannot mint limitless refunds even if general below-zero values are enabled', async () => {
  const actor = actorAt(100, { points: 0 });
  for (let n = 0; n < 120; n++) await changeAttribute(actor, 'str', -1);
  assert.equal(getAttributeBaseProgress(actor, attribute), 0);
  assert.equal(getAttributePoints(actor, cfg), 100);
  assert.equal(actor.updates.length, 100);
  assert.equal(await changeAttribute(actor, 'str', -1), false);
});

test('cannot spend into a further cycle until current cycle is rebirthed, including direct editing', async () => {
  const actor = actorAt(99, { points: 12 });
  await setAttributeDirect(actor, 'str', 500);
  assert.equal(getAttributeBaseProgress(actor, attribute), 100);
  assert.equal(getAttributePoints(actor, cfg), 11);
  assert.equal((await changeAttribute(actor, 'str', 1)).after, 1); // claims instead of spending
  assert.equal(getAttributeBaseProgress(actor, attribute), 100);
  assert.equal(getAttributeRebirthState(actor, attribute, cfg).activeRebirths, 1);
  await changeAttribute(actor, 'str', 1);
  assert.equal(getAttributeBaseProgress(actor, attribute), 101);
});

test('visible cap unlocks item-assisted rebirth without minting permanent points', async () => {
  const actor = actorAt(99, { points: 0 });
  const item = { id: 'charm', system: { quantity: 1 },
    getFlag: (module, key) => module === id && key === 'item'
      ? { increases: [{ target: 'attribute:str:value', value: 4,
        mode: 'flat', activation: 'passive', visibility: 'revealed' }] } : undefined };
  actor.items = [item];
  const state = getAttributeRebirthState(actor, attribute, cfg);
  assert.equal(state.effectiveProgress, 103);
  assert.equal(state.value, 100);
  assert.equal(state.readyToRebirth, true, 'ready state must match the visible cap');
  assert.equal((await rebirthAttribute(actor, 'str', { ask: false })).after, 1);
  assert.equal(getAttributeBaseProgress(actor, attribute), 99, 'bonus points were not converted to investment');
  assert.equal(getAttributePoints(actor, cfg), 0);
  assert.equal(getAttributeRebirthState(actor, attribute, cfg).activeRebirths, 1);
  assert.equal(await rebirthAttribute(actor, 'str', { ask: false }), false, 'same tier cannot be claimed twice');
  actor.items = [];
  const withoutItem = getAttributeRebirthState(actor, attribute, cfg);
  assert.equal(withoutItem.activeRebirths, 0, 'borrowed rank becomes inactive when its bonus disappears');
  assert.equal(withoutItem.inactiveRebirths, 1);
  actor.items = [item];
  assert.equal(getAttributeRebirthState(actor, attribute, cfg).activeRebirths, 1);
});

test('a legacy null progress flag falls back to the persisted D&D score', () => {
  const actor = actorAt(null);
  actor.system.abilities.str.value = 85;
  assert.equal(getAttributeBaseProgress(actor, attribute), 85);
});

test('legacy default first rebirth color migrates to a visible tier without overriding custom palettes', () => {
  const oldColors = ['#151a24','#8b93a1','#55b86a','#4d8fe6','#9b6de3',
    '#d6a832','#e58638','#df5b67','#e85aa5','#50c8ce',
    '#69d7ff','#7e7dff','#b46bff','#ff66d1','#ff6b7a',
    '#ff9350','#ffd95a','#c7ff67','#78f0b8','#f1f4ff'];
  const old = oldColors.map((color, index) => ({color, decoration: String(index + 1)}));
  // Default saved decorations are roman numerals.
  old.forEach((entry,i) => entry.decoration = ['I','II','III','IV','V','VI','VII','VIII','IX','X',
    'XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX'][i]);
  const migrated = normalizeSheetConfig({ rebirthStyles: old });
  assert.notEqual(migrated.rebirthStyles[0].color, '#151a24');
  const custom = structuredClone(old); custom[0].color = '#4411aa';
  assert.equal(normalizeSheetConfig({ rebirthStyles: custom }).rebirthStyles[0].color, '#4411aa');
});

test('sheet cards have a reborn class and a final rarity styling import', () => {
  const hbs = fs.readFileSync(new URL('../templates/player-sheet.hbs', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../styles/148-attribute-rebirth-rarity.css', import.meta.url), 'utf8');
  const entry = fs.readFileSync(new URL('../styles/buxa.css', import.meta.url), 'utf8');
  assert.match(hbs, /\{\{#if isReborn\}\}is-reborn/);
  assert.match(css, /\.buxa-attribute-card\.is-reborn/);
  assert.match(entry, /@import url\("\.\/148-attribute-rebirth-rarity\.css"\);/);
  assert.match(entry, /149-rebirth-unlock\.css/);
  assert.match(entry, /160-scene-progression-fx\.css/);
});

test('bulk point entry never overspends past the visible cap with a +20 item bonus', async () => {
  const boosted = actorAt(60, { points: 100 });
  boosted.items = [{ id: 'charm', system: { quantity: 1 }, getFlag: (module, key) => module === id && key === 'item'
    ? { increases: [{ target: 'attribute:str:value', value: 20, mode: 'flat', activation: 'passive', visibility: 'revealed' }] } : undefined }];
  assert.equal(getAttributeRebirthState(boosted, attribute, cfg).value, 80);
  const result = await setAttributeDirect(boosted, 'str', 100);
  assert.equal(result.delta, 20, 'only spend up to effective cap');
  assert.equal(getAttributeBaseProgress(boosted, attribute), 80);
  assert.equal(getAttributePoints(boosted, cfg), 80);
  assert.equal(getAttributeRebirthState(boosted, attribute, cfg).readyToRebirth, true);
  assert.equal((await rebirthAttribute(boosted, 'str', { ask: false })).after, 1);
  assert.equal(getAttributeRebirthState(boosted, attribute, cfg).value, 0);
  assert.equal(getAttributePoints(boosted, cfg), 80);
});

test('a visible 100 at 80 invested allows rebirth with zero points remaining', async () => {
  const boosted = actorAt(80, { points: 0 });
  boosted.items = [{ id: 'charm', system: { quantity: 1 }, getFlag: (module, key) => module === id && key === 'item'
    ? { increases: [{ target: 'attribute:str:value', value: 20, mode: 'flat', activation: 'passive', visibility: 'revealed' }] } : undefined }];
  assert.equal(getAttributeRebirthState(boosted, attribute, cfg).value, 100);
  assert.equal(getAttributeRebirthState(boosted, attribute, cfg).readyToRebirth, true);
  assert.equal(await addAttributePoints(boosted, 'str', 10), false, 'no points can be spent over a displayed cap');
  assert.equal((await rebirthAttribute(boosted, 'str', { ask: false })).after, 1);
  assert.equal(getAttributeBaseProgress(boosted, attribute), 80);
  assert.equal(getAttributePoints(boosted, cfg), 0);
  assert.equal(getAttributeRebirthState(boosted, attribute, cfg).value, 0);
  assert.equal(getAttributeRebirthState(boosted, attribute, cfg).activeRebirths, 1);
});

test('attribute popup adds the entered amount on repeated uses, with one atomic update each', async () => {
  const actor = actorAt(0, { points: 55 });
  assert.equal((await addAttributePoints(actor, 'str', 10)).delta, 10);
  assert.equal((await addAttributePoints(actor, 'str', 10)).delta, 10);
  assert.equal(getAttributeBaseProgress(actor, attribute), 20);
  assert.equal(getAttributePoints(actor, cfg), 35);
  assert.equal(actor.updates.length, 2);
  assert.equal(await addAttributePoints(actor, 'str', 0), false);
  assert.equal(await addAttributePoints(actor, 'str', -10), false);
  assert.equal(await addAttributePoints(actor, 'str', 1.25), false);
  assert.equal(getAttributeBaseProgress(actor, attribute), 20);
});

test('bulk add is capped by item-adjusted score and never consumes hidden extra points', async () => {
  const actor = actorAt(60, { points: 200 });
  actor.items = [{ id: 'charm', system: { quantity: 1 }, getFlag: (module, key) => module === id && key === 'item'
    ? { increases: [{ target: 'attribute:str:value', value: 20, mode: 'flat', activation: 'passive', visibility: 'revealed' }] } : undefined }];
  assert.equal((await addAttributePoints(actor, 'str', 80)).delta, 20);
  assert.equal(getAttributeBaseProgress(actor, attribute), 80);
  assert.equal(getAttributePoints(actor, cfg), 180);
  assert.equal(getAttributeRebirthState(actor, attribute, cfg).value, 100);
  assert.equal(await addAttributePoints(actor, 'str', 10), false);
  assert.equal(getAttributePoints(actor, cfg), 180);
});

test('percent-based item bonuses reach rebirth cap without a soft lock or excess spending', async () => {
  const actor = actorAt(80, { points: 100 });
  actor.items = [{ id: 'charm', system: { quantity: 1 }, getFlag: (module, key) => module === id && key === 'item'
    ? { increases: [{ target: 'attribute:str:value', value: 20, mode: 'percent', activation: 'passive', visibility: 'revealed' }] } : undefined }];
  assert.equal(getAttributeRebirthState(actor, attribute, cfg).value, 96);
  assert.equal((await addAttributePoints(actor, 'str', 15)).delta, 4);
  assert.equal(getAttributeBaseProgress(actor, attribute), 84);
  assert.equal(getAttributePoints(actor, cfg), 96);
  assert.equal(getAttributeRebirthState(actor, attribute, cfg).readyToRebirth, true);
  assert.equal(await addAttributePoints(actor, 'str', 10), false);
  assert.equal(getAttributePoints(actor, cfg), 96);
});

test('attribute popup is additive and opens with an empty valid number field', () => {
  const markup = fs.readFileSync(new URL('../templates/attribute-setter.hbs', import.meta.url), 'utf8');
  const sheet = fs.readFileSync(new URL('../scripts/apps/player-sheet.js', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../styles/160-scene-progression-fx.css', import.meta.url), 'utf8');
  assert.match(markup, /POINTS TO ADD/);
  assert.match(markup, /name="value" placeholder="Enter amount" required autofocus/);
  assert.doesNotMatch(markup, /value="\{\{current\}\}"/);
  assert.match(sheet, /addAttributePoints\(this.actor, attributeId, amount\)/);
  assert.match(css, /is-updated .buxa-celebration-svg/);
});
