import test from 'node:test';
import assert from 'node:assert/strict';
import { collectGalleryTree } from '../scripts/core/asset-browser-scan.js';

const tree = new Map([
  ['Icon', { dirs:[{path:'Icon/Armor'}, {path:'Icon/Books'}],files:[] }],
  ['Icon/Armor', {dirs:[{path:'Icon/Armor/Shields'}],files:[{path:'Icon/Armor/plate.png',name:'plate.png'}]}],
  ['Icon/Armor/Shields', {dirs:[],files:[{path:'Icon/Armor/Shields/buckler.svg',name:'buckler.svg'}]}],
  ['Icon/Books', {dirs:[{path:'Icon/Books/Scrolls'}],files:[{path:'Icon/Books/book.webp',name:'book.webp'}]}],
  ['Icon/Books/Scrolls', {dirs:[],files:[{path:'Icon/Books/Scrolls/scroll.png',name:'scroll.png'}]}]
]);
const listing = async p => { if(!tree.has(p)) throw Error('folder not found'); return tree.get(p); };

test('a configured parent folder includes recursively nested artwork without a query', async () => {
  const result=await collectGalleryTree('Icon',listing);
  assert.equal(result.folders,5);
  assert.equal(result.failures,0);
  assert.deepEqual(result.files.map(f=>f.path),[
    'Icon/Armor/plate.png','Icon/Books/book.webp','Icon/Armor/Shields/buckler.svg','Icon/Books/Scrolls/scroll.png'
  ]);
});

test('choosing a nested child folder scopes the gallery to that subtree, not siblings', async () => {
  const result=await collectGalleryTree('Icon/Armor',listing);
  assert.deepEqual(result.files.map(f=>f.path), ['Icon/Armor/plate.png','Icon/Armor/Shields/buckler.svg']);
});

test('a folder with direct images and no children is indexed correctly', async () => {
  const result=await collectGalleryTree('Icon/Books/Scrolls',listing);
  assert.deepEqual(result.files.map(f=>f.path),['Icon/Books/Scrolls/scroll.png']);
});

test('duplicate descendants and invalid out-of-scope folders cannot create infinite recursion', async () => {
  const source = async path => {
    if (path === 'Icon') return { files:[{path:'Icon/a.svg'}], dirs:[{path:'Icon/A'},{path:'Icon/A'},{path:'Outside'}] };
    if (path === 'Icon/A') return { files:[{path:'Icon/a.svg'},{path:'Icon/A/b.png'}],dirs:[{path:'Icon'},{path:'Icon/A'}] };
    throw Error('unknown');
  };
  const result=await collectGalleryTree('Icon',source);
  assert.deepEqual(result.files.map(f=>f.path),['Icon/a.svg','Icon/A/b.png']);
  assert.equal(result.folders,2);
});

test('inaccessible subfolders do not hide image results from readable siblings', async () => {
  const source = async path => {
    if (path === 'Icon') return { files:[],dirs:[{path:'Icon/Bad'}, {path:'Icon/Good'}] };
    if (path === 'Icon/Good') return {files:[{path:'Icon/Good/good.svg'}],dirs:[]};
    throw Error('permissions');
  };
  const result=await collectGalleryTree('Icon',source);
  assert.equal(result.failures,1);
  assert.deepEqual(result.files.map(f=>f.path),['Icon/Good/good.svg']);
});

test('changing folders aborts old scans and ignores stale results', async () => {
  let stopped=false;
  let resolve;
  const pending = new Promise(r=>resolve=r);
  const task=collectGalleryTree('Icon', async () => {await pending;return tree.get('Icon');}, { cancelled:()=>stopped });
  stopped=true;
  resolve();
  const result=await task;
  assert.equal(result.cancelled,true);
  assert.deepEqual(result.files,[]);
});
