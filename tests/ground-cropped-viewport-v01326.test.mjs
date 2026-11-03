import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {groundWindowLayout,groundCellAtPoint} from '../scripts/apps/ground-container-window.js';

const centered = {id:'pack',mode:'complex',columns:5,rows:5,
  cells:[6,7,8,11,13,16,17,18]};

test('a centered 3×3 shape trims the window, not the saved 5×5 storage indices',()=>{
  const {views,columns,width}=groundWindowLayout([centered]);
  assert.equal(columns,3);
  assert.equal(width,176);
  assert.deepEqual(views[0].crop,{x:1,y:1,columns:3,rows:3});
  assert.deepEqual(centered.cells,[6,7,8,11,13,16,17,18]);
});

test('pointer hits on cropped grid resolve the original absolute cell indices',()=>{
  // Full 5x5 board is shifted one 58px column and row behind a 3x3 viewport.
  const fullBoardRect={left:42,top:142,width:290,height:290};
  assert.equal(groundCellAtPoint(110,210,fullBoardRect,centered)?.index,6);
  assert.equal(groundCellAtPoint(232,326,fullBoardRect,centered)?.index,18);
  assert.equal(groundCellAtPoint(174,270,fullBoardRect,centered),null,'masked out center cannot be targeted');
  assert.equal(groundCellAtPoint(50,210,fullBoardRect,centered),null,'cropped outside mask cannot be targeted');
});

test('multiple compartments fit widest VISIBLE footprint, not largest configuration canvas',()=>{
  const narrow={...centered,id:'small',columns:6,rows:5,cells:[7,8,13,14]};
  const layout=groundWindowLayout([centered,narrow]);
  assert.equal(layout.width,176);
  assert.equal(layout.views[1].crop.columns,2);
  assert.equal(layout.views[1].crop.rows,2);
});

test('real clipped viewport markup and stacking keep item drags interactive above chest',()=>{
  const js=readFileSync(new URL('../scripts/apps/ground-container-window.js',import.meta.url),'utf8')+
    readFileSync(new URL('../scripts/apps/ground-container-view.js',import.meta.url),'utf8');
  const css=readFileSync(new URL('../styles/145-physical-items.css',import.meta.url),'utf8');
  assert.match(js,/buxa-storage-board-viewport/);
  assert.match(js,/--buxa-storage-crop-x/);
  assert.match(js,/data-ground-storage-id/);
  assert.match(js,/dropInventoryIntoGroundContainer/);
  assert.match(css,/\.buxa-storage-board-viewport > \.buxa-storage-grid/);
  assert.match(css,/width: calc\(var\(--buxa-storage-visible-columns\) \* 58px\) !important/);
  const windowZ=Number(css.match(/\.buxa-ground-container-window\{[^}]*z-index:(\d+)/)?.[1]);
  const ghostZ=Number(css.match(/\.buxa-inventory-drag-ghost:not\(\.buxa-ground-drag-ghost\),[\s\S]*?z-index: (\d+) !important/)?.[1]);
  assert.ok(ghostZ>windowZ,'drag ghost appears above chest');
  assert.match(css,/pointer-events: none !important/);
});
