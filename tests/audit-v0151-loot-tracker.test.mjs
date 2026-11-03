import test from 'node:test';
import assert from 'node:assert/strict';
import {lootBeamSpec, createLootBeam, trackLootBeam} from '../scripts/apps/loot-beam.js';

for(const disabled of ['false','FALSE','0','off','no']) {
  test(`loot beam: legacy disabled spectrum=${disabled} never enables rainbow`,()=>{
    assert.equal(lootBeamSpec({id:'rare',spectrum:disabled}).spectrum,false);
  });
}
function fakeBeam() {
  const attrs=new Map();
  const beam={style:{left:'',top:'',setProperty(k,v){this[k]=v;}},setAttribute:(k,v)=>attrs.set(k,v),innerHTML:'',className:''};
  return {beam,attrs};
}
test('loot beam: invalid coordinates cannot write NaNpx or Infinitypx',()=>{
  const {beam}=fakeBeam();
  const stop=trackLootBeam(beam,()=>({x:NaN,y:Infinity}));
  assert.equal(beam.style.left,'');assert.equal(beam.style.top,'');stop();
});
test('loot beam: stale scene-anchor exceptions do not bubble out of animation',()=>{
  const {beam}=fakeBeam();
  assert.doesNotThrow(()=>{const stop=trackLootBeam(beam,()=>{throw Error('Scene was torn down');});stop();});
});
test('loot beam: missing accent resolves to a safe CSS hex color',()=>{
  const {beam}=fakeBeam();
  createLootBeam({createElement:()=>beam},{rarity:{id:'rare'}});
  assert.match(beam.style['--loot-accent'],/^#[0-9a-f]{6}$/i);
});
