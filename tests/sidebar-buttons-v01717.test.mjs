import test from 'node:test';
import assert from 'node:assert/strict';
import {
 SIDEBAR_DEFAULT_TABS,defaultSidebarLayout,normalizeSidebarLayout,normalizeSidebarWorld,
 isSidebarButtonHidden,moveSidebarButton,setSidebarButtonVisibility,addSidebarFolder,removeSidebarFolder
} from '../scripts/core/sidebar-button-layout.js';

const tabs=['chat','combat','scenes','actors','items','journal','settings'];
const base=()=>defaultSidebarLayout(tabs);

test('Sidebar default includes all tabs in their native order',()=>{
  const data=base();
  assert.deepEqual(data.order,tabs);
  assert.ok(SIDEBAR_DEFAULT_TABS.includes('settings'));
});
test('Sidebar layout supports stable reorder and folders',()=>{
  let data=base();
  data=moveSidebarButton(data,'items',{before:'combat'});
  assert.equal(data.order[1],'items');
  data=addSidebarFolder(data,'folder-001','Tools');
  data=moveSidebarButton(data,'combat',{into:'folder-001'});
  data=moveSidebarButton(data,'journal',{into:'folder-001'});
  assert.deepEqual(data.folders[0].items,['combat','journal']);
  assert.ok(!data.order.includes('combat'));
  assert.ok(!data.order.includes('journal'));
  assert.deepEqual(normalizeSidebarLayout(data,tabs).folders[0].items,['combat','journal']);
  data=moveSidebarButton(data,'combat',{before:'chat'});
  assert.deepEqual(data.folders[0].items,['journal']);
  assert.equal(data.order[0],'combat');
  data=removeSidebarFolder(data,'folder-001');
  assert.ok(data.order.includes('journal'));
});
test('Settings cannot be hidden, removed, or placed inside a folder',()=>{
  let data=addSidebarFolder(base(),'folder-one');
  data=moveSidebarButton(data,'settings',{into:'folder-one'});
  assert.ok(data.order.includes('settings'));
  assert.ok(!data.folders[0].items.includes('settings'));
  data=setSidebarButtonVisibility(data,'settings','removed');
  data=setSidebarButtonVisibility(data,'settings','hidden');
  assert.ok(!data.hidden.includes('settings'));
  assert.ok(!data.removed.includes('settings'));
  const normalized=normalizeSidebarLayout({order:[],folders:[{id:'folder-one',items:['settings']}],hidden:['settings'],removed:['settings']},tabs);
  assert.ok(normalized.order.includes('settings'));
  assert.deepEqual(normalized.folders[0].items,[]);
});
test('Hidden and deleted buttons restore when returned to the bar',()=>{
  let data=setSidebarButtonVisibility(base(),'items','hidden');
  data=setSidebarButtonVisibility(data,'combat','removed');
  assert.equal(isSidebarButtonHidden('combat',{isGM:true},data,normalizeSidebarWorld({},tabs)),true);
  data=moveSidebarButton(data,'items',{before:'settings'});
  data=moveSidebarButton(data,'combat',{before:'items'});
  assert.deepEqual(data.hidden,[]);
  assert.deepEqual(data.removed,[]);
  assert.ok(data.order.indexOf('combat')<data.order.indexOf('items'));
});
test('World visibility affects only targeted players, and never Settings',()=>{
  const world=normalizeSidebarWorld({visibility:{allPlayers:['combat','settings'],users:{alice:['items','settings'],bob:['actors']}}},tabs);
  const layout=base();
  assert.equal(isSidebarButtonHidden('combat',{id:'alice',isGM:false},layout,world),true);
  assert.equal(isSidebarButtonHidden('combat',{id:'gm',isGM:true},layout,world),false);
  assert.equal(isSidebarButtonHidden('items',{id:'alice',isGM:false},layout,world),true);
  assert.equal(isSidebarButtonHidden('items',{id:'bob',isGM:false},layout,world),false);
  assert.equal(isSidebarButtonHidden('settings',{id:'alice',isGM:false},layout,world),false);
});
test('Layout normalizer blocks corrupted entries and keeps newly installed tabs',()=>{
  const data=normalizeSidebarLayout({
   order:['chat','chat','folder-abc','fake','settings'],
   folders:[{id:'folder-abc',name:'Example',items:['items','items','settings','unknown']},{id:'folder-abc',name:'duplicate'}],
   hidden:['items','settings','missing'],removed:['combat','combat','settings'],snap:false,autoAlign:false
  },tabs);
  assert.equal(data.folders.length,1);
  assert.deepEqual(data.folders[0].items,['items']);
  assert.ok(data.order.includes('actors'));
  assert.ok(!data.hidden.includes('settings'));
  assert.deepEqual(data.removed,['combat']);
  assert.equal(data.snap,false); assert.equal(data.autoAlign,false);
});
test('Folder icon metadata rejects unsafe paths and arbitrary CSS classes',()=>{
  const data=normalizeSidebarLayout({folders:[
    {id:'folder-unsafe',name:'Danger',icon:{type:'image',value:'javascript:alert(1)'},items:[]},
    {id:'folder-css',icon:{type:'fa',value:'fa-solid fa-folder" onclick="alert(1)'},items:[]}
  ],order:['folder-unsafe','folder-css','settings']},tabs);
  assert.equal(data.folders[0].icon.type,'fa');
  assert.equal(data.folders[1].icon.value,'fa-solid fa-folder');
});
