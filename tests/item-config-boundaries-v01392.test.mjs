import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeItemRules, normalizeItemSystemConfig } from '../scripts/core/item-config.js';

// Each case represents a distinct Foundry form/legacy-data input, not an
// independent code defect. Keep the full matrix to prevent regressions.
const disabledValues = ['false', 'FALSE', '0', 'off', 'OFF', 'no', ' No '];
const enabledValues = ['true', 'TRUE', '1', 'on', 'On', 'yes', ' YES '];
const blanks = [null, '', ' ', ' \t ', false];
const rules = [
  ['description.enabled', value => ({ description: { enabled: value } }), out => out.description.enabled],
  ['levelRequirement.enabled', value => ({ levelRequirement: { enabled: value } }), out => out.levelRequirement.enabled],
  ['equip.enabled', value => ({ equip: { enabled: value } }), out => out.equip.enabled],
  ['weight.enabled', value => ({ weight: { enabled: value } }), out => out.weight.enabled],
  ['multiple.enabled', value => ({ multiple: { enabled: value } }), out => out.multiple.enabled],
  ['typeLabel.enabled', value => ({ typeLabel: { enabled: value } }), out => out.typeLabel.enabled],
  ['equip.any', value => ({ equip: { any: value } }), out => out.equip.any],
];
for (const [name, setup, get] of rules) for (const value of disabledValues) {
  test(`item settings interpret ${name}=${JSON.stringify(value)} as disabled`, () => {
    assert.equal(get(normalizeItemRules(setup(value))), false);
  });
}
for (const field of ['nameColor', 'animated', 'ornament', 'spectrum', 'glint'])
  for (const value of disabledValues) {
    test(`rarity settings interpret ${field}=${JSON.stringify(value)} as disabled`, () => {
      assert.equal(normalizeItemSystemConfig({ rarities: [{id:'custom', [field]:value}] }).rarities[0][field], false);
    });
  }
for (const value of enabledValues) test(`item settings interpret disableLooting=${JSON.stringify(value)} as enabled`, () => {
  assert.equal(normalizeItemRules({ disableLooting:value }).disableLooting, true);
});
for (const value of blanks) {
  test(`blank level ${JSON.stringify(value)} restores level 1 default`, () => {
    assert.equal(normalizeItemRules({ levelRequirement:{level:value} }).levelRequirement.level,1);
  });
  test(`blank maxStack ${JSON.stringify(value)} restores 99 default`, () => {
    assert.equal(normalizeItemRules({ multiple:{maxStack:value} }).multiple.maxStack,99);
  });
  test(`blank background opacity ${JSON.stringify(value)} restores 100 default`, () => {
    assert.equal(normalizeItemSystemConfig({ background:{opacity:value} }).background.opacity,100);
  });
  test(`blank background brightness ${JSON.stringify(value)} restores 100 default`, () => {
    assert.equal(normalizeItemSystemConfig({ background:{brightness:value} }).background.brightness,100);
  });
}
