import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {findOppositeDockPlacement,dockOverlap} from '../scripts/apps/sidebar-dock-placement.js';
const rect=(left,top,right,bottom)=>({left,top,right,bottom});
const sidebar=rect(1580,0,1640,900);
const place=(obstacles=[])=>findOppositeDockPlacement({width:1640,height:900,sidebarRect:sidebar,dockWidth:52,dockHeight:304,obstacles});

test('lower-left dock hugs the viewport edge below left controls without covering Foundry',()=>{
  const controls=rect(0,20,52,350),players=rect(0,840,185,900),hotbar=rect(460,790,1160,900);
  const result=place([controls,players,hotbar]);
  assert.equal(result.overlap,0);
  assert.ok(result.x>=6 && result.x<=12,`x=${result.x}`);
  assert.ok(result.y>340 && result.y+304<840,`y=${result.y}`);
});
test('stable placement reserves the EXPANDED height even if actual dock collapses',async()=>{
  const source=await readFile(new URL('../scripts/apps/sidebar-edit-dock.js',import.meta.url),'utf8');
  assert.match(source,/dockExpandedHeight=dock\.offsetHeight/);
  assert.match(source,/const h=this\.dockExpandedHeight/);
  assert.match(source,/this\.dockPlacement=position/);
  assert.match(source,/if\(!usable\)/);
  assert.doesNotMatch(source,/dock\.classList\.add\('is-space-constrained'\)/);
});
test('popouts are icon-only and stay anchored beside their folder, not the dock',async()=>{
  const source=await readFile(new URL('../scripts/apps/sidebar-edit-buttons.js',import.meta.url),'utf8');
  const style=await readFile(new URL('../styles/182-sidebar-dock-polish.css',import.meta.url),'utf8');
  assert.doesNotMatch(source,/const title=make\('div','buxa-sb-flyout-title'/);
  assert.match(source,/button\.setAttribute\('aria-label', LABELS\[tabId\]/);
  const placement=await readFile(new URL('../scripts/apps/sidebar-folder-flyout-position.js',import.meta.url),'utf8');
  assert.match(source,/positionSidebarFolderFlyout/);
  assert.match(placement,/flyout\.style\.left/);
  assert.match(style,/flex-wrap:nowrap/);
  assert.match(style,/\.buxa-sb-flyout \.buxa-sb-flyout-tab \{/);
  assert.match(style,/width:var\(--buxa-sb-native-tab-width/);
});
test('pointer movement uses compositor translation and bounded animation frames',async()=>{
  const source=await readFile(new URL('../scripts/apps/sidebar-edit-buttons.js',import.meta.url),'utf8');
  const worker=await readFile(new URL('../scripts/apps/sidebar-edit-drag.js',import.meta.url),'utf8');
  assert.match(source,/ghost\.style\.translate/);
  assert.match(source,/if\(drag\.raf\)return/);
  assert.match(source,/updateSidebarDragTarget\(this,drag\.latestPoint\)/);
  assert.match(worker,/duration:135/);
  assert.match(worker,/animation\.cancel\?\.\(\)/);
  assert.doesNotMatch(source,/ghost\.style\.left=`\$\{e\.clientX\}px`/);
});
test('layout overlap still correctly identifies concrete Foundry UI collisions',()=>{
  const box={x:70,y:500,width:52,height:304};
  assert.equal(dockOverlap(box,[rect(70,500,122,804)],0),52*304);
  assert.equal(dockOverlap(box,[rect(300,300,400,700)],0),0);
});
