import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

test('every exhausted inventory context shows the same actual SVG lock, without a font glyph', () => {
  const tpl = read('templates/player-sheet.hbs');
  const style = read('styles/152-item-use.css');
  assert.equal((tpl.match(/class="buxa-item-use-lock"/g)||[]).length, 6);
  assert.equal((tpl.match(/\{\{#if (?:item\.)?exhausted\}\}<span class="buxa-item-use-lock"/g)||[]).length, 6);
  assert.equal((tpl.match(/<svg viewBox="0 0 16 18"/g)||[]).length, 6);
  assert.match(style, /\.buxa-inventory-item \.buxa-item-use-lock\s*\{/);
  assert.match(style, /pointer-events:none/);
  assert.match(style, /background:none/);
  assert.doesNotMatch(style, /buxa-item-exhausted::after\s*\{/);
  assert.doesNotMatch(style, /content:\s*['"]\\f023/);
  assert.match(style, /\.buxa-inventory-item\.buxa-item-exhausted\s*\{/);
});
