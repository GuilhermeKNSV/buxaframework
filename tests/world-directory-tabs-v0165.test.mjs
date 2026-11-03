import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MODULE_ID } from '../scripts/core/constants.js';
import { directoryTabs, isDirectoryTab, directoryTabContents, nextDirectoryTabName, canPutInDirectoryTab, moveToDirectoryTab, removeDirectoryTab } from '../scripts/apps/directory-tabs.js';
const makeFolder = (id, type, parent = null, tab = false) => ({
  id, type, name: id === 'main' ? 'Main' : id, folder: parent,
  flags: tab ? { [MODULE_ID]: { directoryTab: type } } : {},
  async update(patch) { if ('folder' in patch) this.folder = patch.folder; if ('name' in patch) this.name = patch.name; },
  async delete() { this.deleted = true; }
});
const makeDoc = (id, type, folder) => ({ id, documentName: type, folder, async update(patch) { this.folder = patch.folder; }, async delete() { this.deleted = true; } });
function world(type = 'Item') {
  const main = makeFolder('main', type);
  const tab = makeFolder('alpha', type, null, true);
  const other = makeFolder('beta', type, null, true);
  const inner = makeFolder('inner', type, tab.id);
  const nested = makeFolder('nested', type, inner.id);
  const plain = makeFolder('plain', type, main.id);
  const docs = [makeDoc('a', type, tab.id), makeDoc('b', type, nested.id), makeDoc('c', type, main.id), makeDoc('d', type, plain.id), makeDoc('e', type, other.id)];
  const folders = [main, tab, other, inner, nested, plain];
  const byId = new Map(folders.map(f => [f.id, f]));
  globalThis.game = { user:{ isGM:true }, folders:{ contents: folders, get: id => byId.get(id) },
    [type === 'Item' ? 'items' : type === 'Actor' ? 'actors' : 'scenes']: { contents: docs } };
  return { type, main, tab, other, inner, nested, plain, docs, folders, lookup: id => byId.get(id) };
}
for (const type of ['Item','Actor','Scene']) {
  test(`${type} tabs: only flagged folders qualify`, () => {
    const w = world(type);
    assert.equal(isDirectoryTab(w.tab, type), true);
    assert.equal(isDirectoryTab(w.inner, type), false);
    assert.deepEqual(directoryTabs(type).map(f => f.id), ['alpha','beta']);
    assert.equal(isDirectoryTab(w.tab, type === 'Item' ? 'Actor' : 'Item'), false);
  });
  test(`${type} tabs: Main hides tab contents even in nested folders`, () => {
    const w = world(type);
    const view = directoryTabContents(type, null, w.folders, w.docs);
    assert.deepEqual(view.docs.map(d => d.id), ['c','d']);
    assert.deepEqual(view.folders.map(f => f.id), ['main','plain']);
    assert.equal(view.rootFolderId, null);
  });
  test(`${type} tabs: opening a tab keeps Main and also includes selected nested folders`, () => {
    const w = world(type);
    const view = directoryTabContents(type, w.tab.id, w.folders, w.docs);
    assert.deepEqual(view.docs.map(d => d.id), ['a','b','c','d']);
    assert.deepEqual(view.folders.map(f => f.id), ['main','inner','nested','plain']);
    assert.equal(view.rootFolderId, null);
    assert.equal(view.tabContentsFolderId, w.tab.id);
  });
  test(`${type} tabs: moving documents and whole folders preserves their identity`, async () => {
    const w = world(type);
    assert.equal(await moveToDirectoryTab(type, { kind:'doc', doc:w.docs[2] }, w.tab.id), true);
    assert.equal(w.docs[2].folder, w.tab.id);
    assert.equal(await moveToDirectoryTab(type, { kind:'folder', doc:w.plain }, w.tab.id), true);
    assert.equal(w.plain.folder, w.tab.id);
    assert.equal(w.docs[3].folder, w.plain.id);
    assert.equal(await moveToDirectoryTab(type, { kind:'doc', doc:w.docs[0] }, w.main.id), true);
    assert.equal(w.docs[0].folder, w.main.id);
  });
  test(`${type} tabs: tab root and Main cannot move into another tab`, () => {
    const w = world(type);
    assert.equal(canPutInDirectoryTab(w.tab,type,w.other.id,w.lookup), false);
    assert.equal(canPutInDirectoryTab(w.main,type,w.other.id,w.lookup), false);
    assert.equal(canPutInDirectoryTab(w.nested,type,w.nested.id,w.lookup), false);
    assert.equal(canPutInDirectoryTab(w.inner,type,w.nested.id,w.lookup), false);
  });
  test(`${type} tabs: Delete tab moves direct contents to Main intact`, async () => {
    const w = world(type);
    await removeDirectoryTab(type,w.tab);
    assert.equal(w.tab.deleted,true);
    assert.equal(w.docs[0].folder,w.main.id);
    assert.equal(w.inner.folder,w.main.id);
    assert.equal(w.docs[1].folder,w.nested.id);
    assert.equal(w.docs.some(d => d.deleted),false);
    assert.equal(w.nested.deleted,undefined);
  });
  test(`${type} tabs: Delete all removes nested contents but not Main/other tab`, async () => {
    const w = world(type);
    await removeDirectoryTab(type,w.tab,{ deleteContents:true });
    assert.equal(w.tab.deleted,true);
    assert.equal(w.inner.deleted,true);
    assert.equal(w.nested.deleted,true);
    assert.equal(w.docs[0].deleted,true);
    assert.equal(w.docs[1].deleted,true);
    assert.equal(w.docs[2].deleted,undefined);
    assert.equal(w.other.deleted,undefined);
    assert.equal(w.main.deleted,undefined);
  });

  test(`${type} tabs: auto numbering skips existing numbers and needs no naming form`, () => {
    const w = world(type);
    assert.equal(nextDirectoryTabName(type), '1');
    w.tab.name = '1';
    w.other.name = '3';
    assert.equal(nextDirectoryTabName(type), '2');
    w.other.name = '2';
    assert.equal(nextDirectoryTabName(type), '3');
  });
  test(`${type} tabs: shared Main is never recursively deleted with a custom tab`, async () => {
    const w = world(type);
    const visible = directoryTabContents(type,w.tab.id,w.folders,w.docs);
    assert.ok(visible.folders.includes(w.main));
    assert.ok(visible.folders.includes(w.plain));
    await removeDirectoryTab(type,w.tab,{deleteContents:true});
    assert.equal(w.main.deleted,undefined);
    assert.equal(w.plain.deleted,undefined);
    assert.equal(w.docs[2].deleted,undefined);
    assert.equal(w.docs[3].deleted,undefined);
  });
  test(`${type} tabs: non-GM cannot move or delete`, async () => {
    const w = world(type);
    globalThis.game.user.isGM = false;
    await assert.rejects(() => moveToDirectoryTab(type,{kind:'doc',doc:w.docs[0]},w.main.id), /GM/);
    await assert.rejects(() => removeDirectoryTab(type,w.tab), /GM/);
  });
}

import { directoryListHTML } from '../scripts/apps/item-directory-tree.js';
import { genericTreeHTML } from '../scripts/apps/world-directory-shared.js';
test('Item subtab tree shows Main and its items beside the custom tab, excluding other tabs', () => {
  const w = world('Item');
  const view = directoryTabContents('Item', w.tab.id, w.folders, w.docs);
  const html = directoryListHTML({folders:view.folders,items:view.docs,rootFolderId:view.rootFolderId,tabContentsFolderId:view.tabContentsFolderId,rarities:[],expanded:new Set(['main','plain','alpha','inner','nested'])});
  assert.match(html,/data-buxa-dir-item="a"/);
  assert.match(html,/data-buxa-dir-item="b"/);
  assert.match(html,/data-buxa-dir-item="c"/);
  assert.match(html,/data-buxa-dir-item="d"/);
  assert.match(html,/data-buxa-dir-folder="main"/);
  assert.doesNotMatch(html,/data-buxa-dir-folder="alpha"/);
  assert.doesNotMatch(html,/data-buxa-dir-item="e"/);
});
for (const type of ['Actor','Scene']) {
 test(`${type} subtab tree renders nested entries`,()=>{
  const w = world(type);
  const view = directoryTabContents(type,w.tab.id,w.folders,w.docs);
  const html = genericTreeHTML({type,docs:view.docs,folders:view.folders,rootFolderId:view.rootFolderId,tabContentsFolderId:view.tabContentsFolderId,expanded:new Set(['main','plain','alpha','inner','nested'])});
  assert.match(html,/data-buxa-dir-item="a"/);
  assert.match(html,/data-buxa-dir-item="b"/);
  assert.match(html,/data-buxa-dir-item="c"/);
  assert.match(html,/data-buxa-dir-folder="main"/);
  assert.doesNotMatch(html,/data-buxa-dir-item="e"/);
 });
}


test('v0.16.6 bottom tabs use immediate creation and inline rename, not the focus-stealing popup', () => {
  const source = readFileSync(new URL('../scripts/apps/directory-tabs.js', import.meta.url), 'utf8');
  assert.match(source, /nextDirectoryTabName\(type\)/);
  assert.match(source, /globalThis\.Folder\.create\(/);
  assert.match(source, /buxa-directory-tab-rename/);
  assert.match(source, /input\.focus\(/);
  assert.doesNotMatch(source, /showForm\(/);
  assert.match(source, /if \(renaming\) return;/);
});
