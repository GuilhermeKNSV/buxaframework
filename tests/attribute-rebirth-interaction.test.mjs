import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { activateAttributeRebirth, attachRebirthBurst } from '../scripts/apps/attribute-rebirth-transition.js';

function gate() {
  const cardClasses = new Set();
  const attrs = new Map();
  const card = { classList: {
    add: (...values) => values.forEach(value => cardClasses.add(value)),
    remove: (...values) => values.forEach(value => cardClasses.delete(value)),
    contains: value => cardClasses.has(value)
  }};
  return { button: {
    dataset: {}, disabled: false, closest: () => card,
    setAttribute: (key,value) => attrs.set(key,value), removeAttribute: key => attrs.delete(key)
  }, card, cardClasses, attrs };
}

test('rebirth gate covers the entire attribute bar and preserves keyboard accessibility', () => {
  const template = fs.readFileSync(new URL('../templates/player-sheet.hbs', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../styles/149-rebirth-unlock.css', import.meta.url), 'utf8');
  const code = fs.readFileSync(new URL('../scripts/apps/player-sheet.js', import.meta.url), 'utf8');
  assert.match(template, /class="buxa-rebirth-gate [^"]*"[^>]*data-action="attributeRebirth"/);
  assert.match(template, /aria-label="Rebirth/);
  assert.doesNotMatch(template, /class="buxa-attr-tool buxa-rebirth-tool"/);
  assert.match(css, /\.buxa-rebirth-gate\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;/s);
  assert.match(css, /grid-template-columns:\s*30px minmax\(78px, 1fr\) 30px/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(code, /activateAttributeRebirth\(button,/);
});

test('cancelling the confirmation never starts the charge or claims points', async () => {
  const { button, cardClasses, attrs } = gate();
  let saves = 0;
  const result = await activateAttributeRebirth(button, {
    confirm: async () => false, commit: async () => { saves += 1; }, reveal: async () => {}, chargeDuration: 0
  });
  assert.equal(result, false);
  assert.equal(saves, 0);
  assert.equal(cardClasses.has('is-rebirth-charging'), false);
  assert.equal(button.disabled, false);
  assert.equal(attrs.has('aria-busy'), false);
});

test('a successful rebirth charges before saving and then reveals its new tier', async () => {
  const { button, cardClasses } = gate();
  const phases = [];
  const result = await activateAttributeRebirth(button, {
    confirm: async () => { phases.push('confirmed'); return true; },
    commit: async () => {
      assert.equal(cardClasses.has('is-rebirth-charging'), true);
      phases.push('save');
      return { after: 4 };
    },
    reveal: async (tier) => { assert.equal(tier.after, 4); phases.push('reveal'); },
    chargeDuration: 0
  });
  assert.equal(result.after, 4);
  assert.deepEqual(phases, ['confirmed', 'save', 'reveal']);
  assert.equal(button.disabled, false);
});

test('rapid second click cannot spend another rebirth while confirmation is pending', async () => {
  const { button } = gate();
  let resolveConfirm;
  const pending = new Promise(resolve => { resolveConfirm = resolve; });
  let saves = 0;
  const args = { confirm: () => pending, commit: async () => { saves++; return { after: 1 }; }, reveal: async () => {}, chargeDuration: 0 };
  const first = activateAttributeRebirth(button, args);
  const second = await activateAttributeRebirth(button, args);
  assert.equal(second, false);
  resolveConfirm(true);
  await first;
  assert.equal(saves, 1);
});

test('a failed save or failed cap check resets the gate and never shows a reveal', async () => {
  const { button, cardClasses } = gate();
  let reveals = 0;
  const args = { confirm: async () => true, commit: async () => false,
    reveal: async () => { reveals++; }, chargeDuration: 0 };
  assert.equal(await activateAttributeRebirth(button, args), false);
  assert.equal(cardClasses.has('is-rebirth-charging'), false);
  assert.equal(reveals, 0);
  await assert.rejects(activateAttributeRebirth(button, { ...args,
    commit: async () => { throw new Error('save failed'); }
  }), /save failed/);
  assert.equal(cardClasses.has('is-rebirth-charging'), false);
  assert.equal(button.disabled, false);
  assert.equal(button.dataset.buxaRebirthBusy, undefined);
});

test('a successful rebirth can attach its lock-breaking effect to the new card once', () => {
  const nodes = [];
  const document = { createElement: () => ({ className: '', innerHTML: '',
    setAttribute(name, value) { this[name] = value; } }) };
  const card = { ownerDocument: document, querySelector: (selector) => selector === '.buxa-rebirth-burst' ? nodes[0] : null,
    appendChild: node => { nodes.push(node); } };
  attachRebirthBurst(card);
  attachRebirthBurst(card);
  assert.equal(nodes.length, 1);
  assert.match(nodes[0].innerHTML, /fa-lock-open/);
  assert.equal(nodes[0].className, 'buxa-rebirth-burst');
});
