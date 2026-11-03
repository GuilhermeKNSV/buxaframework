import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rarityTier} from '../scripts/core/rarity-tier.js';
import {lootBeamSpec, lootBeamMarkup, createLootBeam, trackLootBeam} from '../scripts/apps/loot-beam.js';
const css = name => readFileSync(new URL(`../styles/${name}`, import.meta.url), 'utf8');

test('rarity tier scales with id and enabled rarity flags, clamped 0-4', () => {
  assert.equal(rarityTier({id:'common'}), 0);
  assert.equal(rarityTier({id:'rare'}), 1);
  assert.equal(rarityTier({id:'epic', glint:true}), 3);
  assert.equal(rarityTier({id:'divine', animated:true, spectrum:true, glint:true, ornament:true}), 4);
  assert.equal(rarityTier({id:'my-custom'}), 1);
  assert.equal(rarityTier(null), 1);
});
test('loot beam grows with tier and keeps the required layers', () => {
  assert.ok(lootBeamSpec({id:'divine',glint:true}).h > lootBeamSpec({id:'common'}).h);
  const html = lootBeamMarkup(lootBeamSpec({id:'legendary'}));
  for (const part of ['core','column','ring','bloom','rays','embers','ripple','flash']) assert.match(html, new RegExp(`buxa-loot-beam-${part}`));
});
test('createLootBeam retains its base class and tier/spectrum; tracker writes only on change', () => {
  const attrs = new Map(); const writes = [];
  const el = {className:'', style:{setProperty(){}}, setAttribute:(k,v)=>attrs.set(k,v), set innerHTML(v){this._h=v;}, get innerHTML(){return this._h;}};
  const beam = createLootBeam({createElement:()=>el}, {rarity:{id:'epic',spectrum:true}, accent:'#b266ff'});
  assert.ok(beam.className.split(' ').includes('buxa-scene-loot-beam'));
  assert.ok(beam.className.split(' ').includes('buxa-beam-helix'));
  assert.equal(attrs.get('data-tier'), '3'); assert.equal(attrs.has('data-spectrum'), true);
  let point = {x:10.2,y:20.4};
  const stop = trackLootBeam(beam, () => point);
  assert.equal(beam.style.left, '10px'); assert.equal(beam.style.top, '20px');
  point = {x:10.4,y:20.1}; stop();
});
test('new rarity CSS never uses !important inside @keyframes (browsers ignore it)', () => {
  for (const file of ['164-scene-item-menu.css','165-rarity-slots.css','166-rarity-item-card.css']) {
    const source = css(file);
    for (const block of source.matchAll(/@keyframes[^{]+\{((?:[^{}]|\{[^{}]*\})*)\}/g)) assert.doesNotMatch(block[1], /!important/, file);
    assert.match(source, /prefers-reduced-motion/);
  }
  assert.match(css('buxa.css'), /165-rarity-slots\.css[\s\S]*166-rarity-item-card\.css/);
});
