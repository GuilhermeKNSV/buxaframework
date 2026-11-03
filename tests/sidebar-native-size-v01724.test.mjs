import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {nativeSidebarTabMetrics} from '../scripts/apps/sidebar-flyout-metrics.js';

const el=(width,height,{icon=18,inner=null,visible=true}={})=>({
  getBoundingClientRect:()=>({width:visible?width:0,height:visible?height:0}),
  querySelectorAll:()=>inner?[inner]:[],
  querySelector:()=>({
    matches:()=>false,
    getBoundingClientRect:()=>({width:icon,height:icon})
  })
});

test('folder icon dimensions follow live native Foundry tab size',()=>{
  const nav=el(50,500);
  assert.deepEqual(nativeSidebarTabMetrics(new Map([['settings',el(30,30)]]),nav),{width:30,height:30,icon:18});
  assert.deepEqual(nativeSidebarTabMetrics(new Map([['settings',el(39,38)]]),nav),{width:39,height:38,icon:18});
});
test('settings tab remains the size reference regardless of folder membership',()=>{
  const nav=el(60,400);
  const data=new Map([['chat',el(40,40)],['settings',el(29,31)]]);
  assert.equal(nativeSidebarTabMetrics(data,nav).width,29);
  assert.equal(nativeSidebarTabMetrics(data,nav).height,31);
});
test('theme wrapping uses the actual interactive child rather than its full-width wrapper',()=>{
  const nav=el(50,600);
  const inner=el(31,30);
  const data=new Map([['settings',el(50,50,{inner})]]);
  assert.deepEqual(nativeSidebarTabMetrics(data,nav),{width:31,height:30,icon:18});
});
test('zero-size hidden tabs are ignored and values are bounded for small screens',()=>{
  const nav=el(50,600);
  assert.deepEqual(nativeSidebarTabMetrics(new Map([['chat',el(30,30,{visible:false})],['settings',el(25,28)]]),nav),{width:25,height:28,icon:18});
  assert.deepEqual(nativeSidebarTabMetrics(new Map(),nav),{width:32,height:32,icon:18});
});
test('folder row styles native matching CSS sizing with no round corners',async()=>{
  const style=await readFile(new URL('../styles/182-sidebar-dock-polish.css',import.meta.url),'utf8');
  const controller=await readFile(new URL('../scripts/apps/sidebar-edit-buttons.js',import.meta.url),'utf8');
  assert.match(style,/width:var\(--buxa-sb-native-tab-width, 32px\)!important/);
  assert.match(style,/height:var\(--buxa-sb-native-tab-height, 32px\)!important/);
  assert.match(style,/font-size:var\(--buxa-sb-native-icon-size, 18px\)/);
  const placement=await readFile(new URL('../scripts/apps/sidebar-folder-flyout-position.js',import.meta.url),'utf8');
  assert.match(controller,/positionSidebarFolderFlyout/);
  assert.match(placement,/nativeSidebarTabMetrics\(tabs,nav\)/);
  assert.doesNotMatch(style,/width:33px!important/);
  assert.match(style,/\.buxa-sb-flyout \.buxa-sb-flyout-tab \{[\s\S]*?border-radius:0 !important/);
});
