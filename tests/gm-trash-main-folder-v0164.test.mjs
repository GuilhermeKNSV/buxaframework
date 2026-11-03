import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { canMoveWorldItemFolder, moveWorldItemFolder, itemFolderFromDrop } from '../scripts/apps/item-directory-folder-move.js';
import {
  trashcanState, setTrashcanSelecting, setTrashcanMainSelecting, trashcanSelectMainItem,
  trashcanMainItemSelected, trashcanDeleteSelectedMain, trashcanDeleteItemDocument
} from '../scripts/apps/gm-trashcan.js';

const globals = () => Object.fromEntries(['game','canvas','document'].map(k => [k,globalThis[k]]));
function restore(old) { for (const [k,v] of Object.entries(old)) if (v === undefined) delete globalThis[k]; else globalThis[k] = v; }
function folders() {
  const main = { id:'main', name:'Main', type:'Item', folder:null };
  const alpha = {id:'alpha',name:'Alpha',type:'Item',folder:main,async update(values){this.folder=values.folder;}};
  const beta = {id:'beta',name:'Beta',type:'Item',folder:alpha,async update(values){this.folder=values.folder;}};
  const other = {id:'other',name:'Other',type:'Item',folder:null,async update(values){this.folder=values.folder;}};
  return [main,alpha,beta,other];
}

test('Main remains pinned but regular folders can move out of it or to other folders',async()=>{
  const old=globals();
  try {
    const list=folders(); const get=id=>list.find(f=>f.id===id);
    globalThis.game={user:{isGM:true},folders:{get}};
    assert.equal(canMoveWorldItemFolder(list[0],null,get),false);
    assert.equal(canMoveWorldItemFolder(list[1],null,get),true);
    assert.equal(canMoveWorldItemFolder(list[1],'other',get),true);
    assert.equal(canMoveWorldItemFolder(list[1],'alpha',get),false);
    assert.equal(canMoveWorldItemFolder(list[1],'beta',get),false);
    assert.equal(canMoveWorldItemFolder(list[1],'missing',get),false);
    assert.equal(await moveWorldItemFolder(list[1],null,get),true);
    assert.equal(list[1].folder,null);
    assert.equal(await moveWorldItemFolder(list[1],'other',get),true);
    assert.equal(list[1].folder,'other');
    await assert.rejects(moveWorldItemFolder(list[0],'other',get));
    await assert.rejects(moveWorldItemFolder(list[1],'beta',get));
  }finally {restore(old);}
});

test('folder moves fail closed for non-GMs, non-Item folders and malformed drags',async()=>{
  const old=globals();
  try {
    const list=folders();const get=id=>list.find(f=>f.id===id);
    globalThis.game={user:{isGM:false},folders:{get}};
    await assert.rejects(moveWorldItemFolder(list[1],null,get),/Only GMs/);
    assert.equal(canMoveWorldItemFolder({...list[1],type:'Actor'},null,get),false);
    assert.equal(itemFolderFromDrop({type:'Folder',uuid:'Folder.alpha'},get),list[1]);
    assert.equal(itemFolderFromDrop({type:'Folder',uuid:'Actor.alpha'},get),null);
    assert.equal(itemFolderFromDrop({type:'Folder',uuid:'Folder.nope'},get),null);
    assert.equal(itemFolderFromDrop({type:'Item',uuid:'Item.alpha'},get),null);
  }finally {restore(old);}
});

test('world trash select mode only marks world items and is independent of scene mode',()=>{
  const old=globals();
  try {
    const items=new Map([['one',{id:'one',documentName:'Item'}],['two',{id:'two',documentName:'Item'}]]);
    globalThis.game={user:{isGM:true},items:{get:id=>items.get(id)}};
    globalThis.canvas={scene:{id:'room'}};
    assert.equal(setTrashcanMainSelecting(true),true);
    assert.equal(trashcanState().mainSelecting,true);
    assert.equal(trashcanSelectMainItem('one'),true);
    assert.equal(trashcanMainItemSelected('one'),true);
    assert.equal(trashcanSelectMainItem('missing'),false);
    assert.equal(trashcanState().mainCount,1);
    trashcanSelectMainItem('one');
    assert.equal(trashcanState().mainCount,0);
    setTrashcanMainSelecting(true);
    trashcanSelectMainItem('two');
    setTrashcanSelecting(true);
    assert.equal(trashcanState().mainCount,0);
    assert.equal(trashcanState().mainSelecting,false);
    assert.equal(setTrashcanMainSelecting(true),true);
    assert.equal(trashcanState().selecting,false);
    game.user.isGM=false;
    assert.equal(setTrashcanMainSelecting(true),false);
    assert.equal(trashcanSelectMainItem('one'),false);
  } finally {setTrashcanMainSelecting(false);restore(old);}
});

test('selected main items are deleted directly without a confirmation and do not touch other world items',async()=>{
  const old=globals();
  try {
    const items=new Map();const removed=[];
    for(const id of ['one','two','three'])items.set(id,{id,documentName:'Item',parent:null,async delete(){removed.push(id);items.delete(id);}});
    globalThis.game={user:{isGM:true},items:{get:id=>items.get(id)}};
    globalThis.canvas={scene:{id:'room'}};
    setTrashcanMainSelecting(true);
    trashcanSelectMainItem('one');trashcanSelectMainItem('three');
    assert.equal(await trashcanDeleteSelectedMain(),true);
    assert.deepEqual(removed,['one','three']);
    assert.ok(items.has('two'));
    assert.equal(trashcanState().mainSelecting,false);
    assert.equal(trashcanState().mainCount,0);
  }finally {setTrashcanMainSelecting(false);restore(old);}
});

test('trash item document deletes immediately with no Dialog, restricted to GMs and actual Item documents',async()=>{
  const old=globals();
  try {
    let count=0;
    globalThis.game={user:{isGM:true}};
    const item={id:'item',documentName:'Item',async delete(){count++;}};
    assert.equal(await trashcanDeleteItemDocument(item),true);
    assert.equal(count,1);
    assert.equal(await trashcanDeleteItemDocument({...item,documentName:'Actor'}),false);
    game.user.isGM=false;
    assert.equal(await trashcanDeleteItemDocument(item),false);
    assert.equal(count,1);
  }finally{restore(old);}
});

test('Trash UI includes both selection modes, shared Main destination and a real folder move action',()=>{
  const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8');
  const panel=read('../scripts/apps/gm-physical-panel.js');
  const dir=read('../scripts/apps/item-directory-ui.js');
  const view=read('../scripts/apps/item-directory-view.js');
  const folder=read('../scripts/apps/item-folder-panels.js');
  const trash=read('../scripts/apps/gm-trashcan.js');
  assert.match(panel,/Select Main Items/);
  assert.match(panel,/data-trash-main-delete/);
  assert.match(dir,/Move folder/);
  assert.match(dir,/stopImmediatePropagation/);
  assert.doesNotMatch(view,/data-buxa-dir-root-drop/);
  assert.doesNotMatch(dir,/Root \(outside Main\)/);
  assert.match(view,/directoryDropDestination/);
  assert.match(view,/moveWorldItemFolder/);
  assert.match(folder,/dragFolder/);
  assert.doesNotMatch(trash,/DialogV2\.confirm|window\?\.confirm|confirmTrash/);
});
