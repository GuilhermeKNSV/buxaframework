import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {sidebarFlyoutLane,sidebarFlyoutX,visibleSidebarPane} from '../scripts/apps/sidebar-flyout-placement.js';
const rect=(left,top,right,bottom)=>({left,top,right,bottom,width:right-left,height:bottom-top});
const viewportWidth=493;
const rail=rect(48,25,88,500);
const source=rect(48,42,83,77);
const viewport=rect(0,20,493,694);
const directory=rect(99,25,493,694);

test('narrow expanded sidebar - pane consumes right: folder moves LEFT, never over directory',()=>{
  const lane=sidebarFlyoutLane({viewportWidth,navRect:rail,sourceRect:source,
    sidebarRect:viewport,paneRect:directory,rightSidebar:false});
  assert.equal(lane.rightSidebar,true,'the actual panel position determines the side, not rail screen half');
  const width=40;
  const x=sidebarFlyoutX({viewportWidth,width,lane});
  assert.ok(x+width<=directory.left,`flyout ${x} would cover the expanded panel at ${directory.left}`);
  assert.ok(x+width<=rail.left,`flyout ${x} would cover the native tab buttons at ${rail.left}`);
  assert.ok(lane.room<172,'4 native-size icons must collapse to a vertical side strip');
});

test('folder follows collapsed to expanded sidebar instead of staying in old lane',()=>{
  const collapsed=sidebarFlyoutLane({viewportWidth,navRect:rail,sourceRect:source,
    sidebarRect:rect(48,25,90,694),rightSidebar:false});
  const expanded=sidebarFlyoutLane({viewportWidth,navRect:rail,sourceRect:source,
    paneRect:directory,rightSidebar:false});
  assert.notEqual(collapsed.rightSidebar,expanded.rightSidebar);
  assert.ok(sidebarFlyoutX({viewportWidth,width:170,lane:collapsed})>88);
  assert.ok(sidebarFlyoutX({viewportWidth,width:40,lane:expanded})<48);
});

test('wide right sidebars use the open content edge, not the rail edge',()=>{
  const lane=sidebarFlyoutLane({viewportWidth:1650,navRect:rect(1590,0,1650,900),
    sourceRect:rect(1604,100,1638,134),paneRect:rect(1310,0,1650,900),rightSidebar:true});
  assert.equal(lane.rightSidebar,true);
  assert.ok(sidebarFlyoutX({viewportWidth:1650,width:178,lane})+178<1310);
});

test('visible content wins over a full-window sidebar wrapper',()=>{
  const panel={getBoundingClientRect:()=>directory,hidden:false};
  const root={getBoundingClientRect:()=>viewport,querySelectorAll:()=>[panel]};
  assert.equal(visibleSidebarPane(root,{viewportWidth,getStyle:()=>({display:'block',visibility:'visible',opacity:'1'})}),directory);
  assert.equal(visibleSidebarPane(root,{viewportWidth,getStyle:()=>({display:'none'})}),null);
});

test('the follower and controller reposition folders in normal mode',async()=>{
  const js=await readFile(new URL('../scripts/apps/sidebar-edit-buttons.js',import.meta.url),'utf8');
  const follower=await readFile(new URL('../scripts/apps/sidebar-ui-follow.js',import.meta.url),'utf8');
  const css=await readFile(new URL('../styles/182-sidebar-dock-polish.css',import.meta.url),'utf8');
  assert.match(js,/!instance\?\.edit && !instance\?\.flyout/);
  assert.match(js,/positionSidebarFolderFlyout/);
  const placement=await readFile(new URL('../scripts/apps/sidebar-folder-flyout-position.js',import.meta.url),'utf8');
  assert.match(placement,/is-vertical/);
  assert.match(follower,/renderSidebarTab/);
  assert.match(follower,/\.sidebar-content/);
  assert.match(css,/\.buxa-sb-flyout\.is-vertical/);
});
