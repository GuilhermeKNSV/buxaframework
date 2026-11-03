import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateGroundChildBundle } from '../scripts/core/ground-container.js';
import { storageProviderId, buildStorageGrants } from '../scripts/core/item-storage.js';
import { wouldNestBackpackInItself } from '../scripts/core/inventory.js';
import { applyItemIncrease, removeItemIncrease } from '../scripts/core/item-effects.js';

const entry = (id, parent = 'root') => ({
  sourceId: id, providerId: parent, compartmentId: 'main', index: 0, rotation: 0,
  data: { name: id }
});

test('nested storage validator resolves a full 250-deep chain and rejects missing parent/cycles', () => {
  const chain = Array.from({ length: 250 }, (_, i) => entry(`item${i}`, i ? `item${i - 1}` : 'root'));
  assert.equal(validateGroundChildBundle(chain), true);
  assert.throws(() => validateGroundChildBundle([entry('a', 'b'), entry('b', 'a')]), /Circular/);
  assert.throws(() => validateGroundChildBundle([entry('a', 'absent')]), /missing its parent/);
  assert.throws(() => validateGroundChildBundle([entry('a'), entry('a')]), /Duplicate/);
});

test('storage provider parsing keeps colons in imported Item IDs and rejects broken compound IDs', () => {
  assert.equal(storageProviderId('import:abc:main'), 'import:abc');
  assert.equal(storageProviderId('bag:main'), 'bag');
  assert.equal(storageProviderId('broken'), null);
  assert.equal(storageProviderId(':missing'), null);
  assert.equal(storageProviderId('bag:'), null);
  const actor = { items: [{ id: 'import:abc', name: 'Backpack', flags: {
    buxaframework: { item: { storage: { slots: { external: [{ id: 'main' }] } } } }
  } }] };
  const grants = buildStorageGrants(actor,
    { 'import:abc': { area: 'inventory', index: 0 }, coin: { area: 'storage', storageId: 'import:abc:main', index: 1 } },
    {}, item => item.flags.buxaframework.item, () => false);
  assert.equal(grants.compartments[0].storageId, 'import:abc:main');
  assert.equal(wouldNestBackpackInItself({ bag: {area:'storage', storageId:'import:abc:main'} },
    'import:abc', {area:'storage', storageId:'bag:inner'}), true);
});

test('zero-multiplier item effects cannot invent an underlying permanent value', () => {
  assert.equal(applyItemIncrease(100, {flat: 4, percent: -100}), 0);
  assert.throws(() => removeItemIncrease(15, {flat: 4, percent: -100}), /reduce it by 100%/);
  assert.throws(() => removeItemIncrease(0, {flat: 4, percent: -150}), /reduce it by 100%/);
  assert.equal(removeItemIncrease(40, {flat: 5, percent: 100}), 15);
});

test('player-sheet animation identity is independent of the affected attribute/resource ID', () => {
  const source = fs.readFileSync(new URL('../scripts/apps/player-sheet.js', import.meta.url), 'utf8');
  assert.match(source, /fxToken:\s*fxId\(\)/);
  assert.match(source, /dataset\.buxaFxId\s*=\s*effect\.fxToken/);
  assert.match(source, /this\._recentFx\.length > 48/);
});

test('oversized imported Item rules fail closed before normalization could truncate data', async () => {
  const { validateItemRuleCapacity } = await import('../scripts/core/item-rule-capacity.js');
  for (const [key, maximum] of [['dice',40], ['decorations',40], ['increases',60], ['resourceEffects',32]]) {
    assert.equal(validateItemRuleCapacity({[key]: Array(maximum).fill({})}),true);
    assert.throws(() => validateItemRuleCapacity({[key]:Array(maximum+1).fill({})}),/No changes were saved/);
  }
  assert.throws(() => validateItemRuleCapacity({storage:{slots:{external:Array(13).fill({})}}}),/storage compartments/);
  const beforeGame = globalThis.game;
  try {
    globalThis.game={ user:{isGM:true} };
    const {saveItemRules}=await import('../scripts/core/item-runtime.js');
    let saves=0;
    const item={name:'Imported dice Item',img:'icon.svg',getFlag:(scope,key) =>
      scope==='buxaframework' && key==='item' ? {dice:Array(41).fill({})} : undefined,
      async update(){saves++;}};
    await assert.rejects(saveItemRules(item,{dice:[{}]},{items:{rarities:[]}}),/No changes were saved/);
    assert.equal(saves,0);
  } finally {globalThis.game=beforeGame;}
});

test('large searchable choice lists retain later options, with locale-stable folding', async () => {
  const { listItemChoices } = await import('../scripts/apps/item-rule-choice.js');
  const options = Array.from({length:300},(_,i)=>({value:`attribute:a${i}`,textContent:`ATTRIBUTE · Choice ${i}`,disabled:false,selected:false}));
  options.push({value:'attribute:istanbul',textContent:'ATTRIBUTE · İstanbul',disabled:false,selected:false});
  assert.equal(listItemChoices({options}).length,301);
  assert.equal(listItemChoices({options},'istanbul')[0]?.id,'istanbul');
  assert.equal(listItemChoices({options},'ıstanbul')[0]?.id,'istanbul');
  const source = fs.readFileSync(new URL('../scripts/apps/item-rule-choice.js',import.meta.url),'utf8');
  assert.match(source,/visibleLimit \+= MAX_RESULTS/);
  assert.match(source,/buxa-choice-more/);
});
