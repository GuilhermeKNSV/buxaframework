import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pointerCellIndex, stackTargetAtPointer } from '../scripts/core/complex-stack-target.js';
import { createPlacementScanner } from '../scripts/core/inventory-shapes.js';

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const geometry = { left: 100, top: 150, columns: 8, rows: 5, cellSize: 50 };

test('hover correctly identifies every occupied cell of a multi-cell stack', () => {
  const scanner = createPlacementScanner({
    source: {cells:[{x:0,y:0}]},
    target: {cells:[{x:0,y:0},{x:1,y:0},{x:1,y:1}]},
  }, {columns:8,rows:5});
  scanner.occupy('target', 11, 0); // (3,1), (4,1), (4,2)
  for (const index of [11, 12, 20]) {
    const x = geometry.left + (index%8 + .6) * geometry.cellSize;
    const y = geometry.top + (Math.floor(index/8) + .6) * geometry.cellSize;
    assert.equal(pointerCellIndex(geometry, x, y), index);
    assert.equal(stackTargetAtPointer(scanner.occupied, 'source', index, id => id === 'target'), 'target');
  }
  assert.equal(stackTargetAtPointer(scanner.occupied,'source',10,()=>true),null);
});

test('stack resolver does not stack incompatible or the same instance', () => {
  const map = new Map([[0, 'source'], [1, 'incompatible'], [2, 'target']]);
  assert.equal(stackTargetAtPointer(map,'source',0,()=>true),null);
  assert.equal(stackTargetAtPointer(map,'source',1,id=>id==='target'),null);
  assert.equal(stackTargetAtPointer(map,'source',2,id=>id==='target'),'target');
  assert.equal(stackTargetAtPointer(map,'source',-1,()=>true),null);
  assert.equal(stackTargetAtPointer(null,'source',2,()=>true),null);
  assert.equal(stackTargetAtPointer(map,'source',null,()=>true),null);
});

test('pointer cell geometry follows cursor exactly and rejects board edges', () => {
  assert.equal(pointerCellIndex(geometry, 100, 150),0);
  assert.equal(pointerCellIndex(geometry, 499, 399),39);
  assert.equal(pointerCellIndex(geometry, 500, 399),null);
  assert.equal(pointerCellIndex(geometry, 499, 400),null);
  assert.equal(pointerCellIndex(geometry, 99, 200),null);
  assert.equal(pointerCellIndex(geometry, NaN, 200),null);
});

test('stacking is preferred over footprint collision, but ordinary moves still validate', () => {
  const s = source('scripts/apps/inventory-controls.js');
  const move = s.slice(s.indexOf('const paintDrag ='), s.indexOf('const schedule ='));
  const end = s.slice(s.indexOf('const finish ='), s.indexOf('const cancel ='));
  assert.match(move, /const mergeId = location\?\.containerDrop \? null : \(overBoard \? stackHover\?\.targetAt\(x, y\) : null\)/);
  assert.match(move, /Boolean\(mergeId\) \|\|/);
  assert.match(end, /const mergeId = destination\?\.containerDrop \? null :/);
  assert.match(end, /stackHover\?\.targetAt\(endEvent\.clientX, endEvent\.clientY\) \|\| storageStackId/);
  assert.match(end, /stackTargetId: mergeId/);
  assert.match(s, /stackActorItems\(sheet\.actor, source, targetItem/);
  assert.match(s, /footprintPreview\?\.clear\(\)/);
  assert.match(move, /ghost\.style\.transform = `translate3d\(\$\{drawX\}px, \$\{drawY\}px, 0\)`/);
  assert.doesNotMatch(move, /if \(key === lastValidityIndex\) return;/);
});

test('native Foundry drop also recognizes the complex board hit-cell as a stack target', async () => {
  const { getInventoryDropTargetItemId } = await import('../scripts/apps/inventory-drop-target.js');
  assert.equal(getInventoryDropTargetItemId({target:{closest(selector){
    return selector==='[data-hit-item-id]' ? {dataset:{hitItemId:'existing'}} : null;
  }}}),'existing');
});

test('live complex stack hover highlights a compatible stack and restores it on exit', async () => {
  const { createComplexStackHover } = await import('../scripts/apps/complex-stack-hover.js');
  const { normalizeItemSystemConfig } = await import('../scripts/core/item-config.js');
  const { stackActorItems } = await import('../scripts/core/item-runtime.js');
  const previousFoundry = globalThis.foundry;
  const item = (id, key, qty) => ({
    id, uuid: `Actor.a.Item.${id}`, name: 'Potion', type: 'loot', img: 'icon.png',
    system: { quantity: qty },
    getFlag: (scope, name) => scope === 'buxaframework' && name === 'item'
      ? {multiple:{enabled:true, stackKey:key}} : undefined,
    update: async function(changes) { this.system.quantity = changes['system.quantity']; }
  });
  try {
    globalThis.foundry = {utils:{
      hasProperty: (obj, path) => path === 'system.quantity' && obj?.system?.quantity !== undefined,
      getProperty: (obj, path) => path === 'system.quantity' ? obj?.system?.quantity : undefined
    }};
    const source = item('a','potion',2), target = item('b','potion',4), mismatch=item('c','other',1);
    const actor = {id:'Actor.a',isOwner:true,items:new Map([['a',source],['b',target],['c',mismatch]]),
      deleteEmbeddedDocuments:async(type, ids)=>ids.forEach(id=>actor.items.delete(id))};
    source.parent = actor;target.parent = actor;mismatch.parent = actor;
    const scanner=createPlacementScanner({a:{cells:[{x:0,y:0}]},b:{cells:[{x:0,y:0},{x:1,y:0}]},c:{cells:[{x:0,y:0}]}},{columns:8,rows:5});
    scanner.occupy('b',11,0);
    scanner.occupy('c',13,0);
    const cls = () => ({active:new Set(),add(s){this.active.add(s)},remove(s){this.active.delete(s)},toggle(s,on){on?this.add(s):this.remove(s)}});
    const cells=Array.from({length:40},()=>({classList:cls()}));
    const ghost={classList:cls()};
    const config={items:normalizeItemSystemConfig()};
    const hover=createComplexStackHover({actor,sourceId:'a',scanner,config,getGeometry:()=>geometry,getCells:()=>cells,getGhost:()=>ghost});
    const pos=n=>[geometry.left+(n%8+.5)*50,geometry.top+(Math.floor(n/8)+.5)*50];
    assert.equal(hover.targetAt(...pos(11)),'b');
    assert.equal(hover.targetAt(...pos(12)),'b');
    hover.highlight('b',12);
    assert.equal(cells[12].classList.active.has('is-complex-stack-target'),true);
    assert.equal(ghost.classList.active.has('is-stack-target'),true);
    assert.equal(hover.targetAt(...pos(13)),null); // Different stack key
    hover.highlight(null,13);
    assert.equal(cells[12].classList.active.has('is-complex-stack-target'),false);
    assert.equal(ghost.classList.active.has('is-stack-target'),false);
    hover.clear();
    // Actual embedded-item merge must add quantities and remove the source.
    const merged=await stackActorItems(actor,source,target,{deleteSource:true,config});
    assert.equal(merged,target);
    assert.equal(target.system.quantity,6);
    assert.equal(actor.items.has('a'),false);
  } finally {globalThis.foundry=previousFoundry;}
});
