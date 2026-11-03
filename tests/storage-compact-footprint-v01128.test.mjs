import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { storageVisibleBounds } from '../scripts/core/item-storage.js';
import { storageBoardAt, storagePlacementAt } from '../scripts/core/storage-drop-geometry.js';

const bag = (columns, rows, cells, mode='complex') => ({columns,rows,cells,mode});

test('custom external storage crops empty outer rows/columns, without reindexing slots', () => {
  const cells = [6,7,8,11,12,13,16,17,18,21,22,23];
  assert.deepEqual(storageVisibleBounds(bag(5,5,cells)),{x:1,y:1,columns:3,rows:4});
  assert.deepEqual(storageVisibleBounds(bag(5,5,[13])),{x:3,y:2,columns:1,rows:1});
  assert.deepEqual(storageVisibleBounds(bag(4,4,[0,4,8,9,10])),{x:0,y:0,columns:3,rows:3});
});

test('rectangular compartments retain configured dimensions', () => {
  assert.deepEqual(storageVisibleBounds(bag(6,4,[], 'simple')),{x:0,y:0,columns:6,rows:4});
});

test('cropped viewport only accepts visible area while using logical indices', () => {
  // Three visible columns x four rows from the middle of a 5x5 board.
  const board = {
    storageId:'backpack',columns:5,rows:5,complex:true,
    rect:{left:42,top:62,right:332,bottom:352,width:290,height:290},
    visibleRect:{left:100,top:120,right:274,bottom:352,width:174,height:232},
    clipRect:{left:100,top:120,right:274,bottom:352}
  };
  assert.equal(storageBoardAt([board],110,130),board);
  assert.equal(storageBoardAt([board],90,130),null);
  assert.equal(storageBoardAt([board],110,110),null);
  assert.equal(storageBoardAt([board],275,130),null);
  assert.equal(storagePlacementAt(board,110,130)?.index,6); // original 5-column layout, x=1/y=1
  assert.equal(storagePlacementAt(board,225,305)?.index,23); // original x=3/y=3
  assert.equal(storageBoardAt([{...board,clipRect:{left:120,top:120,right:230,bottom:352}}],110,130),null);
});

test('both storage modes use a clipped viewport and fit the visible slot count', () => {
  const template=readFileSync(new URL('../templates/player-sheet.hbs',import.meta.url),'utf8');
  const css=readFileSync(new URL('../styles/142-item-storage.css',import.meta.url),'utf8');
  assert.equal((template.match(/class="buxa-storage-board-viewport"/g) || []).length,2);
  assert.match(css,/--buxa-storage-visible-columns/);
  assert.match(css,/--buxa-storage-crop-x/);
  assert.match(css,/overflow:\s*hidden/);
});
