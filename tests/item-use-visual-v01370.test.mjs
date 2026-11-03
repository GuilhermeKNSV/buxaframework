import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('exhausted items keep their art unobstructed and do not show a dead Use Item button', () => {
  const sheet = source('templates/item-sheet.hbs');
  const css = source('styles/153-item-use-presentation.css');
  assert.match(sheet, /buxa-item-hero-art/);
  assert.doesNotMatch(css, /\.buxa-item-hero-art\s*:\s*:?(after|before)/);
  assert.doesNotMatch(css, /content:\s*["']🔒/);
  assert.match(sheet, /\{\{#if itemUse\.exhausted\}\}[\s\S]*?buxa-item-use-action-note[\s\S]*?\{\{else\}\}[\s\S]*?data-use-item-standalone/);
  assert.match(sheet, /data-use-item-standalone/);
  assert.match(css, /\.buxa-item-use-button:focus-visible/);
});

test('uses/resources are rarity-led unboxed effects with a discreet inline action', () => {
  const css = source('styles/153-item-use-presentation.css');
  const markup = source('templates/item-sheet.hbs');
  const hover = source('scripts/apps/item-tooltip.js');
  assert.match(css, /\.buxa-item-sheet \.buxa-item-use-status,[\s\S]*?border:0;[\s\S]*?border-top:/);
  assert.match(css, /\.buxa-item-sheet \.buxa-item-use-button\{[\s\S]*?width:auto;[\s\S]*?border:0;/);
  // v0.15 intentionally presents a single readable effect description rather
  // than a configuration-style split amount/label. Numeric amounts must still
  // come from the same calculated Item Use view, not hardcoded template text.
  assert.match(markup, /\{\{description\}\}/);
  assert.match(hover, /description\.textContent=effect\.description/);
  assert.match(hover, /heading\.append\(title,rule\)/);
  assert.doesNotMatch(source('styles/152-item-use.css'), /buxa-item-exhausted::after\s*\{/);
});
