import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bindComplexRarityHover, clearComplexRarityHover } from '../scripts/apps/inventory-rarity-hover.js';

function item(id) {
  const classes = new Set();
  return {
    dataset: { itemId: id }, classes,
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); }
    }
  };
}
function setup(storage = false) {
  const left = item('sword'), right = item('bow');
  const handlers = new Map();
  const bodyClasses = new Set();
  const board = {
    ownerDocument: { body: { classList: { contains: name => bodyClasses.has(name) } } },
    matches: selector => storage && selector === '[data-storage-board]',
    contains: node => Boolean(node?.belongsToBoard),
    querySelectorAll: () => [left, right],
    addEventListener: (name, fn) => handlers.set(name, fn),
  };
  const selectors = storage ? '[data-storage-index]' : '[data-inventory-index]';
  const cell = id => ({ belongsToBoard:true, dataset: { hitItemId: id }, closest: selector => selector === selectors ? cellNode : null });
  let cellNode;
  const move = (name, id, pointerType='mouse') => {
    cellNode = cell(id);
    handlers.get(name)?.({ target:cellNode, pointerType, clientX:10, clientY:10 });
  };
  let fallbacks = 0;
  bindComplexRarityHover(board, () => { fallbacks++; return { itemId:'sword' }; });
  return { left, right, board, move, handlers, bodyClasses, get fallbacks() { return fallbacks; } };
}

for (const storage of [false,true]) {
  test(`Complex ${storage ? 'external storage' : 'inventory'} highlights occupied cells and clears holes`, () => {
    const h = setup(storage);
    h.move('pointerover', 'sword');
    assert.equal(h.left.classes.has('is-rarity-hovered'), true);
    assert.equal(h.right.classes.has('is-rarity-hovered'), false);
    h.move('pointerover','bow');
    assert.equal(h.left.classes.has('is-rarity-hovered'), false);
    assert.equal(h.right.classes.has('is-rarity-hovered'), true);
    h.move('pointerover', '');
    assert.equal(h.right.classes.has('is-rarity-hovered'), false, 'a missing or masked-out cell must not highlight its neighbor');
    assert.equal(h.fallbacks, 0, 'hit-item-id avoids expensive geometry reads on real cells');
    h.move('pointerover', 'sword');
    h.handlers.get('pointerleave')?.({});
    assert.equal(h.left.classes.has('is-rarity-hovered'), false);
  });
}

test('drag and touch never leave a stuck rarity hover; classes change only when necessary', () => {
  const h = setup();
  h.move('pointerover','sword');
  h.handlers.get('pointerdown')?.({});
  assert.equal(h.left.classes.has('is-rarity-hovered'), true, 'press alone should preserve hover until a real drag begins');
  clearComplexRarityHover(h.board);
  assert.equal(h.left.classes.has('is-rarity-hovered'), false);
  h.bodyClasses.add('buxa-inventory-pointer-dragging');
  h.move('pointerover','sword');
  assert.equal(h.left.classes.has('is-rarity-hovered'), false);
  h.bodyClasses.delete('buxa-inventory-pointer-dragging');
  h.move('pointerover','bow','touch');
  assert.equal(h.right.classes.has('is-rarity-hovered'), false);
  h.move('pointerover','bow');
  assert.equal(h.right.classes.has('is-rarity-hovered'), true);
  h.handlers.get('pointercancel')?.({});
  assert.equal(h.right.classes.has('is-rarity-hovered'), false);
});

test('transparent complex art is detected using the shared occupancy resolver', () => {
  const h=setup(true);
  const target={ closest: () => null };
  h.handlers.get('pointerover')?.({ target, pointerType:'mouse',clientX:10,clientY:10 });
  assert.equal(h.fallbacks,1);
  assert.equal(h.left.classes.has('is-rarity-hovered'),true);
});

test('actual sheet markup provides occupied hit ids and mode selectors for both inventory/storage', () => {
  const template = readFileSync(new URL('../templates/player-sheet.hbs',import.meta.url),'utf8');
  const css = readFileSync(new URL('../styles/162-inventory-rarity-hover.css',import.meta.url),'utf8');
  const binding = readFileSync(new URL('../scripts/apps/inventory-board-hit-bindings.js',import.meta.url),'utf8');
  assert.match(template,/data-hit-item-id="\{\{itemId\}\}"/);
  assert.match(template,/data-hit-item-id="\{\{hitItemId\}\}"/);
  assert.match(binding,/bindComplexRarityHover\(board, locate\)/);
  assert.match(css,/\.is-rarity-hovered/);
  assert.match(css,/\.buxa-storage-grid\.is-complex/);
  assert.match(css,/\.buxa-storage-grid:not\(\.is-complex\)/);
  assert.match(css,/var\(--buxa-rarity-color/);
});
