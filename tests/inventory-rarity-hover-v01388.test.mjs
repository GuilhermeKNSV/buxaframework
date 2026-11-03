import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const hover = source('../styles/162-inventory-rarity-hover.css');
const entry = source('../styles/buxa.css');
const sheet = source('../templates/player-sheet.hbs');

test('the rarity hover layer loads last, after storage, decoration and drag rules', () => {
  assert.match(entry, /@import url\("\.\/162-inventory-rarity-hover\.css"\);/);
  assert.ok(entry.indexOf('162-inventory-rarity-hover.css') > entry.indexOf('140-complex-shape-decoration.css'));
  assert.ok(entry.indexOf('162-inventory-rarity-hover.css') > entry.indexOf('142-item-storage.css'));
});

test('Simple inventory and one-slot storage hover use the actual item rarity, not fixed rarity tiers', () => {
  assert.match(hover, /\.buxa-inventory-grid/);
  assert.match(hover, /\.buxa-storage-grid:not\(\.is-complex\)/);
  assert.match(hover, /\.buxa-inventory-overflow/);
  assert.match(hover, /var\(--buxa-rarity-color/);
  assert.match(hover, /:not\(\.buxa-complex-item\):not\(\.is-dragging\):hover/);
  assert.match(hover, /transform: none !important/);
  assert.match(sheet, /class="buxa-inventory-item \{\{item\.rarityClass\}\}/);
});

test('Complex inventory and storage hover enhance the real SVG perimeter, not a rectangle', () => {
  assert.match(hover, /\.buxa-complex-board/);
  assert.match(hover, /\.buxa-storage-grid\.is-complex/);
  assert.match(hover, /\.is-rarity-hovered:not\(\.is-dragging\) > \.buxa-complex-decoration/);
  assert.match(hover, /\.buxa-complex-outline/);
  assert.match(hover, /drop-shadow\(0 0 4px var\(--buxa-rarity-color/);
  assert.doesNotMatch(hover, /\.buxa-complex-piece:hover\s*\{[^}]*border:/s);
  assert.match(sheet, /class="buxa-complex-decoration"/);
});

test('hover feedback adds no pointer handlers, respects active drag and reduced motion', () => {
  assert.match(hover, /body:not\(\.buxa-inventory-pointer-dragging\)/);
  assert.match(hover, /:not\(\.is-dragging\)/);
  assert.match(hover, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(hover, /pointer-events:\s*auto/);
});
