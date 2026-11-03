/* Item dice: fixed and attribute dice are alternative roll sources.
 * Run: node --experimental-default-type=module --test tests/*.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const MODULE_ID = 'buxaframework';
globalThis.game = {
  system: { id: 'dnd5e' },
  i18n: { lang: 'en' },
  user: { id: 'gm', isGM: true, isActiveGM: true }
};
globalThis.Hooks = { callAll() {} };
globalThis.foundry = {
  utils: {
    deepClone: structuredClone,
    getProperty: (obj, path) => String(path).split('.').reduce((value, key) => value?.[key], obj),
    randomID: () => 'test',
    escapeHTML: (value) => String(value),
    equals: (a, b) => JSON.stringify(a) === JSON.stringify(b)
  }, dice: {}, documents: {}
};

const { DEFAULT_SHEET_CONFIG } = await import('../scripts/core/constants.js');
const { normalizeItemDice } = await import('../scripts/core/item-dice-config.js');
const { resolveItemDice, rollItemDice } = await import('../scripts/core/item-dice.js');

const config = () => {
  const result = structuredClone(DEFAULT_SHEET_CONFIG);
  result.attributes.entries = [{ id: 'str', label: 'Strength', rebirth: { enabled: false } }];
  return result;
};
const owner = () => ({ id: 'actor', documentName: 'Actor', isOwner: true,
  items: [], getFlag: () => undefined });
const makeItem = (actor, rules) => ({ id: 'axe', name: 'Axe', parent: actor,
  getFlag: (module, key) => module === MODULE_ID && key === 'item' ? rules : undefined });
const entry = (overrides = {}) => normalizeItemDice([{ id: 'damage', label: 'Damage',
  count: 4, faces: 6, flat: 3, showRange: true,
  attributeDice: { enabled: false, attributeId: 'str', faces: 20 },
  ...overrides }])[0];

test('fixed source ignores configured attribute dice even when an attribute is selected', () => {
  const a = owner();
  const roll = resolveItemDice(makeItem(a), entry(), { actor: a, config: config() });
  assert.equal(roll.formula, '4d6 + 3');
  assert.equal(roll.displayFormula, '4d6 + 3');
  assert.equal(roll.rangeText, '3 - 27');
  assert.equal(roll.useAttributeDice, false);
  assert.equal(roll.attributeCount, 0);
});

test('attribute source replaces fixed dice and preserves optional flat bonus', () => {
  const a = owner();
  const input = entry({ attributeDice: { enabled: true, attributeId: 'str', faces: 20 } });
  const roll = resolveItemDice(makeItem(a), input, { actor: a, config: config() });
  assert.equal(roll.formula, '1d20 + 3');
  assert.equal(roll.displayFormula, '1d20 + 3');
  assert.equal(roll.rangeText, '3 - 23');
  assert.equal(roll.displayText, '3 - 23');
  assert.equal(roll.baseCount, 0);
  assert.equal(roll.attributeCount, 1);
  assert.equal(roll.useAttributeDice, true);
  assert.equal(roll.sourceValid, true);
  // The stored fixed-dice numbers are not erased by source switching.
  assert.equal(input.count, 4);
  assert.equal(input.faces, 6);
});

test('attribute dice respect advantage rather than adding fixed dice', () => {
  const a = owner();
  const dice = entry({ rollMode: 'advantage', flat: 0,
    attributeDice: { enabled: true, attributeId: 'str', faces: 20 } });
  const roll = resolveItemDice(makeItem(a), dice, { actor: a, config: config() });
  assert.equal(roll.formula, '2d20kh1');
  assert.equal(roll.rangeText, '0 - 20');
});

test('unowned item previews base attribute dice with dice notation, not stored fixed dice', () => {
  const dice = entry({ showRange: true,
    attributeDice: { enabled: true, attributeId: 'str', faces: 12 } });
  const roll = resolveItemDice(makeItem(null), dice, { actor: null, config: config() });
  assert.equal(roll.displayText, '1d12 + 3');
  assert.doesNotMatch(roll.displayText, /4d6/);
});

test('missing attribute source is invalid and never falls back to fixed dice', () => {
  const a = owner();
  const dice = entry({ attributeDice: { enabled: true, attributeId: 'deleted', faces: 12 } });
  const roll = resolveItemDice(makeItem(a), dice, { actor: a, config: config() });
  assert.equal(roll.sourceValid, false);
  assert.equal(roll.useAttributeDice, true);
  assert.equal(roll.baseCount, 0);
  assert.equal(roll.displayText, '?d12 + 3');
});

test('chat roll for selected attribute source only rolls attribute dice', async () => {
  const a = owner();
  const dice = entry({ attributeDice: { enabled: true, attributeId: 'str', faces: 12 } });
  const item = makeItem(a, { dice: [dice] });
  const sent = [];
  globalThis.CONST = { CHAT_MESSAGE_STYLES: { ROLL: 5 } };
  globalThis.foundry.dice.Roll = class {
    constructor(formula) { this.formula = formula; this.total = 5; }
    async evaluate() { return this; }
    toJSON() { return { formula: this.formula }; }
  };
  globalThis.foundry.documents.ChatMessage = {
    getSpeaker: () => ({ alias: 'Tester' }),
    applyMode: (message) => message,
    create: async (message) => { sent.push(message); }
  };
  assert.equal(await rollItemDice(item, 'damage', { actor: a, config: config() }), true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].rolls[0].formula, '1d12 + 3');
});

test('existing and new editor rows expose mutually exclusive source options', () => {
  const hbs = fs.readFileSync(new URL('../templates/item-config.hbs', import.meta.url), 'utf8');
  for (const marker of ['data-item-dice-source-option="fixed"',
    'data-item-dice-source-option="attribute"', 'data-item-dice-attribute-enabled',
    'data-item-dice-fixed-wrap']) {
    assert.equal(hbs.split(marker).length - 1, 2, marker);
  }
  assert.doesNotMatch(hbs, /Add dice based on an attribute's value/);
});

test('attribute source dynamically uses rebirth-derived dice count, without fixed dice', () => {
  const cfg = config();
  cfg.attributes.entries[0].rebirth = { enabled: true, maxPoints: 100, gainDieEveryRebirths: 1 };
  const a = owner();
  a.getFlag = (module, key) => {
    if (module !== MODULE_ID) return undefined;
    if (key === 'attributes.str.rebirths') return 2;
    if (key === 'attributes.str.progress') return 240;
    return undefined;
  };
  const dice = entry({ flat: 2, attributeDice: { enabled: true, attributeId: 'str', faces: 20 } });
  const roll = resolveItemDice(makeItem(a), dice, { actor: a, config: cfg });
  assert.equal(roll.attributeCount, 3);
  assert.equal(roll.formula, '3d20 + 2');
  assert.equal(roll.rangeText, '2 - 62');
});

test('editor summary displays the selected attribute source rather than fixed dice', async () => {
  const { itemDiceSummary } = await import('../scripts/apps/item-rule-editor.js');
  const fields = {
    'data-item-dice-count': { value: '4' },
    'data-item-dice-faces': { value: '6' },
    'data-item-dice-attribute-enabled': { checked: true },
    'data-item-dice-attribute-id': { selectedOptions: [{ textContent: 'Strength' }] },
    'data-item-dice-attribute-faces': { value: '20' },
    'data-item-dice-flat': { value: '3' },
    'data-item-dice-roll-mode': { selectedOptions: [{ textContent: 'Normal' }] },
    'data-item-dice-modifier': { selectedOptions: [{ value: 'none:' }] }
  };
  const row = { querySelector: (selector) => fields[selector.slice(1, -1)] ?? null };
  assert.equal(itemDiceSummary(row), '1d20 + 3  ·  Strength source  ·  Normal');
  fields['data-item-dice-attribute-enabled'].checked = false;
  assert.equal(itemDiceSummary(row), '4d6 + 3  ·  Normal');
});
