import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sidebarFlyoutLane, sidebarFlyoutX } from '../scripts/apps/sidebar-flyout-placement.js';

const rect=(left,top,right,bottom)=>({left,top,right,bottom,width:right-left,height:bottom-top});

test('expanded right sidebar folder strip stays OUTSIDE the whole content pane',()=>{
  const viewportWidth=1650;
  const lane=sidebarFlyoutLane({viewportWidth,navRect:rect(1590,0,1650,900),
    sourceRect:rect(1604,90,1637,123),sidebarRect:rect(1310,0,1650,900),rightSidebar:true});
  const x=sidebarFlyoutX({viewportWidth,width:164,lane,rightSidebar:true});
  assert.equal(lane.edge,1310);
  assert.ok(x+164<1310,`strip would cover sidebar: ${x}`);
});

test('collapsed right sidebar folder strip stays next to the rail',()=>{
  const viewportWidth=1650;
  const lane=sidebarFlyoutLane({viewportWidth,navRect:rect(1590,0,1650,900),
    sourceRect:rect(1604,90,1637,123),sidebarRect:rect(1590,0,1650,900),rightSidebar:true});
  const x=sidebarFlyoutX({viewportWidth,width:160,lane,rightSidebar:true});
  assert.equal(x,1590-160-9);
});

test('expanded left sidebar folder strip stays outside the content pane',()=>{
  const viewportWidth=1650;
  const lane=sidebarFlyoutLane({viewportWidth,navRect:rect(0,0,60,900),
    sourceRect:rect(14,90,47,123),sidebarRect:rect(0,0,320,900),rightSidebar:false});
  const x=sidebarFlyoutX({viewportWidth,width:160,lane,rightSidebar:false});
  assert.equal(x,329);
});

test('sidebar flyout ignores fullscreen wrapper geometry',()=>{
  const lane=sidebarFlyoutLane({viewportWidth:500,navRect:rect(452,0,500,700),
    sourceRect:rect(456,80,489,113),sidebarRect:rect(0,0,500,700),rightSidebar:true});
  assert.equal(lane.edge,452);
});

test('GM Controls overlays the dock rather than being obscured, and visibility changes reflow UI',async()=>{
  const css=await readFile(new URL('../styles/182-sidebar-dock-polish.css',import.meta.url),'utf8');
  const dock=await readFile(new URL('../scripts/apps/sidebar-edit-dock.js',import.meta.url),'utf8');
  const gm=await readFile(new URL('../scripts/apps/gm-physical-panel.js',import.meta.url),'utf8');
  const follow=await readFile(new URL('../scripts/apps/sidebar-ui-follow.js',import.meta.url),'utf8');
  const control=await readFile(new URL('../scripts/apps/sidebar-edit-buttons.js',import.meta.url),'utf8');
  assert.match(css,/\.buxa-sb-toolbar\.buxa-sb-dock\.is-gm-covered\s*\{\s*z-index:98/);
  assert.match(dock,/\.buxa-gm-panel\.is-open/);
  assert.match(gm,/buxa:gm-controls-toggled/);
  assert.match(follow,/transitionrun/);
  assert.match(follow,/ResizeObserver/);
  assert.match(control,/positionSidebarFolderFlyout/);
  assert.match(control,/instance\?\.repositionFloating\(\)/);
});
