import test from 'node:test';
import assert from 'node:assert/strict';
import {physicalItemVisible} from '../scripts/core/physical-item-visibility.js';

const scene={id:'wall-boundary',tokenVision:true};
const user={id:'player',isGM:false};
const item={id:'gem',x:60,y:60,size:60};
const pointVisibility=fn=>({tokenVision:true,testVisibility(points,{tolerance}){
  assert.equal(tolerance,0);
  assert.ok(Array.isArray(points));
  assert.equal(points.length,1,'avoid any-point visibility return');
  return fn(points[0]);
}});

test('an item with only a visible corner cannot leak beyond the fog edge',()=>{
  const edge=pointVisibility(({x,y})=>x+y>190);
  assert.equal(physicalItemVisible(item,{scene,user,visibility:edge}),false);
});
test('a visible center with partially concealed edges still cannot reveal the whole item',()=>{
  const edge=pointVisibility(({x,y})=>x<106);
  assert.equal(physicalItemVisible(item,{scene,user,visibility:edge}),false);
});
test('an item fully inside visibility appears; crossing the boundary hides it again',()=>{
  let boundary=125;
  const visibility=pointVisibility(({x})=>x<boundary);
  assert.equal(physicalItemVisible(item,{scene,user,visibility}),true);
  boundary=85;
  assert.equal(physicalItemVisible(item,{scene,user,visibility}),false);
});
test('selected GM preview uses all samples, even if only a token corner has sight',()=>{
  const token={controlled:true,document:{sight:{enabled:true}},vision:{testPoint:({x})=>x<100}};
  const gm={id:'gm',isGM:true};
  const omniscient=pointVisibility(()=>true);
  assert.equal(physicalItemVisible(item,{scene,user:gm,settings:{gmItemView:false},tokens:[token],visibility:omniscient}),false);
  token.vision.testPoint=({x})=>x<150;
  assert.equal(physicalItemVisible(item,{scene,user:gm,settings:{gmItemView:false},tokens:[token],visibility:omniscient}),true);
});
test('two selected character sources may collectively see the entire item, but never via just one corner',()=>{
  const left={controlled:true,document:{sight:{enabled:true}},vision:{testPoint:({x})=>x<=91}};
  const right={controlled:true,document:{sight:{enabled:true}},vision:{testPoint:({x})=>x>=89}};
  const gm={id:'gm',isGM:true};
  assert.equal(physicalItemVisible(item,{scene,user:gm,settings:{gmItemView:false},tokens:[left,right]}),true);
  assert.equal(physicalItemVisible(item,{scene,user:gm,settings:{gmItemView:false},tokens:[left]}),false);
});

test('GM selected token remains vision-gated even if canvas tokenVision getter says false',()=>{
  const token={controlled:true,document:{sight:{enabled:true}},vision:{testPoint:({x})=>x<95}};
  const gm={id:'gm',isGM:true};
  assert.equal(physicalItemVisible(item,{scene,user:gm,settings:{gmItemView:false},tokens:[token],visibility:{tokenVision:false,testVisibility:()=>true}}),false);
});
test('Scene token vision enabled is authoritative if canvas tokenVision unexpectedly reports false',()=>{
  const mismatched={tokenVision:false,testVisibility:()=>false};
  assert.equal(physicalItemVisible(item,{scene,user,visibility:mismatched}),false);
});
