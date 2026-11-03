import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { directoryBlankDestination, directoryDropDestination, directoryDropSurface } from '../scripts/apps/directory-drop-destination.js';

function surface(selector, inside = true) {
  const shell = { contains: () => inside };
  const target = { closest: query => query.split(',').map(part => part.trim()).includes(selector) ? target : null };
  return { shell, target };
}
for (const type of ['Item', 'Actor', 'Scene']) {
  test(`${type}: dropping into the empty Main workspace moves out of a folder into root`, () => {
    assert.equal(directoryBlankDestination(null), null);
    assert.equal(directoryDropDestination({ activeTab: null }), null);
    assert.equal(directoryDropDestination({ activeTab: 'tab-1' }), 'tab-1');
    assert.equal(directoryDropDestination({ activeTab: 'tab-1', folderId: 'main' }), 'main');
    assert.equal(directoryDropDestination({ activeTab: 'tab-1', folderId: 'nested' }), 'nested');
    assert.equal(directoryDropDestination({ activeTab: null, panelFolderId: 'main' }), 'main');
    assert.equal(directoryDropDestination({ activeTab: 'tab-1', targetDocument: { folder: 'other-folder' } }), 'other-folder');
    assert.equal(directoryDropDestination({ activeTab: null, targetDocument: { folder: null } }), null);
  });
  test(`${type}: blank directory workspace accepts drops but controls do not`, () => {
    const root = surface('.buxa-world-list');
    assert.equal(directoryDropSurface(root.target, root.shell), true);
    const shell = surface('.buxa-world-item-directory');
    assert.equal(directoryDropSurface(shell.target, shell.shell), true);
    for (const forbidden of ['.buxa-directory-tabs','.buxa-world-toolbar','.buxa-world-searchbar','.buxa-multiedit-toggle']) {
      const target = { closest(selector) { return selector.includes(forbidden) ? this : selector.includes('buxa-world-item-directory') ? this : null; } };
      assert.equal(directoryDropSurface(target, {contains:()=>true}), false, forbidden);
    }
    assert.equal(directoryDropSurface(root.target, { contains:()=>false }), false);
    assert.equal(directoryDropSurface(root.target, root.shell, {panel:true}), false);
    const folderPanel = surface('.buxa-folder-panel');
    assert.equal(directoryDropSurface(folderPanel.target, folderPanel.shell, {panel:true}), true);
  });
}

test('Item/Actor/Scene tab changes keep floating folders open and refresh them', () => {
  const read = file => fs.readFileSync(new URL(file,import.meta.url),'utf8');
  const item = read('../scripts/apps/item-directory-view.js');
  const generic = read('../scripts/apps/world-directory-generic.js');
  assert.match(item, /onChange: \(\) => \{ state\.lastHTML = ''; renderList\(\); refreshFolderPanels\(\); \}/);
  assert.match(generic, /onChange: \(\) => \{ this\.lastHTML = ''; this\.render\(\); this\.renderPanels\(\); \}/);
  assert.match(item, /directoryDropSurface\(target, shell\)/);
  assert.match(item, /directoryDropDestination\(\{ activeTab: tabControl\?\.active/);
  assert.match(generic, /directoryDropSurface\(event\.target, target/);
  assert.match(generic, /directoryDropDestination\(\{/);
});

test('Floating Item/Actor/Scene folder panels accept drops onto their content/header/footer', () => {
  const read = file => fs.readFileSync(new URL(file,import.meta.url),'utf8');
  const item = read('../scripts/apps/item-folder-panels.js');
  const generic = read('../scripts/apps/world-directory-generic.js');
  assert.match(item, /target\.dataset\.buxaFolderPanel/);
  assert.match(item, /refreshAfterDrag/);
  assert.match(generic, /panelFolder\?\.dataset\.buxaFolderPanel/);
});

test('Item, Actor, Scene and nested folder moves out of Main write a null folder without recreating documents', async () => {
  const { moveSortedWorldItem } = await import('../scripts/apps/item-directory-reorder.js');
  const { moveWorldDocument } = await import('../scripts/apps/world-directory-shared.js');
  const { moveWorldItemFolder } = await import('../scripts/apps/item-directory-folder-move.js');
  const old = globalThis.game;
  try {
    globalThis.game = { user:{isGM:true}, folders:{get:()=>null} };
    for (const type of ['Item','Actor','Scene']) {
      let calls = 0;
      const doc = { id: 'record', documentName: type, folder:'main', update: async update => { calls++; doc.folder=update.folder; } };
      const moved = type === 'Item' ? await moveSortedWorldItem(doc,{folderId:null}) : await moveWorldDocument(doc,type,{folderId:null});
      assert.equal(moved, true, type);
      assert.equal(calls, 1, type);
      assert.equal(doc.folder, null, type);
      assert.equal(type === 'Item' ? await moveSortedWorldItem(doc,{folderId:null}) : await moveWorldDocument(doc,type,{folderId:null}),false);
      assert.equal(calls,1);
    }
    const folder = { id:'child', type:'Item', folder:'main', flags:{}, async update(data) {this.folder = data.folder;} };
    assert.equal(await moveWorldItemFolder(folder,null),true);
    assert.equal(folder.folder,null);
    assert.equal(await moveWorldItemFolder(folder,null),false);
  } finally { globalThis.game=old; }
});

test('Item panel event handlers never intercept floating Actor or Scene panel drops/context menus', () => {
  const source = fs.readFileSync(new URL('../scripts/apps/item-folder-panels.js',import.meta.url),'utf8');
  assert.match(source, /if \(!target \|\| !panels\?\.contains\(target\)\) return;/);
  assert.match(source, /if \(!row \|\| !panels\?\.contains\(row\)\) return;/);
  assert.match(source, /if \(panels\?\.contains\(event\.target\)\) return onDrop\(event\)/);
  assert.match(source, /if \(!panels\?\.contains\(event\.target\)\) \{/);
});
