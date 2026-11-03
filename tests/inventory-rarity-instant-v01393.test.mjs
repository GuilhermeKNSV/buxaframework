import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles/162-inventory-rarity-hover.css', import.meta.url), 'utf8');
const entry = readFileSync(new URL('../styles/buxa.css', import.meta.url), 'utf8');
const core = readFileSync(new URL('../scripts/core/item-config.js', import.meta.url), 'utf8');

test('occupied inventory and equipment slots do not tween between spectrum and hover border colors', () => {
  assert.match(css, /\.buxa :is\(\.buxa-inventory-grid, \.buxa-equipment-board\)\s+:is\(\.buxa-inventory-slot, \.buxa-equipment-slot\)\.has-item\s*\{\s*transition:\s*none !important;/);
  assert.match(css, /\.buxa-inventory-slot\.has-item\.is-rarity-spectrum:hover\s*\{\s*border-color:\s*var\(--buxa-rarity-color/);
});

test('Simple storage and inventory hover colors do not interpolate previous box-shadow hues', () => {
  assert.match(css, /\.buxa-inventory-item:not\(\.buxa-complex-item\)\s*\{[\s\S]*?transition:\s*filter 125ms ease-out !important;/);
  assert.match(css, /\.buxa-storage-grid:not\(\.is-complex\) \.buxa-inventory-item,[\s\S]*?transition: filter 125ms ease-out !important;/);
  assert.doesNotMatch(css, /transition:\s*filter 125ms ease-out, box-shadow/);
});

test('Complex item perimeter uses instant rarity-colored hover without resetting its Spectrum animation', () => {
  assert.match(css, /\.buxa-complex-item > \.buxa-complex-decoration\s*\{\s*transition:\s*none !important;/);
  assert.match(css, /\.buxa-complex-item\.is-rarity-hovered:not\(\.is-dragging\) > \.buxa-complex-decoration\s*\{[\s\S]*?drop-shadow\(0 0 4px var\(--buxa-rarity-color/);
  assert.doesNotMatch(css, /is-rarity-hovered[^\n]*\{[^}]*animation:\s*none/s);
});

test('hover fix remains the final rarity paint layer and does not replace configured colors', () => {
  assert.ok(entry.indexOf('162-inventory-rarity-hover.css') > entry.indexOf('140-complex-shape-decoration.css'));
  assert.match(core, /style: `--buxa-rarity-color:\$\{safe\.color\}/);
  assert.match(css, /var\(--buxa-rarity-color/);
});
