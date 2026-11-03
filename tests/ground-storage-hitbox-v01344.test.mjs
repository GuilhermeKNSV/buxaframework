import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// The Actor inventory intentionally disables direct complex-item pointer
// input because its board routes hits through the cell occupancy map. The
// floating ground container DOES NOT install that listener: every actual
// occupied cell must be independently pointer-interactive.
test('ground chest restores pointer input exclusively on occupied pieces', () => {
  const style=fs.readFileSync(new URL('../styles/145-physical-items.css',import.meta.url),'utf8');
  const actorStyle=fs.readFileSync(new URL('../styles/132-complex-artwork-editor.css',import.meta.url),'utf8');
  assert.match(actorStyle,/\.buxa \.buxa-storage-grid\.is-complex > \.buxa-complex-item[\s\S]*?pointer-events: none !important/);
  assert.match(style,/\.buxa-ground-container-window\.buxa \.buxa-storage-grid\.is-complex > \.buxa-complex-item > \.buxa-complex-piece\s*\{\s*pointer-events:\s*auto\s*!important/);
  assert.doesNotMatch(style,/\.buxa-ground-container-window\.buxa \.buxa-storage-grid\.is-complex > \.buxa-complex-item\s*\{\s*pointer-events:\s*auto\s*!important/);
});
