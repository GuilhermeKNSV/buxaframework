import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeItemStorage, normalizeStorageTooltip } from '../scripts/core/item-storage.js';
import { buildStorageTooltip } from '../scripts/core/storage-tooltip.js';
import { readItemStorageEditor } from '../scripts/apps/item-storage-editor.js';
import { readFileSync } from 'node:fs';

const shaped = {
  slots: { add:4, external: [{id:'bag',label:'Hidden Pouch',mode:'complex',columns:5,rows:5,cells:[6,7,11,12,13]}] },
  equipped: { slotIds:['extra-ring'] },
  tooltip: { enabled: true }
};

test('storage sheet details use actual occupied cells, not the bounding rectangle',()=>{
  const view=buildStorageTooltip(shaped,'#55c86a');
  assert.equal(view.capacity,5);
  assert.equal(view.accent,'#55c86a');
  assert.deepEqual(view.rows.map(row=>row.value),[
    '5 slots','5 slots · 3 × 2','+4 inventory slots','1 equipment slot'
  ]);
  assert.equal(buildStorageTooltip({}),null);
});

test('tooltip supports custom title, description, colored rows and independently switchable stats',()=>{
  const storage={...shaped, tooltip:{enabled:true,style:'custom',color:'#893cff',title:'Bag of Wonders',
    description:'Magic storage with a secret pocket',showCapacity:false,showCompartments:false,
    showBonuses:false,rows:[{id:'weight',label:'Weight Limit',value:'50 lb'}]}};
  const view=buildStorageTooltip(storage,'#00ff00');
  assert.equal(view.title,'Bag of Wonders');
  assert.equal(view.accent,'#893cff');
  assert.equal(view.description,'Magic storage with a secret pocket');
  assert.equal(view.rows.length,1);
  assert.equal(view.rows[0].label,'Weight Limit');
  assert.equal(view.rows[0].value,'50 lb');
  assert.equal(buildStorageTooltip({...storage,tooltip:{enabled:false}}),null);
  assert.equal(buildStorageTooltip({...storage,slots:{external:[],add:0},equipped:{slotIds:[]}}),null);
});

test('storage tooltip normalization preserves compartments and clamps unsafe content',()=>{
  const input={...shaped,tooltip:{title:'X'.repeat(500),color:'javascript:invalid',style:'nonsense',
    rows:Array.from({length:11},(_,i)=>({id:`r${i}`,label:'L'.repeat(100),value:'V'.repeat(170)}))}};
  const normalized=normalizeItemStorage(input);
  assert.deepEqual(normalized.slots.external[0].cells,[6,7,11,12,13]);
  assert.equal(normalized.tooltip.rows.length,8);
  assert.equal(normalized.tooltip.rows[0].label.length,64);
  assert.equal(normalized.tooltip.rows[0].value.length,140);
  assert.equal(normalized.tooltip.color,'#b8c3d2');
  assert.equal(normalized.tooltip.style,'item');
  assert.equal(normalized.tooltip.title.length,64);
  assert.equal(normalizeStorageTooltip({enabled:false, rows:[{label:'A',value:'B'}]}).rows.length,1);
});

test('item storage editor reads tooltip separately from real compartment data',()=>{
  const fields={
    '[data-storage-tooltip-enabled]':{checked:true},
    '[data-storage-tooltip-title]':{value:'Traveler Pack'},
    '[data-storage-tooltip-description]':{value:'A rugged travel bag'},
    '[data-storage-tooltip-style]':{value:'custom'},
    '[data-storage-tooltip-color]':{value:'#ab33ff'},
    '[data-storage-tooltip-capacity]':{checked:true},
    '[data-storage-tooltip-compartments]':{checked:false},
    '[data-storage-tooltip-bonuses]':{checked:true}
  };
  const rows=[{dataset:{tooltipRowId:'line1'},querySelector(q){return q.includes('label')?{value:'Storage limit'}:{value:'99 items'};}}];
  const root={querySelector:q=>fields[q]||null,querySelectorAll:q=>q==='[data-storage-tooltip-row]'?rows:[]};
  const saved=readItemStorageEditor(root);
  assert.equal(saved.tooltip.title,'Traveler Pack');
  assert.equal(saved.tooltip.color,'#ab33ff');
  assert.equal(saved.tooltip.rows[0].value,'99 items');
  assert.equal(saved.tooltip.showCompartments,false);
  assert.deepEqual(saved.slots.external,[]);
});

test('storage tooltip is rendered in the item sheet and configured through basic storage editor',()=>{
  const sheet=readFileSync(new URL('../templates/item-sheet.hbs',import.meta.url),'utf8');
  const config=readFileSync(new URL('../templates/item-config.hbs',import.meta.url),'utf8');
  const app=readFileSync(new URL('../scripts/apps/item-config.js',import.meta.url),'utf8');
  assert.match(sheet,/\{\{#if hasStorageTooltip\}\}/);
  assert.match(sheet,/\{\{#each storageTooltip\.rows\}\}/);
  assert.match(config,/data-storage-tooltip-title/);
  assert.match(config,/data-storage-tooltip-add/);
  assert.match(app,/bindStorageTooltipEditor\(root\)/);
});
