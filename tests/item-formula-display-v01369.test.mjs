import test from 'node:test';
import assert from 'node:assert/strict';
import {formatItemDiceFormula} from '../scripts/core/item-formula-display.js';
import {resolveItemDice} from '../scripts/core/item-dice.js';
import {itemUseView} from '../scripts/apps/item-use-actions.js';
import {formatResourceEffect} from '../scripts/core/item-use-config.js';

globalThis.foundry={utils:{getProperty:(obj,path)=>String(path).split('.').reduce((v,k)=>v?.[k],obj)}};
globalThis.game={system:{id:'dnd5e'}};
const cfg={resources:[{id:'hp',label:'HP'}],attributes:{entries:[{
  id:'int',label:'Intelligence', modifier:{enabled:true,everyPoints:5}, rebirth:{enabled:false}
}]},proficiencies:{entries:[]}};
const actor={id:'actor',documentName:'Actor',isOwner:true,items:[],getFlag:()=>undefined};
const item=(rules={})=>({id:'potion',parent:actor,flags:{buxaframework:{item:rules}},getFlag(scope,key){return this.flags?.[scope]?.[key];}});
const attr={enabled:true,attributeId:'int',faces:4};
const mod={source:'attribute',id:'int'};

test('resource tooltip resolves attribute-derived dice and numeric zero modifier',()=>{
 const potion=item({resourceEffects:[{resourceId:'hp',action:'fill',timing:'after',amountType:'dice',attributeDice:attr,modifier:mod,flat:0}]});
 const rule=itemUseView(potion,cfg).resourceEffects[0];
 assert.equal(rule.amountText,'1d4 + 0');
 assert.equal(rule.label,'HP');
});
test('resource effect uses same dice resolver as normal item damage tooltip',()=>{
 const potion=item({resourceEffects:[{resourceId:'hp',action:'fill',timing:'after',amountType:'dice',attributeDice:attr,modifier:mod,flat:2}]});
 assert.equal(itemUseView(potion,cfg).resourceEffects[0].amountText,
   resolveItemDice(potion,{attributeDice:attr,modifier:mod,flat:2},{actor,config:cfg}).displayFormula);
});
test('all dice display normalizes sign, spacing, decimals and zero bonuses',()=>{
 assert.equal(formatItemDiceFormula({count:2,faces:8,bonus:0}),'2d8 + 0');
 assert.equal(formatItemDiceFormula({count:2,faces:8,bonus:-3}),'2d8 - 3');
 assert.equal(formatItemDiceFormula({count:1,faces:4,bonus:3.5}),'1d4 + 3.5');
 assert.equal(resolveItemDice(item(),{count:3,faces:6,modifier:{source:'none'},flat:0},{actor,config:cfg}).displayFormula,'3d6 + 0');
});
test('world Item preview marks unresolved modifiers and keeps formula notation',()=>{
 const world=item();world.parent=null;
 const displayed=resolveItemDice(world,{attributeDice:attr,modifier:mod,flat:0},{actor:null,config:cfg});
 assert.equal(displayed.displayFormula,'1d4 + 0 + Intelligence MOD');
 assert.equal(displayed.formula,'0'); // runtime has no owning Actor to resolve dice
});
test('text-only Resource rule fallback also uses normal dice notation',()=>{
 assert.equal(formatResourceEffect({amountType:'dice',count:2,faces:10,flat:-1,modifier:{source:'none'},action:'fill',timing:'after'},'HP'),
  'Restore 2d10 - 1 HP · After roll');
});
