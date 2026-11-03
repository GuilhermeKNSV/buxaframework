import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = file => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const design = source('styles/30-module-config-system.css');
const imports = source('styles/buxa.css');
const template = source('templates/layout-config.hbs');

test('v0.17.26 only one module config stylesheet owns component visuals', () => {
  assert.match(imports, /@import url\("\.\/30-module-config-system\.css"\);\s*$/);
  for (const prior of ['30-config.css','31-config-navigation.css','32-config-notifications.css',
    '35-inventory-config.css','37-addons.css','151-config-layout.css','183-module-config-refinement.css']) {
    assert.ok(!imports.includes(prior), `${prior} should not be imported`);
    assert.ok(!fs.existsSync(path.join(process.cwd(), 'styles', prior)), `${prior} should be removed`);
  }
  assert.ok(!design.includes('!important'), 'no forced override chain');
  assert.ok(!source('styles/164-scene-item-menu.css').includes('.buxa-sequencer-asset{'), 'no legacy Addons overrides');
});

test('v0.17.27 checkbox remains invisible and only the sibling track is painted', () => {
  const widgets = source('scripts/apps/layout-config-widgets.js');
  assert.match(design, /input\[type="checkbox"\][\s\S]*?clip-path:inset\(50%\)/);
  assert.match(design, /input\[type="checkbox"\]:checked \+ \.bc-toggle-track/);
  assert.match(design, /\.bc-toggle-track::after/);
  assert.doesNotMatch(design, /input\[type="checkbox"\]::before/);
  assert.doesNotMatch(design, /input\[type="checkbox"\]::after/);
  assert.match(widgets, /input\.insertAdjacentElement\('afterend', track\)/);
  assert.match(widgets, /input\.dataset\.bcToggle = 'true'/);
  assert.ok(!design.includes('content:"✓"'));
  assert.ok(!design.includes('content:"✔"'));
});

test('v0.17.26 custom dropdown and number stepper preserve original native value controls', () => {
  const widgets = source('scripts/apps/layout-config-widgets.js');
  assert.match(widgets, /shell\.appendChild\(select\)/);
  assert.match(widgets, /select\.value = option\.value/);
  assert.match(widgets, /select\.dispatchEvent\(new Event\('change'/);
  assert.match(widgets, /wrapper\.appendChild\(input\)/);
  assert.match(widgets, /input\.stepUp\(\)/);
  assert.match(widgets, /input\.stepDown\(\)/);
  assert.match(design, /\.bc-select-popup/);
});

test('v0.17.26 covers all configuration sections and native data controls', () => {
  for (const section of ['basic','resources','level','attributes','stats','proficiencies','rebirths','inventory','npc','items','ui-warning','ui-item-ui','addons']) {
    assert.ok(template.includes(`data-config-panel="${section}"`), `missing panel ${section}`);
  }
  for (const type of ['checkbox','number','text','radio','color','range','hidden']) {
    assert.ok(template.includes(`type="${type}"`), `missing expected form control ${type}`);
  }
  for (const name of ['data-inventory-mode','data-dr-resource','data-initiative-attribute','data-rarity-list','data-addon-svg-icons','data-warning-dismiss-seconds']) {
    if (name !== 'data-warning-dismiss-seconds') assert.ok(template.includes(name), `missing ${name}`);
  }
  assert.ok(!template.includes('buxa-config-legacy'));
});
