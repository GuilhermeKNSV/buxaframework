import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const base = new URL('../',import.meta.url);
const read = p => readFileSync(new URL(p,base),'utf8');
const entry=read('styles/buxa.css');
const css=read('styles/30-module-config-system.css');
const template=read('templates/layout-config.hbs');
test('Module Configuration has one active styling owner, not a layering chain',()=>{
  assert.ok(entry.trimEnd().endsWith('@import url("./30-module-config-system.css");'));
  for(const name of ['30-config','31-config-navigation','32-config-notifications','35-inventory-config','37-addons','151-config-layout','183-module-config-refinement']) {
    assert.ok(!entry.includes(`./${name}.css`));
    assert.ok(!existsSync(new URL(`styles/${name}.css`,base)));
  }
  assert.match(css,/--bc-s4:/);
  assert.match(css,/container-type:inline-size/);
  assert.doesNotMatch(css,/!important/);
});
test('Existing resource, attribute and stat serialization bindings are preserved',()=>{
  for(const key of ['data-resource-label','data-resource-start','data-resource-restore-mode','data-attribute-label','data-attribute-ability','data-attribute-modifier-every','data-dr-enabled','data-dr-resource','data-initiative-enabled','data-initiative-attribute','data-proficiencies-enabled','data-proficiency-label','data-proficiency-attribute'])
    assert.ok(template.includes(key),key);
});
test('Responsive configuration layouts and shared toggle/slider/dropdown components exist',()=>{
  for(const key of ['.bc-select-trigger','.bc-toggle-track::after','input[type="range"]::-webkit-slider-thumb','.buxa-config-resource-main','.buxa-config-advanced','@container (max-width:610px)'])
    assert.ok(css.includes(key),key);
});
