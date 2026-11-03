import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {measureComplexBoard, complexDestinationFromGeometry, isOverComplexBoard, rotateGrabOffset} from '../scripts/core/complex-drag-geometry.js';
const source = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

function makeBoard() {
  let layouts = 0;
  const board = {
    style: {getPropertyValue(name) { return name.endsWith('columns') ? '10' : '6'; }},
    getBoundingClientRect() { layouts++; return {left:120,top:90,right:620,bottom:390,width:500,height:300}; }
  };
  return {board, getLayouts: () => layouts};
}

test('complex drag caches grid geometry rather than forcing layouts for each pointer event', () => {
  const {board,getLayouts} = makeBoard();
  const geometry = measureComplexBoard(board);
  assert.equal(getLayouts(),1);
  for(let x=170;x<480;x+=2){
    const location=complexDestinationFromGeometry(geometry,x,190,25,15);
    assert.equal(location?.area,'inventory');
  }
  assert.equal(getLayouts(),1);
});

test('preview and final release share exact grid-origin coordinates', () => {
  const geometry = measureComplexBoard(makeBoard().board);
  const grip={x:35,y:65};
  for (const point of [{x:190,y:170},{x:300,y:260},{x:470,y:305}]) {
    const placement=complexDestinationFromGeometry(geometry,point.x,point.y,grip.x,grip.y);
    assert.ok(placement);
    assert.equal(placement.left,geometry.left+(placement.index%geometry.columns)*geometry.cellSize);
    assert.equal(placement.top,geometry.top+Math.floor(placement.index/geometry.columns)*geometry.cellSize);
  }
  assert.equal(isOverComplexBoard(geometry,630,220),false);
  assert.equal(complexDestinationFromGeometry(geometry,125,98,30,60),null);
});

test('rotation preserves cursor grip for all four turns without moving the item unexpectedly', () => {
  let grip={x:31,y:55};
  const original={...grip};
  const height=100,width=150;
  grip=rotateGrabOffset(grip,height);
  grip=rotateGrabOffset(grip,width);
  grip=rotateGrabOffset(grip,height);
  grip=rotateGrabOffset(grip,width);
  assert.deepEqual(grip,original);
});

test('all complex item footprints use one shared rarity-colored decoration layer', () => {
  const template = source('templates/player-sheet.hbs');
  const drag = source('scripts/apps/inventory-controls.js');
  const css = source('styles/140-complex-shape-decoration.css');
  assert.match(template, /class="buxa-complex-decoration"/);
  assert.match(template, /class="buxa-complex-art"/);
  assert.doesNotMatch(template, /<span class="buxa-complex-rim"/);
  assert.match(drag, /createComplexDecorationSvg\(ghost.ownerDocument, cells\)/);
  assert.match(css, /\.buxa-complex-item > \.buxa-complex-decoration/);
  assert.match(css, /--buxa-rarity-accent/);
});

test('complex drag updates immediately and skips DOM reads for snapped movement', () => {
  const controls=source('scripts/apps/inventory-controls.js');
  const branch=controls.slice(controls.indexOf('const paintDrag ='), controls.indexOf('const move ='));
  assert.match(branch,/const pointerTarget = overBoard \? board : element\.ownerDocument\.elementFromPoint/);
  assert.match(branch,/if \(isComplex && key !== lastValidityIndex && location\?\.area!==.storage.\)/);
  assert.match(branch,/ghost\.style\.transform = `translate3d\(\$\{drawX\}px, \$\{drawY\}px, 0\)`/);
  assert.match(branch,/if \(isComplex\) \{[\s\S]*?paintDrag\(point\);[\s\S]*?return;/);
  assert.doesNotMatch(branch,/getBoundingClientRect\(/);
});
