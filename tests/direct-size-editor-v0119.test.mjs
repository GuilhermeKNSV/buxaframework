import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {shapeArtworkGeometry,shapeArtworkStyle} from '../scripts/core/shape-artwork.js';
import {canPlaceShape} from '../scripts/core/inventory-shapes.js';
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
test('artwork always has square pixel dimensions across long, L and rotated footprints',()=>{
  const examples=[
    {cells:[{x:0,y:0}]},
    {cells:[{x:0,y:0},{x:0,y:1},{x:0,y:2}]},
    {cells:[{x:0,y:0},{x:1,y:0},{x:0,y:1}]}
  ];
  for(const shape of examples)for(let turn=0;turn<4;turn++){
    const a=shapeArtworkGeometry(shape,turn);
    assert.ok(Math.abs(a.imageWidth*a.width-a.imageHeight*a.height)<.001);
    assert.match(shapeArtworkStyle(shape,turn),/mask-image/);
  }
});
test('editor is one contiguous eight by eight board with direct art handles',()=>{
  const css=read('styles/133-direct-size-editor.css');
  const code=read('scripts/apps/item-shape-editor.js');
  const tpl=read('templates/item-config.hbs');
  assert.match(css,/gap:0!important/);
  assert.match(css,/width:100%!important;height:100%!important/);
  assert.match(code,/dataset\.artHandle='rotate'/);
  assert.match(code,/dragStart\(e\)/);
  assert.match(code,/setArt\('imageScale'/);
  assert.match(code,/setArt\('imageRotation'/);
  assert.doesNotMatch(tpl,/data-item-shape-scale-number/);
  assert.doesNotMatch(tpl,/buxa-footprint-art-controls/);
});
test('inventory grabs occupied cells as well as direct item pieces, without disturbing collision checks',()=>{
  const code=read('scripts/apps/inventory-controls.js');
  assert.match(code,/complexDragHandlers/);
  assert.match(code,/\[data-complex-board\]/);
  assert.match(code,/data-hit-item-id/);
  assert.doesNotMatch(code,/\.some\(c=>sx\+c\.x===x&&sy\+c\.y===y\)/);
  const config={columns:5,rows:5};
  const shapes={existing:{cells:[{x:0,y:0}]},tool:{cells:[{x:0,y:0},{x:1,y:0},{x:0,y:1}]}};
  const placement={existing:{area:'inventory',index:3}};
  assert.equal(canPlaceShape(placement,shapes,'tool',2,0,config),false);
  assert.equal(canPlaceShape(placement,shapes,'tool',5,0,config),true);
});
