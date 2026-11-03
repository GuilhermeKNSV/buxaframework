import test from 'node:test';
import assert from 'node:assert/strict';
import { MODULE_ID } from '../scripts/core/constants.js';
import { directoryTabContents, moveToDirectoryTab } from '../scripts/apps/directory-tabs.js';
import { directoryListHTML } from '../scripts/apps/item-directory-tree.js';
import { genericTreeHTML } from '../scripts/apps/world-directory-shared.js';

function setup(type) {
  const folder = (id, parent = null, kind = '') => ({ id, name: id === 'main' ? 'Main' : id, folder: parent, type,
    flags: kind ? { [MODULE_ID]: { [kind]: type } } : {},
    async update(changes) { Object.assign(this, changes); } });
  const doc = (id, parent) => ({ id, name:id, folder:parent, documentName:type, img:'icons/svg/item-bag.svg',
    async update(changes) { Object.assign(this, changes); } });
  const main = folder('main', null, 'directoryMain');
  const tab = folder('player',null,'directoryTab');
  const otherTab = folder('other',null,'directoryTab');
  const shared = folder('shared',main.id);
  const local = folder('local',tab.id);
  const localChild = folder('localChild',local.id);
  const orphan = folder('orphan',null);
  const folders = [main,tab,otherTab,shared,local,localChild,orphan];
  const docs = [doc('mainDoc',main.id),doc('sharedDoc',shared.id),doc('tabDoc',tab.id),
    doc('nestedDoc',localChild.id),doc('otherDoc',otherTab.id),doc('unassignedDoc',null),doc('orphanDoc',orphan.id)];
  const map = new Map(folders.map(f => [f.id,f]));
  globalThis.game = { user:{isGM:true}, folders:{contents:folders,get:id=>map.get(id)},
    [type === 'Item' ? 'items' : type === 'Actor' ? 'actors' : 'scenes']:{contents:docs} };
  const list = (selected) => directoryTabContents(type, selected, folders, docs);
  const html = selected => {
    const view=list(selected);
    const base={folders:view.folders, docs:view.docs, rootFolderId:view.rootFolderId, tabContentsFolderId:view.tabContentsFolderId,
      expanded:new Set(['main','shared','local','localChild']), sort:'manual'};
    return type === 'Item' ? directoryListHTML({folders:base.folders,items:base.docs,rarities:[],...base})
       : genericTreeHTML({type,...base});
  };
  return { main,tab,otherTab,shared,local,localChild,orphan,folders,docs,list,html };
}

for (const type of ['Item','Actor','Scene']) {
  test(`${type}: only Main is shared, unrelated root entries stay in Main view`, () => {
    const s=setup(type);
    assert.deepEqual(s.list(null).docs.map(x=>x.id), ['mainDoc','sharedDoc','unassignedDoc','orphanDoc']);
    assert.deepEqual(s.list(s.tab.id).docs.map(x=>x.id), ['mainDoc','sharedDoc','tabDoc','nestedDoc']);
    assert.deepEqual(s.list(s.tab.id).folders.map(x=>x.id), ['main','shared','local','localChild']);
    assert.deepEqual(s.list(s.otherTab.id).docs.map(x=>x.id), ['mainDoc','sharedDoc','otherDoc']);
  });
  test(`${type}: selected tab is not rendered as a folder/card, immediate children render at root`, () => {
    const s=setup(type);
    const html=s.html(s.tab.id);
    assert.match(html,/data-buxa-dir-folder="main"/);
    assert.match(html,/data-buxa-dir-folder="local"/);
    assert.doesNotMatch(html,/data-buxa-dir-folder="player"/);
    assert.doesNotMatch(html,/data-buxa-dir-folder="other"/);
    assert.doesNotMatch(html,/data-buxa-dir-folder="orphan"/);
    assert.match(html,/data-buxa-dir-item="tabDoc"/);
    assert.match(html,/data-buxa-dir-item="nestedDoc"/);
    assert.match(html,/data-buxa-dir-item="mainDoc"/);
    assert.doesNotMatch(html,/data-buxa-dir-item="orphanDoc"/);
    assert.doesNotMatch(html,/data-buxa-dir-item="otherDoc"/);
    assert.match(html, /--buxa-tree-depth:0[^>]*>[\s\S]*?data-buxa-dir-folder="local"/);
  });
  test(`${type}: moving an item out of Main to selected tab updates only its folder, back to Main restores shared view`, async () => {
    const s=setup(type);
    const item=s.docs[0];
    assert.equal(await moveToDirectoryTab(type,{kind:'doc',doc:item},s.tab.id),true);
    assert.equal(item.folder,s.tab.id);
    assert.equal(s.list(null).docs.some(x=>x.id===item.id),false);
    assert.equal(s.list(s.tab.id).docs.some(x=>x.id===item.id),true);
    assert.equal(s.list(s.otherTab.id).docs.some(x=>x.id===item.id),false);
    assert.equal(await moveToDirectoryTab(type,{kind:'doc',doc:item},s.main.id),true);
    assert.equal(s.list(s.otherTab.id).docs.some(x=>x.id===item.id),true);
  });
  test(`${type}: moving a whole folder out of Main keeps its nested contents and Main itself`, async () => {
    const s=setup(type);
    assert.equal(await moveToDirectoryTab(type,{kind:'folder',doc:s.shared},s.tab.id),true);
    assert.equal(s.shared.folder,s.tab.id);
    assert.equal(s.docs[1].folder,s.shared.id);
    assert.deepEqual(s.list(null).docs.map(x=>x.id),['mainDoc','unassignedDoc','orphanDoc']);
    assert.match(s.html(s.tab.id),/data-buxa-dir-item="sharedDoc"/);
    assert.doesNotMatch(s.html(s.otherTab.id),/data-buxa-dir-folder="shared"/);
    assert.match(s.html(s.otherTab.id),/data-buxa-dir-folder="main"/);
  });
  test(`${type}: projection does not mutate real document folder references`, () => {
    const s=setup(type);
    const before=s.docs.map(x=>x.folder);
    const fBefore=s.folders.map(x=>x.folder);
    s.html(s.tab.id); s.html(s.otherTab.id); s.html(null);
    assert.deepEqual(s.docs.map(x=>x.folder),before);
    assert.deepEqual(s.folders.map(x=>x.folder),fBefore);
  });
}
