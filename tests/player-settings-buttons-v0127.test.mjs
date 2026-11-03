import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('choice controls use short labels with accessible full descriptions', () => {
  const sourceJs = source('scripts/apps/player-settings.js');
  const template = source('templates/player-settings.hbs');
  for (const [value, label] of [
    ['sao','SAO'], ['classic','Classic'], ['vertical','Vertical'],
    ['everyone','Everyone'], ['owner','Owners'], ['selected','Selected']
  ]) {
    assert.match(sourceJs, new RegExp(`value: "${value}", label: "${label}"`));
  }
  assert.match(template, /data-choice-value="\{\{value\}\}"[^>]*title="\{\{#if description\}\}/);
  assert.match(template, /data-choice-value="\{\{value\}\}"[^>]*aria-label="\{\{#if description\}\}/);
});

test('Player Settings buttons have constrained no-wrap grid cells and square corners', () => {
  const css = source('styles/143-token-resource-hud.css');
  assert.match(css, /\.buxa-player-settings-app \.buxa-ps-segmented\s*\{[^}]*display:grid/s);
  assert.match(css, /\.buxa-player-settings-app \.buxa-ps-segmented\s*>\s*button\s*\{[^}]*min-width:0 !important/s);
  assert.match(css, /\.buxa-player-settings-app \.buxa-ps-segmented\s*>\s*button\s*\{[^}]*white-space:nowrap !important/s);
  assert.match(css, /\.buxa-player-settings-app \.buxa-ps-segmented\s*>\s*button\s*\{[^}]*overflow:hidden/s);
  assert.match(css, /\.buxa-player-settings-app \.buxa-ps-surface,[\s\S]*\.buxa-resource-track-toggle\s*\{ border-radius:0 !important; \}/);
});
