import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../styles/30-module-config-system.css', import.meta.url), 'utf8');
const widgets = fs.readFileSync(new URL('../scripts/apps/layout-config-widgets.js', import.meta.url), 'utf8');
const template = fs.readFileSync(new URL('../templates/layout-config.hbs', import.meta.url), 'utf8');

test('configuration style has square corners on every component including popups, knobs and switches', () => {
  assert.match(css, /--bc-r1:0px;/);
  assert.match(css, /--bc-r2:0px;/);
  assert.doesNotMatch(css, /border-radius:\s*(?:[1-9]\d*(?:\.\d+)?(?:px|em|rem|%)|50%|999px)/);
  assert.doesNotMatch(css, /!important/);
});

test('number steppers are excluded from generic buttons and cannot grow beyond their 16px cells', () => {
  assert.match(css, /button:not\(\.bc-select-trigger\):not\(\.bc-select-option\):not\(\.bc-number-step\)/);
  assert.match(css, /\.bc-number-step\s*\{[^}]*height:16px; max-height:16px;[^}]*padding:0;/);
  assert.match(css, /\.bc-number-steppers\s*\{[^}]*grid-template-columns:22px; grid-template-rows:16px 16px;/);
  assert.match(css, /\.bc-number > input\s*\{[^}]*min-width:0;/);
  assert.match(widgets, /input\.stepUp\(\)/);
  assert.match(widgets, /input\.stepDown\(\)/);
});

test('rebirth and rarity number rows reserve enough horizontal space for usable steppers', () => {
  assert.match(css, /\.buxa-config-rebirth-rule \.buxa-config-mini-grid\.three\s*\{\s*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /\.buxa-rarity-beam-opacity \.bc-number\s*\{[^}]*width:78px;/);
  for (const key of ['data-attribute-rebirth-max','data-attribute-dice-every','data-attribute-base-mod-cap','data-attribute-mod-cap-gain','data-rarity-beam-opacity-number'])
    assert.ok(template.includes(key), key);
});
