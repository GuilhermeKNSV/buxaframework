import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPlacementScanner } from '../scripts/core/inventory-shapes.js';
import { resolveComplexPlacement } from '../scripts/core/complex-drop-resolution.js';
const source = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const geometry = { left: 100, top: 80, right: 500, bottom: 380, columns: 8, rows: 6, cellSize: 50 };
const scanner = createPlacementScanner({ coin: { cells:[{x:0,y:0}] },
  axe: { cells:[{x:0,y:0},{x:0,y:1},{x:0,y:2}] }, blocker:{cells:[{x:0,y:0}]} },
  {columns:8,rows:6});

test('1x1 placement uses pointer cell even when originally grabbed at an edge', () => {
  const slot=resolveComplexPlacement(geometry, 201, 131, 47, 39, scanner, 'coin', 0, {singleCell:true});
  assert.equal(slot.index, 10);
  assert.equal(slot.left, 200);
  assert.equal(slot.top, 130);
  assert.equal(slot.valid,true);
});

test('single-cell placement never shifts into an occupied neighbor', () => {
  const scan=createPlacementScanner({coin:{cells:[{x:0,y:0}]},blocker:{cells:[{x:0,y:0}]}},{columns:8,rows:6});
  scan.occupy('blocker',10);
  const slot=resolveComplexPlacement(geometry,201,131,47,39,scan,'coin',0,{singleCell:true});
  assert.equal(slot.index,10);
  assert.equal(slot.valid,false);
});

test('only one complex preview is drawn, at the same position used for pointerup', () => {
  const controls=source('scripts/apps/inventory-controls.js');
  const css=source('styles/139-complex-snap-projection.css');
  assert.match(controls,/const drawX = showSnap \? location\.left : x - offsetX/);
  assert.match(controls,/const drawY = showSnap \? location\.top : y - offsetY/);
  assert.match(controls,/ghost\.style\.transform = `translate3d\(\$\{drawX\}px, \$\{drawY\}px, 0\)`/);
  assert.match(controls,/dropAt\(endEvent\.clientX, endEvent\.clientY, underPointer\)/);
  assert.doesNotMatch(controls,/ComplexPlacementGhost|placementGhost/);
  assert.doesNotMatch(css,/\.is-placement-projection/);
  assert.match(css,/\.buxa-complex-item\.is-dragging/);
  const manifest=JSON.parse(source('module.json'));
  assert.ok(manifest.styles.includes('styles/139-complex-snap-projection.css'));
});
