import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeNpcDropEntry, quantityOptions, rollNpcDrops, npcDropTable } from '../scripts/core/npc-dropping.js';
import { quantityOddsDraft, quantityOddsRows, serializeQuantityOdds } from '../scripts/core/npc-drop-odds.js';
const base = {id:'npcitem001',data:{name:'Coin',system:{quantity:1}},chance:100,min:1,max:3,destination:'inventory'};
const read = path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('new NPC loot entries start with optional weights disabled',()=>{
  const entry=normalizeNpcDropEntry(base);
  assert.equal(entry.weightsEnabled,false);
  assert.equal(entry.weights,'');
  assert.deepEqual(quantityOptions(entry).map(o=>o.weight),[1,1,1]);
});

test('old saved weighted NPC entries migrate with custom odds enabled',()=>{
  const entry=normalizeNpcDropEntry({...base,weights:'1:80,2:15,3:5'});
  assert.equal(entry.weightsEnabled,true);
  assert.deepEqual(quantityOptions(entry).map(o=>o.weight),[80,15,5]);
  assert.deepEqual(quantityOddsRows(quantityOddsDraft(entry),1,3).map(o=>o.percent),[80,15,5]);
});

test('disabling weights yields equal runtime odds without erasing saved custom values',()=>{
  const stored=normalizeNpcDropEntry({...base,weights:'1:100,2:0,3:0',weightsEnabled:false});
  assert.equal(stored.weights,'1:100,2:0,3:0');
  assert.equal(stored.weightsEnabled,false);
  assert.deepEqual(quantityOptions(stored).map(o=>o.weight),[1,1,1]);
  assert.deepEqual(quantityOddsRows(quantityOddsDraft(stored),1,3).map(o=>o.percent),[100,0,0]);
  const seen = new Set();
  for (const roll of [.01,.34,.68,.99]){
    const values=[0,roll];let i=0;
    seen.add(rollNpcDrops([stored],()=>values[i++])[0].quantity);
  }
  assert.deepEqual([...seen].sort((a,b)=>a-b),[1,2,3]);
});

test('reenabling weights restores original distribution; enabled equal odds persist independently',()=>{
  const entry=normalizeNpcDropEntry({...base,weights:'1:100,2:0,3:0',weightsEnabled:false});
  const enabled=normalizeNpcDropEntry({...entry,weightsEnabled:true});
  assert.deepEqual(quantityOptions(enabled).map(o=>o.weight),[100,0,0]);
  const even=normalizeNpcDropEntry({...base,weights:'',weightsEnabled:true});
  assert.equal(even.weightsEnabled,true);
  assert.deepEqual(quantityOptions(even).map(o=>o.weight),[1,1,1]);
  assert.equal(serializeQuantityOdds(quantityOddsDraft(even),1,3),'');
});

test('actor NPC loot table round trip retains the switch across normalization',()=>{
  const actor={getFlag:()=>[normalizeNpcDropEntry({...base,weights:'1:0,2:0,3:100',weightsEnabled:false})]};
  assert.equal(npcDropTable(actor)[0].weightsEnabled,false);
  assert.equal(npcDropTable(actor)[0].weights,'1:0,2:0,3:100');
});

test('editor moves weights below destination, hides them by default and changes no dialog size',()=>{
  const code=read('../scripts/apps/npc-drop-editor.js');
  const styles=read('../styles/172-npc-drop-editor.css');
  assert.ok(code.indexOf('id="buxa-drop-destination"') < code.indexOf('data-drop-weights-section'));
  assert.match(code,/data-drop-weights-enabled/);
  assert.match(code,/data-drop-weights-content/);
  assert.match(code,/entry\.weightsEnabled \? '' : 'hidden'/);
  assert.match(code,/weightsEnabled = weightsToggle\.checked/);
  assert.match(code,/weightsContent\.hidden = !enabled/);
  assert.match(styles,/height:min\(570px,calc\(100dvh - 32px\)\)/);
  assert.match(styles,/\.buxa-drop-weights-content\[hidden\]\{display:none!important\}/);
  assert.match(styles,/\.buxa-drop-dialog-body\{[^}]*min-height:0/);
});
