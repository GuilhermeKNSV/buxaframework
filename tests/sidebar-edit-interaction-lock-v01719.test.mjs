import test from 'node:test';
import assert from 'node:assert/strict';
import { blockNativeSidebarEvent } from '../scripts/apps/sidebar-edit-interaction-lock.js';

const native = {id:'chat'};
const launcher = {id:'edit'};
const editorMock = () => {
  const log=[];
  const editor = {
    edit:true,saving:false,nav:{isConnected:true,contains:target=>target===native || target===launcher},
    editButton:{contains:target=>target===launcher},
    onDown:()=>log.push('pointerdown'),onMove:()=>log.push('pointermove'),
    onUp:()=>log.push('pointerup'),cancelDrag:()=>log.push('cancel'),
    onNavClick:()=>log.push('editor-click'),onContext:()=>log.push('editor-context'),
    onNavKey:()=>log.push('editor-key'),closeMenu:()=>log.push('menu'),
    closeFlyout:()=>log.push('flyout'),closeDialog:()=>log.push('dialog')
  };
  return {editor,log};
};
function evt(type,target=native,key){
  const state={blocked:false,prevented:false};
  const event={type,target,key,cancelable:true,
    preventDefault(){state.prevented=true;},stopImmediatePropagation(){state.blocked=true;}};
  return {event,state};
}
test('native tab never opens through click, mouse, pointer, double click or context menu while editing',()=>{
  const {editor,log}=editorMock();
  for(const type of ['pointerdown','mousedown','mouseup','pointerup','click','auxclick','dblclick','contextmenu','touchstart','touchend']) {
    const {event,state}=evt(type);
    assert.equal(blockNativeSidebarEvent(editor,event),true,type);
    assert.equal(state.blocked,true,type);
    assert.equal(state.prevented,true,type);
  }
  assert.deepEqual(log,['pointerdown','pointerup','editor-click','editor-context']);
});
test('normal sidebar and Edit Buttons launcher keep working',()=>{
  const {editor,log}=editorMock();
  let {event,state}=evt('click',launcher);
  assert.equal(blockNativeSidebarEvent(editor,event),false);
  assert.equal(state.blocked,false);
  editor.edit=false;
  ({event,state}=evt('click'));
  assert.equal(blockNativeSidebarEvent(editor,event),false);
  assert.equal(state.blocked,false);
  assert.equal(log.length,0);
});
test('keyboard activates no native tab, but Tab can still move focus',()=>{
  const {editor,log}=editorMock();
  const press=evt('keydown',native,'Enter');
  assert.equal(blockNativeSidebarEvent(editor,press.event),true);
  assert.equal(press.state.blocked,true);
  assert.deepEqual(log,['editor-key']);
  const tab=evt('keydown',native,'Tab');
  assert.equal(blockNativeSidebarEvent(editor,tab.event),false);
  assert.equal(tab.state.prevented,false);
});
test('editor actions do not interact with native tabs while async save is pending',()=>{
  const {editor,log}=editorMock();editor.saving=true;
  const {event,state}=evt('contextmenu');
  assert.equal(blockNativeSidebarEvent(editor,event),true);
  assert.equal(state.blocked,true);
  assert.deepEqual(log,[]);
});
test('sidebar composer stylesheet has no rounded corners',async()=>{
  const {readFile}=await import('node:fs/promises');
  const css=await readFile(new URL('../styles/181-sidebar-edit-buttons.css',import.meta.url),'utf8');
  assert.doesNotMatch(css,/border-radius\s*:\s*(?!0(?:\s|!|;))\d+(?:\.\d+)?(?:px|rem|em|%)/);
  assert.match(css,/\.buxa-sb-toolbar \*/);
  assert.match(css,/\.buxa-sb-dialog \*/);
});
