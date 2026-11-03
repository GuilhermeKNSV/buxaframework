import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { quantityOddsDraft, quantityOddsRows, setQuantityOddsPreset, serializeQuantityOdds } from '../scripts/core/npc-drop-odds.js';
import { quantityOptions, rollNpcDrops } from '../scripts/core/npc-dropping.js';

const file = name => readFileSync(new URL(name, import.meta.url), 'utf8');
const base = {id:'sample0001',data:{name:'Loot',system:{quantity:1}},chance:100,min:1,max:3,destination:'inventory'};

test('legacy comma/semicolon quantity odds become the same adjustable rows and survive saving', () => {
  const map = quantityOddsDraft({...base,weights:'1:70, 2:20, 3:10'});
  assert.deepEqual(quantityOddsRows(map,1,3).map(row=>row.percent),[70,20,10]);
  assert.equal(serializeQuantityOdds(map,1,3),'1:70,2:20,3:10');
  assert.deepEqual(quantityOptions({...base,weights:serializeQuantityOdds(map,1,3)}).map(row=>row.weight),[70,20,10]);
});
test('equal chances are the default and serialize to the backward-compatible empty string', () => {
  const map=quantityOddsDraft({...base,weights:''});
  assert.deepEqual(quantityOddsRows(map,1,3).map(row=>row.percent),[33.3,33.3,33.3]);
  assert.equal(serializeQuantityOdds(map,1,3),'');
});
test('lower, higher and minimum-only odds presets are deterministic', () => {
  const map=new Map();
  setQuantityOddsPreset(map,1,5,'lower');
  assert.deepEqual(quantityOddsRows(map,1,5).map(x=>x.weight),[100,60,36,22,13]);
  setQuantityOddsPreset(map,1,5,'higher');
  assert.deepEqual(quantityOddsRows(map,1,5).map(x=>x.weight),[13,22,36,60,100]);
  setQuantityOddsPreset(map,1,5,'minimum');
  assert.deepEqual(quantityOddsRows(map,1,5).map(x=>x.weight),[100,0,0,0,0]);
});
test('manually setting zero excludes a quantity from actual kill rolls', () => {
  const map=new Map([[1,100],[2,0],[3,50]]);
  const weights=serializeQuantityOdds(map,1,3);
  assert.equal(weights,'1:100,2:0,3:50');
  assert.deepEqual(quantityOddsRows(map,1,3).map(x=>x.percent),[66.7,0,33.3]);
  const item={...base,weights};
  for (let i=0;i<100;i++) {
    const random=[0,i/100];let offset=0;
    const quantity=rollNpcDrops([item],()=>random[offset++]??0)[0].quantity;
    assert.notEqual(quantity,2);
  }
});
test('all-zero chance rows are rejected and invalid manual inputs are clamped', () => {
  const map=new Map([[1,0],[2,0],[3,0]]);
  assert.equal(serializeQuantityOdds(map,1,3),null);
  map.set(2,'not a number');map.set(1,500);
  assert.equal(serializeQuantityOdds(map,1,3),'1:100,2:50,3:0');
});
test('quantity range extensions preserve prior odds and give new choices a usable default', () => {
  const map=quantityOddsDraft({...base,weights:'1:0,2:100,3:0'});
  assert.deepEqual(quantityOddsRows(map,1,5).map(x=>x.weight),[0,100,0,50,50]);
  assert.equal(serializeQuantityOdds(map,4,5),'');
});
test('large legacy weights are scaled for editable controls without losing relative odds', () => {
  const map=quantityOddsDraft({...base,weights:'1:200,2:100,3:0'});
  assert.deepEqual(quantityOddsRows(map,1,3).map(x=>x.weight),[100,50,0]);
});
test('NPC settings and rules editor have responsive slider and exact number controls', () => {
  const npc=file('../templates/npc-settings.hbs');
  const rules=file('../scripts/apps/npc-drop-editor.js');
  const css=file('../styles/172-npc-drop-editor.css');
  for(const name of ['data-npc-drop-capacity-slider','data-npc-drop-capacity']) assert.ok(npc.includes(name),name);
  for(const name of ['data-drop-range="chance"','data-drop-number="chance"','data-drop-range="min"','data-drop-range="max"','data-drop-preset="lower"','data-drop-odds-range']) assert.ok(rules.includes(name),name);
  assert.doesNotMatch(rules,/<textarea name="weights"/,'deprecated typed weight syntax is not in the UI');
  assert.match(css,/\.buxa-npc-drop-dialog\s*\.buxa-drop-odds-list\{/);
  assert.match(css,/min-height:75px!important/);
});
