import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('Actor inventory and scene sprites use the same ground-storage preview and final target',()=>{
  const inventory=read('scripts/apps/inventory-controls.js');
  const canvas=read('scripts/integrations/physical-item-canvas.js');
  const handoff=read('scripts/integrations/physical-item-handoff.js');
  const window=read('scripts/apps/ground-container-window.js');
  assert.match(inventory,/showGroundTransferAtPoint\(/);
  assert.match(inventory,/dropInventoryIntoGroundContainer\([\s\S]*?groundGrip\)/);
  assert.match(canvas,/showGroundTransferAtPoint\(data,clientX,clientY/);
  assert.match(handoff,/groundContainerTargetFromClient\(clientX,clientY,globalThis\.document,\{item:item\.data/);
  assert.match(handoff,/index:target\.index,rotation:target\.rotation/);
  assert.match(window,/groundTransferAtPoint\(item,x,y/);
  assert.match(window,/index:target\.index,rotation:target\.rotation/);
});
test('native world drops keep rotation through async UUID resolution',()=>{
  const window=read('scripts/apps/ground-container-window.js');
  const handoff=read('scripts/integrations/physical-item-handoff.js');
  assert.match(window,/const dragOptions=\{\.\.\.activePhysicalInventoryGrip\(\),rotation:activePhysicalInventoryRotation\(\)\}/);
  assert.match(window,/await fromUuid\(payload\.uuid\)/);
  assert.ok(window.indexOf('const dragOptions=')<window.indexOf('await fromUuid(payload.uuid)'));
  assert.match(handoff,/if\(groundContainerTargetFromClient\(event\.clientX,event\.clientY\)\)return/);
});
test('DOM ghost sits above ground window without taking its pointer events',()=>{
  const css=read('styles/145-physical-items.css');
  assert.match(css,/\.buxa-ground-transfer-ghost\.buxa-inventory-drag-ghost\.is-complex-ghost\s*\{/);
  assert.match(css,/z-index:100380!important/);
  assert.match(css,/pointer-events:none!important/);
});
