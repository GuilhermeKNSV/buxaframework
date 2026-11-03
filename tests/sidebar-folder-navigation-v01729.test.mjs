import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {activateSidebarFolderTab} from '../scripts/apps/sidebar-folder-navigation.js';
import {findOppositeDockPlacement} from '../scripts/apps/sidebar-dock-placement.js';

const rect=(left,top,right,bottom)=>({left,top,right,bottom});

test('folder button activates its hidden tab using Foundry V14 primary navigation',()=>{
  const calls=[];
  const sidebar={expanded:true,tabGroups:{primary:'chat'},changeTab:(tab,group)=>calls.push([tab,group])};
  let nativeClicks=0;
  const nativeButton={click:()=>nativeClicks++};
  assert.equal(activateSidebarFolderTab('items',{sidebar,nativeButton}),true);
  assert.deepEqual(calls,[['items','primary']]);
  assert.equal(nativeClicks,0,'hidden native button should never be clicked when V14 API is available');
});

test('folder stays usable when clicking an already-active tab, without collapsing the sidebar',()=>{
  let calls=0;
  const sidebar={expanded:true,tabGroups:{primary:'items'},changeTab:()=>calls++};
  assert.equal(activateSidebarFolderTab('items',{sidebar}),true);
  assert.equal(calls,0);
  assert.equal(sidebar.expanded,true);
});

test('clicking a folder tab expands a collapsed Foundry sidebar',()=>{
  const calls=[];
  const sidebar={expanded:false,tabGroups:{primary:'chat'},expand(){calls.push('expand');this.expanded=true;},
    changeTab(tab,group){calls.push(`${group}:${tab}`);}};
  assert.equal(activateSidebarFolderTab('chat',{sidebar}),true);
  assert.deepEqual(calls,['expand']);
});

test('collapse folder action delegates to the native sidebar toggle, and legacy fallback clicks its face',()=>{
  let toggled=0,clicked=0;
  const sidebar={toggleExpanded(){toggled++;}};
  assert.equal(activateSidebarFolderTab('collapse',{sidebar}),true);
  assert.equal(toggled,1);
  const nativeButton={querySelector:()=>({click:()=>clicked++}),click:()=>assert.fail('must use nested face')};
  assert.equal(activateSidebarFolderTab('journal',{sidebar:{},nativeButton}),true);
  assert.equal(clicked,1);
  assert.equal(activateSidebarFolderTab('journal',{sidebar:{}}),false);
});

test('same folder flyout is preserved after sidebar rerender and click does not close it',async()=>{
  const controller=await readFile(new URL('../scripts/apps/sidebar-edit-buttons.js',import.meta.url),'utf8');
  assert.match(controller,/this\.openFolder===id && this\.flyout\?\.isConnected/);
  assert.match(controller,/this\.flyout\.dataset\.buxaTabs===signature/);
  assert.match(controller,/activateSidebarFolderTab\(tabId,\{nativeButton:node\}\)/);
  assert.doesNotMatch(controller,/node\.click\(\)/);
});

test('dock uses the red-marked far-left edge at screen bottom but shifts for overlapping UI',()=>{
  const opts={width:1650,height:900,sidebarRect:rect(1590,0,1650,900),dockWidth:52,dockHeight:304};
  const p=findOppositeDockPlacement({...opts,obstacles:[rect(0,24,50,340),rect(0,837,185,900)]});
  assert.ok(p.x>=6&&p.x<=12,`expected flush-left edge, got ${p.x}`);
  assert.ok(p.y>=470&&p.y<=530,`expected red-highlighted lower area, got ${p.y}`);
  assert.equal(p.overlap,0);
  const q=findOppositeDockPlacement({...opts,obstacles:[rect(0,0,72,900)]});
  assert.ok(q.x>=79,`must not cover a full-height native rail: ${q.x}`);
  assert.equal(q.overlap,0);
});
