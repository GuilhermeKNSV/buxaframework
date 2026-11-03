import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 centeredStorageCell, indicesToStorageCells, storageCellsToIndices,
 toggleStorageCell, storageAdjacent, resizeStorageMask
} from '../scripts/core/storage-footprint-editor.js';
import {connectedCells} from '../scripts/core/shape-editor-model.js';
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('pouch painter uses a centered cell and the same adjacency rules as Item Size',()=>{
 const initial=[centeredStorageCell(4,4)];
 assert.deepEqual(initial,[5]);
 assert.equal(storageAdjacent(initial,4,4,6),true);
 assert.equal(storageAdjacent(initial,4,4,9),true);
 assert.equal(storageAdjacent(initial,4,4,15),false);
 const expanded=toggleStorageCell(initial,4,4,6);
 assert.deepEqual(expanded,[5,6]);
 const L=toggleStorageCell(expanded,4,4,9);
 assert.deepEqual(L,[5,6,9]);
 assert.equal(connectedCells(indicesToStorageCells(L,4,4)),true);
 assert.equal(toggleStorageCell(L,4,4,0),null);
 assert.equal(toggleStorageCell(L,4,4,5),null); // removing the junction disconnects
 assert.deepEqual(toggleStorageCell(L,4,4,6),[5,9]);
});

test('changing columns preserves spatial coordinates instead of flat index',()=>{
 assert.deepEqual(resizeStorageMask([5,6,9],4,4,5,4),[6,7,11]);
 assert.deepEqual(resizeStorageMask([6,7,11],5,4,4,4),[5,6,9]);
 assert.deepEqual(resizeStorageMask([15],4,4,2,2),[0]);
});

test('storage adapters handle 12x12 without changing actual pouch cell coordinates',()=>{
 const ids=[0,1,13,143];
 assert.deepEqual(storageCellsToIndices(indicesToStorageCells(ids,12,12),12),ids);
 assert.deepEqual(toggleStorageCell([70],12,12,71),[70,71]);
});

test('storage UI uses connected cells with right-click removal, no artwork overlay',()=>{
 const js=read('../scripts/apps/item-storage-editor.js');
 const css=read('../styles/142-item-storage.css');
 const hbs=read('../templates/item-config.hbs');
 assert.match(js,/toggleStorageCell\(/);
 assert.doesNotMatch(js,/shapeMaskUrl\(/);
 assert.match(js,/addEventListener\('contextmenu'/);
 assert.match(js,/Left click only adds cells/);
 assert.doesNotMatch(js,/createElement\('img'\)/);
 assert.match(js,/resizeStorageMask\(/);
 assert.match(css,/\.buxa-storage-cell-grid>button\.buxa-storage-cell/);
 assert.match(css,/grid-template-rows:repeat\(var\(--storage-rows/);
 assert.match(css,/gap:0!important/);
 assert.match(hbs,/data-storage-shape-count/);
 assert.match(hbs,/data-storage-reset/);
});
