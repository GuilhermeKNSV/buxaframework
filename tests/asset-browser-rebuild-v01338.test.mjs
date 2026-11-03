import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  cleanAssetPath, assetParent, assetName, assetExtension, assetEntries, isBrowsableAssetFolder,
  assetCrumbs, acceptedAsset, normalizeAssetFavorites, toggleAssetFavorite,
  collectUsedAssetPaths, visibleAssetFolders, filterAssetItems
} from '../scripts/core/asset-browser-model.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname,'..');

test('file naming, extension, parent, breadcrumbs and accepted image listings', () => {
  assert.equal(cleanAssetPath('\\icons\\weapons\\arrow.png'), 'icons/weapons/arrow.png');
  assert.equal(assetParent('icons/weapons/arrow.png'), 'icons/weapons');
  assert.equal(assetName('icons/test%20image.svg'), 'test image.svg');
  assert.equal(assetExtension('icons/ONE.PNG?foo'), 'png');
  assert.equal(acceptedAsset('d20.svg',['svg']),true);
  assert.equal(acceptedAsset('d20.mp3',['svg']),false);
  assert.deepEqual(assetEntries(['folder/coin.png',{path:'folder/axe.svg',url:'axe.svg'}]).map(e=>e.path), ['folder/coin.png','folder/axe.svg']);
  assert.deepEqual(assetCrumbs('a/b').map(e=>e.path),['','a','a/b']);
});

test('favorite folders and artwork persist in distinct sources and do not mutate inputs', () => {
  const before = normalizeAssetFavorites({public:{folders:['icons'],images:['icons/arrow.svg']}});
  const after = toggleAssetFavorite(before,'data','folders','my-art');
  assert.deepEqual(before.data.folders, []);
  assert.deepEqual(after.public.images,['icons/arrow.svg']);
  assert.deepEqual(after.data.folders,['my-art']);
  assert.deepEqual(toggleAssetFavorite(after,'data','folders','my-art').data.folders,[]);
  assert.deepEqual(toggleAssetFavorite(after,'data','images','my-art/arrow.png').data.images,['my-art/arrow.png']);
});

test('artwork usage includes World Items, Actor Items, Actor/token portraits, scene tiles and tokens', () => {
  const used = collectUsedAssetPaths({
    items:{contents:[{name:'Arrow',img:'a.png'}]},
    actors:{contents:[{name:'Hunter',img:'portrait.png',prototypeToken:{texture:{src:'token.png'}},items:{contents:[{name:'Bow',img:'bow.png'}]}}]},
    scenes:{contents:[{name:'Forest',background:{src:'forest.webp'},tokens:{contents:[{name:'Goblin',texture:{src:'goblin.png'}}]},tiles:{contents:[{texture:{src:'grass.png'}}]}}]}
  });
  for (const p of ['a.png','portrait.png','token.png','bow.png','forest.webp','goblin.png','grass.png']) assert.ok(used.has(p),p);
  assert.deepEqual([...used.get('bow.png')],['Hunter / Bow']);
});

test('GM-only board item artwork is marked used without revealing it to players', () => {
  const world = {user:{isGM:true},settings:{get:()=>({scene1:[{data:{img:'board-axe.png',name:'Axe'}}]})}};
  assert.deepEqual([...collectUsedAssetPaths(world).get('board-axe.png')],['Board: Axe']);
  world.user.isGM=false;
  assert.equal(collectUsedAssetPaths(world).has('board-axe.png'),false);
});

test('folder tree renders only expanded loaded folders, with capped depth', () => {
  const cache=new Map([['', {dirs:[{path:'icons'}]}],['icons',{dirs:[{path:'icons/skills'}]}]]);
  assert.deepEqual(visibleAssetFolders('',cache,new Set(['']),'icons').map(f=>f.path),['','icons']);
  assert.deepEqual(visibleAssetFolders('',cache,new Set(['','icons']),'icons').map(f=>f.path),['','icons','icons/skills']);
});

test('in-use, favorites, unused and search work across image gallery items', () => {
  const files=['arrow.png','axe.png','armor.png'].map(path=>({path,name:path}));
  const used=new Map([['arrow.png',new Set(['Item: Arrow'])]]);
  assert.deepEqual(filterAssetItems(files,{mode:'used',used}).map(f=>f.name), ['arrow.png']);
  assert.deepEqual(filterAssetItems(files,{mode:'unused',used}).map(f=>f.name), ['axe.png','armor.png']);
  assert.deepEqual(filterAssetItems(files,{mode:'favorites',favoritePaths:['armor.png']}).map(f=>f.name), ['armor.png']);
  assert.deepEqual(filterAssetItems(files,{query:'axe'}).map(f=>f.name), ['axe.png']);
});

test('new image manager has no legacy, upload, delete or folder-creation functionality', () => {
  const js=fs.readFileSync(path.join(root,'scripts/apps/asset-browser.js'),'utf8');
  const template=fs.readFileSync(path.join(root,'templates/asset-browser.hbs'),'utf8');
  const css=fs.readFileSync(path.join(root,'styles/38-asset-browser.css'),'utf8');
  assert.doesNotMatch(js,/FilePicker\.(?:upload|createDirectory)|background.remov|\.\.\/.*legacy|deleteAsset/);
  assert.match(js,/configuredLocation\(\)/);
  assert.match(js,/getSheetConfig\(\)\?\.addons\?\.iconSource/);
  assert.match(template,/FAVORITE FOLDERS/);
  assert.match(template,/data-action="favoriteImage"/);
  assert.match(template,/data-action="chooseDirectory"/);
  assert.match(template,/In use/);
  assert.match(css,/grid-template-columns:215px minmax\(0,1fr\) 246px/);
});


test('external Image URLs remain previewable but can never be browsed as FilePicker folders',()=>{
  assert.equal(isBrowsableAssetFolder('icons/weapons'),true);
  assert.equal(isBrowsableAssetFolder(''),true);
  for (const invalid of ['https://server.test/img.png','data:image/svg+xml,a','blob:deadbeef','a/../secret','a/./b','../secret','a/%2e%2e/hidden','a/%2Fsecret','a/%5csecret','a/%E0%A4%A']) {
    assert.equal(isBrowsableAssetFolder(invalid),false,invalid);
    assert.equal(assetParent(invalid),'',invalid);
    assert.deepEqual(assetCrumbs(invalid),[{label:'Root',path:''}],invalid);
  }
  assert.equal(assetExtension('https://server.test/art/magic.PNG?v=2'),'png');
});


test('malformed image rules and failed item flag reads cannot crash the image library',()=>{
  const used=collectUsedAssetPaths({items:{contents:[
    {name:'Invalid',img:'safe.svg',flags:{buxaframework:{item:{multiple:{stackImages:{bad:true}}}}}},
    {name:'No Flag Access',img:'fallback.svg',getFlag(){throw Error('old flag unavailable');},flags:{buxaframework:{item:{multiple:{stackImages:[{img:'rare.svg',layers:'wrong'}]}}}}}
  ]}});
  for(const path of ['safe.svg','fallback.svg','rare.svg']) assert.equal(used.has(path),true,path);
});
