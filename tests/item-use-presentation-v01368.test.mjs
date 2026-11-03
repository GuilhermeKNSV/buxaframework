import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (name) => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const get = (o,p) => String(p).split('.').reduce((v,k)=>v?.[k],o);
globalThis.foundry={utils:{deepClone:structuredClone,getProperty:get,escapeHTML:String,randomID:()=> 'testid',hasProperty:(o,p)=>get(o,p)!==undefined}};
globalThis.game={system:{id:'dnd5e'},settings:{get:()=>({})}};
const {itemUseView}=await import('../scripts/apps/item-use-actions.js');
function item(effects,used=0) {
  return {parent:{id:'actor',documentName:'Actor'},flags:{buxaframework:{item:{resourceEffects:effects,limits:{enabled:true,maxUses:4,onExhaust:'disable'}},itemUsage:{used}}},getFlag(n,k){return this.flags[n][k];}};
}
const config={resources:[{id:'hp',label:'HP'},{id:'mp',label:'MP'}],attributes:{entries:[{id:'str',label:'Strength'}]},proficiencies:{entries:[]}};
test('Resource/Uses display is sourced from real item counters and rules',()=> {
  const effects=[{resourceId:'hp',action:'fill',timing:'after',amountType:'dice',count:2,faces:10,flat:3,rollMode:'advantage'},
    {resourceId:'mp',action:'drain',timing:'before',amountType:'percent',amount:25}];
  const view=itemUseView(item(effects,1),config);
  assert.equal(view.remaining,3);assert.equal(view.usesPercent,'75.00');
  assert.equal(view.onExhaustLabel,'LOCKS WHEN EMPTY');
  assert.deepEqual(view.resourceEffects.map(e=>[e.amountText,e.label,e.actionText,e.rollModeText]),[
    ['2d10 + 3','HP','RESTORE','ADVANTAGE'],['25%','MP','DRAIN','']
  ]);
  const exhausted=itemUseView(item(effects,4),config);
  assert.equal(exhausted.usesPercent,'0.00');assert.equal(exhausted.exhausted,true);
});
test('Item Sheet and hover tooltip share unboxed rarity-aware resource presentation',()=> {
  const html=read('templates/item-sheet.hbs');
  const hover=read('scripts/apps/item-tooltip.js');
  const css=read('styles/153-item-use-presentation.css');
  const entry=read('styles/buxa.css');
  assert.match(html,/buxa-item-use-meter-fill.*itemUse\.usesPercent/);
  assert.match(html,/buxa-item-use-effect-value/);
  assert.match(html,/data-use-item-standalone/);
  assert.match(hover,/buxa-item-hover-charges/);
  assert.match(hover,/buxa-item-use-effect-copy/);
  assert.match(css,/--buxa-rarity-accent/);
  assert.match(css,/\.buxa-item-hover-tooltip \.buxa-item-use-effect/);
  assert.match(entry,/153-item-use-presentation\.css/);
});
