import test from 'node:test';
import assert from 'node:assert/strict';

// A lightweight Foundry V14 contract mock: does not require a running world.
class FakeApplication {
  constructor(options = {}) { this.options = options; this.element = { querySelector: () => null, querySelectorAll: () => [] }; }
  async _preFirstRender() {}
  async _prepareContext() { return {}; }
  async _onRender() {}
  async render() { this.renderCount = (this.renderCount || 0) + 1; return this; }
  async close() { this.closed = true; }
}
const browsing = [];
const folder = 'icons/weapons';
const settings = {
  sheetConfig: { addons: { iconSource: { source:'public', path:folder } } },
  assetFavorites: { data: { folders:[], images:[] }, public: { folders:[], images:[] } }
};
globalThis.foundry = {
  applications: {
    api: { ApplicationV2:FakeApplication, HandlebarsApplicationMixin:(base)=>base },
    apps: { FilePicker: { async browse(source, target) {
      browsing.push({source,target});
      return { target, dirs: target===folder ? [`${folder}/ranged`] : [], files: [`${target}/arrow.png`, `${target}/readme.txt`] };
    } } }
  },
  utils: { randomID:()=> 'AABBCC', deepClone: structuredClone, getRoute: p => `/${p}` }
};
globalThis.CONST = { IMAGE_FILE_EXTENSIONS: {png:1, svg:1, webp:1} };
globalThis.game = { settings: {
  get(_mod,key) { return settings[key]; },
  async set(_mod,key,value) { settings[key] = value; return value; }
}, items:{contents:[]}, actors:{contents:[]}, scenes:{contents:[]}, user:{isGM:true} };
const { BuxaAssetBrowser } = await import('../scripts/apps/asset-browser.js');

test('default folder from module configuration overrides the currently selected image location', async () => {
  const picker = new BuxaAssetBrowser({current:'images/old/axe.png'});
  await picker._preFirstRender({},{});
  assert.deepEqual(browsing.at(-1), {source:'public',target:folder});
  await picker._onRender({},{});
  await picker._galleryJob;
  const c = await picker._prepareContext({});
  assert.equal(c.previewPath, 'images/old/axe.png');
  assert.equal(c.homePath, folder);
  assert.deepEqual(c.files.map(x=>x.path),[`${folder}/arrow.png`,`${folder}/ranged/arrow.png`]);
  assert.equal(c.folders[0].path, folder);
});

test('artwork browser always uses Addons folder even when callers supply old browse paths', async () => {
  // A selected image's old folder and a caller's stale source/target must not
  // change where the next Image Library window starts.
  const picker = new BuxaAssetBrowser({
    current:'other/axe.png', source:'data', target:'old-library/items', type:'image'
  });
  await picker._preFirstRender({},{});
  assert.deepEqual(browsing.at(-1), {source:'public',target:folder});
  assert.equal(picker._source, 'public');
  assert.equal(picker._target, folder);
  assert.equal(picker._selected, 'other/axe.png');
  assert.equal((await picker._prepareContext({})).homePath, folder);
});

test('reopening image picker reads newly saved source and folder every time', async () => {
  const old = settings.sheetConfig;
  try {
    settings.sheetConfig = {addons:{iconSource:{source:'data',path:'Icon'}}};
    const picker = new BuxaAssetBrowser({current:'systems/dnd5e/icons/svg/tool.svg'});
    await picker._preFirstRender({},{});
    assert.deepEqual(browsing.at(-1), {source:'data',target:'Icon'});
    assert.equal(picker._target,'Icon');
    assert.equal((await picker._prepareContext({})).homePath,'Icon');

    // Changing the module configuration affects subsequent picker instances,
    // not existing instances or their navigation state.
    settings.sheetConfig = {addons:{iconSource:{source:'public',path:'systems/dnd5e/icons'}}};
    const next = new BuxaAssetBrowser({current:'Icon/arrow.png',source:'data',target:'Icon'});
    await next._preFirstRender({},{});
    assert.deepEqual(browsing.at(-1), {source:'public',target:'systems/dnd5e/icons'});
    assert.equal(next._selected,'Icon/arrow.png');
  } finally { settings.sheetConfig = old; }
});

test('folder-selection callers can explicitly override configured folder and choose a directory', async () => {
  let result;
  const picker = new BuxaAssetBrowser({source:'data',target:'my/icons',allowDirectorySelect:true,onSelect:(path,meta)=>{result=[path,meta];}});
  await picker._preFirstRender({},{});
  assert.deepEqual(browsing.at(-1),{source:'data',target:'my/icons'});
  assert.equal((await picker._prepareContext({})).allowDirectorySelect,true);
  await BuxaAssetBrowser.DEFAULT_OPTIONS.actions.chooseDirectory.call(picker);
  assert.deepEqual(result, ['my/icons',{source:'data',directory:true}]);
  assert.equal(picker.closed,true);
});

test('favorite actions persist per client through Foundry settings without altering files', async () => {
  const picker = new BuxaAssetBrowser();
  await picker._preFirstRender({},{});
  await picker._onRender({},{});
  await picker._galleryJob;
  const action = BuxaAssetBrowser.DEFAULT_OPTIONS.actions.favoriteImage;
  await action.call(picker,{stopPropagation(){}},{dataset:{path:`${folder}/arrow.png`}});
  assert.deepEqual(settings.assetFavorites.public.images,[`${folder}/arrow.png`]);
  assert.equal((await picker._prepareContext({})).files[0].favorite,true);
  await action.call(picker,{stopPropagation(){}},{dataset:{path:`${folder}/arrow.png`}});
  assert.deepEqual(settings.assetFavorites.public.images,[]);
});


test('Default Folder button restores the saved location after browsing a nested folder', async () => {
  const picker = new BuxaAssetBrowser({current:'other/axe.png'});
  await picker._preFirstRender({},{});
  await picker._onRender({},{});
  await picker._galleryJob;
  await BuxaAssetBrowser.DEFAULT_OPTIONS.actions.browseDirectory.call(picker,null,{dataset:{path:`${folder}/ranged`}});
  await picker._onRender({},{});
  await picker._galleryJob;
  let context=await picker._prepareContext({});
  assert.equal(context.target,`${folder}/ranged`);
  assert.deepEqual(context.files.map(x=>x.path),[`${folder}/ranged/arrow.png`]);
  assert.equal(context.isAtHome,false);
  await BuxaAssetBrowser.DEFAULT_OPTIONS.actions.goHome.call(picker);
  await picker._onRender({},{});
  await picker._galleryJob;
  context=await picker._prepareContext({});
  assert.equal(context.target,folder);
  assert.equal(context.isAtHome,true);
  assert.deepEqual(context.files.map(x=>x.path),[`${folder}/arrow.png`,`${folder}/ranged/arrow.png`]);
});

test('search, favorites, and In use filters stay inside current folder and nested descendants', async () => {
  const picker = new BuxaAssetBrowser();
  await picker._preFirstRender({},{});
  await picker._onRender({},{});
  await picker._galleryJob;
  picker._query='ranged';
  assert.deepEqual((await picker._prepareContext({})).files.map(x=>x.path),[`${folder}/ranged/arrow.png`]);
  picker._query='';
  settings.assetFavorites.public.images=[`${folder}/ranged/arrow.png`,'other/coin.png'];
  await BuxaAssetBrowser.DEFAULT_OPTIONS.actions.setCollection.call(picker,null,{dataset:{collection:'favorites'}});
  assert.deepEqual((await picker._prepareContext({})).files.map(x=>x.path),[`${folder}/ranged/arrow.png`]);
  settings.assetFavorites.public.images=[];
});

test('image source changes complete in latest-request order, never reverting a newer navigation',async()=>{
  const picker=new BuxaAssetBrowser({allowDirectorySelect:true,source:'public',target:folder});
  await picker._preFirstRender({},{});
  const filePicker=foundry.applications.apps.FilePicker;
  const oldBrowse=filePicker.browse;
  let releaseOlder;
  filePicker.browse=async(source,target)=>{
    if(source==='data')return new Promise(resolve=>{releaseOlder=()=>resolve({target,dirs:[],files:[]});});
    return oldBrowse(source,target);
  };
  try {
    const older=BuxaAssetBrowser.DEFAULT_OPTIONS.actions.changeSource.call(picker,null,{dataset:{source:'data'}});
    assert.equal(picker._source,'data');
    const newer=BuxaAssetBrowser.DEFAULT_OPTIONS.actions.changeSource.call(picker,null,{dataset:{source:'public'}});
    await newer;
    releaseOlder();
    await older;
    assert.equal(picker._source,'public');
    assert.equal(picker._target,folder);
  } finally {filePicker.browse=oldBrowse;}
});

test('closing the image browser invalidates gallery scans and delayed source navigation',async()=>{
  const picker=new BuxaAssetBrowser({allowDirectorySelect:true,source:'public',target:folder});
  await picker._preFirstRender({},{});
  const filePicker=foundry.applications.apps.FilePicker;
  const oldBrowse=filePicker.browse;
  let finish;
  filePicker.browse=async()=>new Promise(resolve=>{finish=()=>resolve({target:'data',dirs:[],files:[]});});
  try {
    const nav=BuxaAssetBrowser.DEFAULT_OPTIONS.actions.changeSource.call(picker,null,{dataset:{source:'data'}});
    const renders=picker.renderCount??0;
    await picker._onClose({});
    finish();await nav;
    assert.equal(picker.renderCount??0,renders);
  }finally{filePicker.browse=oldBrowse;}
});
