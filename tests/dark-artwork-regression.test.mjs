import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (name) => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
test('Figma surfaces use the darker navy palette throughout the module', () => {
  const tokens=read('styles/122-design-tokens.css');
  const sheets=read('styles/123-figma-sheet-ui.css');
  const editors=read('styles/124-figma-editor-ui.css');
  const directory=read('styles/125-figma-directory-popovers.css');
  for (const layer of [tokens,sheets,editors,directory]) {
    assert.ok(layer.includes('#070b12'), 'dark main background');
    assert.ok(layer.includes('#0e1623'), 'dark secondary surface');
  }
  assert.match(tokens,/--buxa-bg-0:#070b12/);
});
test('item artwork is free of an opaque hero tile and connects to the background-removal helper',()=>{
  const sheet=read('styles/123-figma-sheet-ui.css');
  const js=read('scripts/apps/item-sheet.js');
  assert.match(sheet,/\.buxa-item-hero-art\s*\{[^}]*background:transparent\s*!important/);
  assert.match(sheet,/\.buxa-item-hero-art \.buxa-item-hero-icon\s*\{[^}]*object-fit:contain/);
  assert.match(js,/enhanceItemSheetArtwork\(this\.element\)/);
});
