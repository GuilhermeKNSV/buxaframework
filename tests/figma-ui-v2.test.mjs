import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=(p)=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const entry=read('styles/buxa.css');
const tokens=read('styles/122-design-tokens.css');
const sheet=read('styles/123-figma-sheet-ui.css');
const editor=read('styles/124-figma-editor-ui.css');
const directory=read('styles/125-figma-directory-popovers.css');
const utility=read('styles/126-figma-utility-ui.css');
test('V2 loads UI layers in a deterministic order without breaking older feature styles',()=>{
  const names=['122-design-tokens.css','123-figma-sheet-ui.css','124-figma-editor-ui.css','125-figma-directory-popovers.css','126-figma-utility-ui.css'];
  const positions=names.map(n=>entry.indexOf(n));
  assert.ok(positions.every(p=>p>=0));
  assert.ok(positions.every((p,i)=>i===0||p>positions[i-1]));
  assert.ok(positions[0]>entry.indexOf('121-figma-ui-system.css'));
  assert.equal(new Set(names).size,names.length);
});
test('V2 uses square reusable tokens, scoped to Buxa rather than native Foundry windows',()=>{
  assert.match(tokens,/--buxa-radius:0px/);
  assert.match(tokens,/--buxa-v2-panel:/);
  assert.match(tokens,/\.buxa:not\(\.buxa-layout-config-app\) \.window-content/);
  assert.doesNotMatch(tokens, /(?:^|\n)\.window-header\s*\{/);
});
test('V2 covers character, inventory, item and equipment views',()=>{
  for(const selector of ['.buxa-sheet-nav','.buxa-basic-card','.buxa-inventory-grid','.buxa-inventory-slot','.buxa-item-hero','.buxa-item-sheet-scroll']){
    assert.ok(sheet.includes(selector),selector);
  }
});
test('V2 covers item configuration and utility editors, with module configuration in its own system',()=>{
  for(const selector of ['.buxa-item-config-tabs','.buxa-item-config-section','.buxa-rule-card','.buxa-equipment-slot-inspector','.buxa-asset-file']){
    assert.ok(editor.includes(selector),selector);
  }
});
test('V2 directories preserve rarity accent variables and do not force Foundry sidebar visibility',()=>{
  assert.match(directory,/var\(--buxa-card-accent/);
  assert.match(directory,/\.buxa-world-folder-card/);
  assert.doesNotMatch(directory,/\.sidebar-tab.*display:\s*(?:flex|block)\s*!important/);
  assert.match(directory,/\.buxa-folder-panel/);
});
test('V2 keeps compact split action and notification positioning unchanged',()=>{
  assert.match(utility,/\.buxa-toast/);
  assert.match(utility,/\.buxa-unstack-popover/);
  assert.doesNotMatch(utility,/\.buxa-toast-stack\s*\{/);
  assert.doesNotMatch(utility,/\.buxa-unstack-popover\s*\{[^}]*position:\s*absolute/);
});
