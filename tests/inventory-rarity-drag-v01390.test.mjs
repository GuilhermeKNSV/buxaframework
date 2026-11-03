import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyDragRarityFeedback } from '../scripts/apps/inventory-rarity-hover.js';

function fakeStyle(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    setProperty(name, value) { values.set(name, String(value)); },
    getPropertyValue(name) { return values.get(name) || ''; }
  };
}
function dragGhost(color, inline = false) {
  const classes = new Set();
  const ghost = { style: fakeStyle(), classList: { add(name) { classes.add(name); } } };
  const item = { style: fakeStyle(inline ? { '--buxa-rarity-color': color } : {}) };
  const view = inline ? null : { getComputedStyle: () => fakeStyle({
    '--buxa-rarity-color': color,
    '--buxa-rarity-accent': color,
    '--buxa-rarity-bg-opacity': '.75',
    '--buxa-rarity-bg-brightness': '1.2'
  }) };
  applyDragRarityFeedback(ghost, item, view);
  return { ghost, classes };
}

test('moving previews begin with the actual item color, without using red or a default hue first', () => {
  for (const color of ['#42b7e9', '#b16bdf', '#eac85a', '#54d59c', '#d25c7e']) {
    const { ghost, classes } = dragGhost(color);
    assert.equal(ghost.style.getPropertyValue('--buxa-rarity-color'), color);
    assert.equal(ghost.style.getPropertyValue('--buxa-rarity-accent'), color);
    assert.equal(ghost.style.getPropertyValue('--buxa-rarity-bg-opacity'), '.75');
    assert.equal(ghost.style.getPropertyValue('--buxa-rarity-bg-brightness'), '1.2');
    assert.ok(classes.has('is-rarity-dragging'));
  }
});

test('simple-storage/equipment ghosts fall back to the explicit item rarity without a computed-style API', () => {
  const { ghost } = dragGhost('#703abc', true);
  assert.equal(ghost.style.getPropertyValue('--buxa-rarity-color'), '#703abc');
  assert.equal(ghost.style.getPropertyValue('--buxa-rarity-accent'), '');
});

test('normal drag creates the rarity ghost before insertion and reshaping never removes its rarity', () => {
  const controls = readFileSync(new URL('../scripts/apps/inventory-controls.js', import.meta.url), 'utf8');
  const occupancy = readFileSync(new URL('../scripts/apps/inventory-occupancy-ghost.js', import.meta.url), 'utf8');
  const equipment = readFileSync(new URL('../scripts/apps/equipment-drag-preview.js', import.meta.url), 'utf8');
  const ghost = readFileSync(new URL('../scripts/apps/inventory-drag-motion.js', import.meta.url), 'utf8');
  assert.match(controls, /makeDragGhost\(element, root,/);
  assert.match(ghost, /applyDragRarityFeedback\(ghost, element, doc\.defaultView\);\s*doc\.body\.appendChild\(ghost\)/);
  assert.doesNotMatch(occupancy, /classList\.remove\([^)]*is-rarity-dragging/);
  assert.doesNotMatch(equipment, /classList\.remove\([^)]*is-rarity-dragging/);
});

test('drag highlight survives simple and complex modes, but still shows genuinely invalid drops', () => {
  const css = readFileSync(new URL('../styles/162-inventory-rarity-hover.css', import.meta.url), 'utf8');
  assert.match(css, /\.buxa-inventory-drag-ghost\.is-rarity-dragging:not\(\.is-complex-ghost\):not\(\.is-invalid\)/);
  assert.match(css, /\.buxa-inventory-drag-ghost\.is-complex-ghost\.is-rarity-dragging:not\(\.is-invalid\)/);
  // Do not restart the hue animation at its red 0% keyframe on each hover.
  assert.doesNotMatch(css, /is-rarity-spectrum\.is-rarity-hovered > \.buxa-complex-decoration\s*\{\s*animation:\s*none/);
  assert.match(css, /\.buxa-inventory-slot\.has-item\.is-rarity-spectrum:hover\s*\{[\s\S]*?border-color:\s*var\(--buxa-rarity-color/);
  assert.match(css, /\.buxa-inventory-slot\.has-item\.is-rarity-spectrum:hover/);
  assert.match(css, /--buxa-rarity-color/);
});
