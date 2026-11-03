import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {folderDropSlotRect,hitSidebarFolderSlot,removeSidebarFolderSlots} from '../scripts/apps/sidebar-folder-drop.js';
import {updateSidebarDragTarget} from '../scripts/apps/sidebar-edit-drag.js';
const folderRect={left:1600,top:180,right:1633,bottom:214,width:33,height:34};
test('the dedicated drawer is exactly one native Foundry button, beside—not on—the folder',()=>{
  const slot=folderDropSlotRect(folderRect,{width:33,height:34},1650,900,false);
  assert.deepEqual(slot,{left:1559,top:180,right:1592,bottom:214,width:33,height:34});
  assert.equal(hitSidebarFolderSlot({x:1575,y:195},[{id:'folder-a',rect:slot}]),'folder-a');
  assert.equal(hitSidebarFolderSlot({x:1610,y:195},[{id:'folder-a',rect:slot}]),null);
  assert.equal(hitSidebarFolderSlot({x:1550,y:195},[{id:'folder-a',rect:slot}]),null);
});
test('left sidebar opens toward the screen and viewport edge never clips its drawer',()=>{
  assert.deepEqual(folderDropSlotRect({left:12,right:45,top:100,height:33},{width:31,height:32},1000,700,true),
    {left:53,top:100.5,right:84,bottom:132.5,width:31,height:32});
  assert.equal(folderDropSlotRect({left:0,right:8,top:0,height:32},{width:33,height:33},44,400,true),null);
});
test('drawer hit tests ignore inactive or absent entries',()=>{
  assert.equal(hitSidebarFolderSlot({x:100,y:200},[]),null);
  assert.equal(hitSidebarFolderSlot({x:100,y:200},[{id:'folder-a',rect:null}]),null);
});
test('pointer over folder button orders normally, pointer in drawer nests only there',()=>{
  const cls=(initial=[])=>{
    const value=new Set(initial);
    return {contains:k=>value.has(k),add:k=>value.add(k),remove:k=>value.delete(k),toggle:(k,force)=>force===false?value.delete(k):value.add(k)};
  };
  const box=(left,top,width,height)=>({left,top,right:left+width,bottom:top+height,width,height});
  const first={dataset:{buxaButtonId:'combat'},classList:cls(),getBoundingClientRect:()=>box(1600,137,33,33)};
  const folder={isConnected:true,dataset:{buxaButtonId:'folder-a'},classList:cls(['buxa-sb-folder']),getBoundingClientRect:()=>box(1600,180,33,34)};
  const trailing={dataset:{buxaButtonId:'actors'},classList:cls(),getBoundingClientRect:()=>box(1600,225,33,33)};
  const all=[first,folder,trailing];
  const placeholder={style:{display:'',position:'',left:'',top:'',zIndex:''},nextElementSibling:null};
  const slot={classList:cls(),style:{},remove(){}};
  const editor={
    editButton:{classList:cls()}, draft:{snap:false},
    drag:{id:'chat',placeholder,folderSlots:[{id:'folder-a',folder,slot,rect:box(1559,180,33,34),leftSide:false,metrics:{width:33,height:34}}]},
    nav:{children:all,getBoundingClientRect:()=>box(1594,110,45,500),
      querySelectorAll(selector){return selector.includes('is-drop-target')?[]:[];}},
    markDropPosition(){}
  };
  const oldComputed=globalThis.getComputedStyle;
  const oldWindow=globalThis.window;
  globalThis.getComputedStyle=()=>({display:'block'});
  globalThis.window={innerWidth:1650,innerHeight:900};
  try{
    updateSidebarDragTarget(editor,{x:1614,y:196});
    assert.equal(editor.drag.into,null,'hovering the folder is NOT nesting');
    assert.equal(editor.drag.overNav,true);
    assert.equal(placeholder.style.display,'block');
    updateSidebarDragTarget(editor,{x:1576,y:196});
    assert.equal(editor.drag.into,'folder-a','only the extension nests');
    assert.equal(editor.drag.before,null);
    assert.equal(placeholder.style.display,'none');
    updateSidebarDragTarget(editor,{x:1613,y:150});
    assert.equal(editor.drag.into,null,'leaving the slot restores normal ordering');
  }finally{globalThis.getComputedStyle=oldComputed;globalThis.window=oldWindow;}
});
test('the slot is removed when a drag is cancelled, and storage schema is not touched',async()=>{
  let count=0;
  const drag={folderSlots:[{slot:{remove(){count++;}}},{slot:{remove(){count++;}}}]};
  removeSidebarFolderSlots(drag);
  assert.equal(count,2);
  assert.deepEqual(drag.folderSlots,[]);
  const controller=await readFile(new URL('../scripts/apps/sidebar-edit-buttons.js',import.meta.url),'utf8');
  const worker=await readFile(new URL('../scripts/apps/sidebar-edit-drag.js',import.meta.url),'utf8');
  const css=await readFile(new URL('../styles/182-sidebar-dock-polish.css',import.meta.url),'utf8');
  assert.match(controller,/startSidebarFolderSlots\(this,this.drag\)/);
  assert.match(controller,/removeSidebarFolderSlots\(this.drag\)/);
  assert.doesNotMatch(worker,/drag\.into=folder\?\.dataset/);
  assert.match(css,/buxa-sb-folder-slot-out/);
  assert.match(css,/border-radius:0 !important/);
});
