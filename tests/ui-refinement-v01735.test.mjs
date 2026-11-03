import test from 'node:test';
import assert from 'node:assert/strict';
import {effectHudPlacement, effectHudClock} from '../scripts/apps/effect-hud-presentation.js';
import {effectLifecycleSummary} from '../scripts/apps/effect-config-ui.js';
import {sidebarWorldRestricts} from '../scripts/apps/sidebar-edit-feedback.js';

test('Effect HUD flips outside a sheet and compacts when both gutters are narrow',()=>{
  const wide=effectHudPlacement({left:100,right:800,top:100},1280,900);
  assert.equal(wide.side,'right');assert.equal(wide.compact,false);assert.ok(wide.left>=810);
  const flipped=effectHudPlacement({left:400,right:1180,top:100},1280,900);
  assert.equal(flipped.side,'left');assert.ok(flipped.left+flipped.width<=390);
  const tight=effectHudPlacement({left:8,right:752,top:10},760,500);
  assert.equal(tight.compact,true);assert.equal(tight.width,48);
  assert.ok(tight.left>=8 && tight.left+tight.width<=752);
  const low=effectHudPlacement({left:50,right:500,top:750},1280,800);
  assert.ok(low.top+low.maxHeight<=792);
});
test('HUD clocks distinguish permanent effects and clamp expired progress',()=>{
  const rules={duration:{mode:'turns',value:4}};
  assert.equal(effectHudClock({progress:1},rules).ratio,.75);
  assert.equal(effectHudClock({progress:3},rules).expiring,true);
  assert.equal(effectHudClock({progress:10},rules).ratio,0);
  assert.equal(effectHudClock({behavior:'passive',progress:10},rules).text,'Permanent');
  assert.equal(effectHudClock({progress:10},{duration:{mode:'permanent',value:4}}).expiring,false);
});
test('Lifecycle feedback explains passive, permanent and missing triggers without changing rules',()=>{
  assert.match(effectLifecycleSummary({behavior:'passive'}),/Always active/);
  assert.match(effectLifecycleSummary({mode:'permanent',stack:'replace'}),/Until removed.*replaces.*no triggers/);
  assert.match(effectLifecycleSummary({turns:3,stack:'stack',triggers:['onApply']}),/3 combat turns.*adds a stack.*1 trigger$/);
});
test('Restoring a personal hidden tab does not mark world visibility as changed',()=>{
  const world={visibility:{allPlayers:['items'],users:{alice:['journal']}}};
  assert.equal(sidebarWorldRestricts(world,'actors'),false);
  assert.equal(sidebarWorldRestricts(world,'items'),true);
  assert.equal(sidebarWorldRestricts(world,'journal'),true);
});
