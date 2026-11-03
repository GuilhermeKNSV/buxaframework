import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { complexDecorationGeometry } from '../scripts/core/complex-shape-decoration.js';
import { rotatedCells } from '../scripts/core/inventory-shapes.js';

const source = p => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const lineCount = path => (path.match(/M/g) || []).length;
const shape = cells => ({ cells });

test('4x4 solid items have only exterior contour and four decorated outer corners', () => {
  const cells = Array.from({ length: 16 }, (_, i) => ({ x: i % 4, y: Math.floor(i / 4) }));
  const border = complexDecorationGeometry(cells);
  assert.equal(border.viewBox, '0 0 4 4');
  assert.equal(lineCount(border.perimeter), 16); // perimeter, not 64 cell edges
  assert.equal(lineCount(border.corners), 4);
  assert.equal(lineCount(border.ornaments), 4);
  assert.doesNotMatch(border.perimeter, /M1 1/); // no internal seams
});

test('L/T shapes decorate actual convex corners rather than the bounding rectangle', () => {
  const L = [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }];
  const T = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }];
  for (const [cells, perimeter, corners] of [[L, 8, 5], [T, 10, 6]]) {
    const border = complexDecorationGeometry(cells);
    assert.equal(lineCount(border.perimeter), perimeter);
    assert.equal(lineCount(border.corners), corners);
    assert.equal(lineCount(border.ornaments), corners);
  }
});

test('rotating complex footprints also rotates the exact outline viewbox', () => {
  const input = shape([{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }]);
  for (const rotation of [0, 1, 2, 3]) {
    const cells = rotatedCells(input, rotation);
    const geometry = complexDecorationGeometry(cells);
    assert.match(geometry.viewBox, /^0 0 [1-8] [1-8]$/);
    assert.ok(geometry.perimeter.length > 0);
    assert.ok(lineCount(geometry.corners) >= 4);
  }
});

test('settled items and moving ghost use identical outline geometry and keep rarity flags', () => {
  const template = source('templates/player-sheet.hbs');
  const context = source('scripts/apps/inventory-context.js');
  const pointer = source('scripts/apps/inventory-controls.js');
  const decor = source('scripts/apps/complex-shape-decoration.js');
  const css = source('styles/140-complex-shape-decoration.css');
  assert.match(context, /complexDecorationGeometry\(cells\)/);
  assert.match(template, /class="buxa-complex-decoration"/);
  assert.match(template, /d="\{\{decoration\.perimeter\}\}"/);
  assert.match(pointer, /createComplexDecorationSvg\(ghost\.ownerDocument, cells\)/);
  assert.match(source('scripts/apps/inventory-drag-motion.js'), /applyDragRarityFeedback\(ghost, element, doc\.defaultView\)/);
  assert.match(source('scripts/apps/inventory-rarity-hover.js'), /"--buxa-rarity-accent"/);
  assert.match(pointer, /'buxa-rarity-bg-full'/);
  assert.match(pointer, /'is-rarity-spectrum'/);
  assert.match(decor, /complexDecorationGeometry\(cells\)/);
  assert.match(css, /\.buxa-complex-ornaments/);
  assert.match(css, /\.buxa-complex-outline/);
  assert.match(css, /buxa-rarity-bg-full/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(source('styles/buxa.css'), /140-complex-shape-decoration\.css/);
});
