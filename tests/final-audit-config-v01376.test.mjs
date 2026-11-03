import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve,dirname } from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const BASE=process.env.BUXA_AUDIT_BASE||resolve(dirname(fileURLToPath(import.meta.url)),'..');
const imp=file=>import(pathToFileURL(resolve(BASE,'scripts/core',file)).href);
globalThis.foundry={utils:{deepClone:structuredClone,randomID:()=>"abc123"}};
const {normalizeSheetConfig}=await imp('config.js');
const clean=v=>normalizeSheetConfig(v);
const attr=[{id:'str',label:'Strength',ability:'str',modifier:{enabled:'false'},rebirth:{enabled:'false',lockModifier:'false'},icon:{enabled:'false'}}];
const prof=[{id:'acrobatics',label:'Acrobatics',enabled:'false',icon:{enabled:'false'},features:{dice:'false',reroll:'false',number:'false',modifier:'false'}}];
const choices=[
 ['player-sheet make-default permission',{makeDefault:'false'},v=>v.makeDefault,false],
 ['level system disabled',{level:{enabled:'false'}},v=>v.level.enabled,false],
 ['attribute minimization disabled',{attributes:{allowCollapse:'false'}},v=>v.attributes.allowCollapse,false],
 ['attribute points disabled',{attributes:{points:{enabled:'false'}}},v=>v.attributes.points.enabled,false],
 ['attribute point refunds disabled',{attributes:{points:{playersCanDecrease:'false'}}},v=>v.attributes.points.playersCanDecrease,false],
 ['attribute direct entry disabled',{attributes:{points:{directValueEntry:'false'}}},v=>v.attributes.points.directValueEntry,false],
 ['attribute negatives disabled',{attributes:{points:{allowBelowZero:'false'}}},v=>v.attributes.points.allowBelowZero,false],
 ['attribute modifier disabled',{attributes:{entries:attr}},v=>v.attributes.entries[0].modifier.enabled,false],
 ['rebirth disabled',{attributes:{entries:attr}},v=>v.attributes.entries[0].rebirth.enabled,false],
 ['rebirth modifier cap disabled',{attributes:{entries:attr}},v=>v.attributes.entries[0].rebirth.lockModifier,false],
 ['attribute icon disabled',{attributes:{entries:attr}},v=>v.attributes.entries[0].icon.enabled,false],
 ['SVG addon disabled',{addons:{svgIcons:{enabled:'false'}}},v=>v.addons.svgIcons.enabled,false],
 ['carousel addon disabled',{addons:{carouselTracker:{enabled:'false'}}},v=>v.addons.carouselTracker.enabled,false],
 ['DR stat disabled',{otherStats:{damageReduction:{enabled:'false'}}},v=>v.otherStats.damageReduction.enabled,false],
 ['initiative stat disabled',{otherStats:{initiative:{enabled:'false'}}},v=>v.otherStats.initiative.enabled,false],
 ['HP current/max synchronization disabled',{resources:[{id:'hp',syncCurrentOnMax:'false'}]},v=>v.resources[0].syncCurrentOnMax,false],
 ['custom resource current/max synchronization disabled',{resources:[{id:'custom',label:'Stamina',syncCurrentOnMax:'false'}]},v=>v.resources.find(x=>x.id==='custom').syncCurrentOnMax,false],
 ['proficiency system disabled',{proficiencies:{enabled:'false'}},v=>v.proficiencies.enabled,false],
 ['proficiency points disabled',{proficiencies:{points:{enabled:'false'}}},v=>v.proficiencies.points.enabled,false],
 ['proficiency refunds disabled',{proficiencies:{points:{playersCanDecrease:'false'}}},v=>v.proficiencies.points.playersCanDecrease,false],
 ['proficiency negatives disabled',{proficiencies:{points:{allowBelowZero:'false'}}},v=>v.proficiencies.points.allowBelowZero,false],
 ['proficiency entry disabled',{proficiencies:{entries:prof}},v=>v.proficiencies.entries[0].enabled,false],
 ['proficiency icon disabled',{proficiencies:{entries:prof}},v=>v.proficiencies.entries[0].icon.enabled,false],
 ['proficiency dice disabled',{proficiencies:{entries:prof}},v=>v.proficiencies.entries[0].features.dice,false],
 ['proficiency reroll disabled',{proficiencies:{entries:prof}},v=>v.proficiencies.entries[0].features.reroll,false],
 ['proficiency number disabled',{proficiencies:{entries:prof}},v=>v.proficiencies.entries[0].features.number,false],
 ['proficiency modifier disabled',{proficiencies:{entries:prof}},v=>v.proficiencies.entries[0].features.modifier,false],
 ['weight capacity disabled',{inventory:{weight:{enabled:'false'}}},v=>v.inventory.weight.enabled,false],
 ['equipment snap disabled',{inventory:{equipmentLayout:{snapToGrid:'false'}}},v=>v.inventory.equipmentLayout.snapToGrid,false],
 ['Complex auto-sort enabled',{inventory:{complex:{autoSort:'true'}}},v=>v.inventory.complex.autoSort,true],
];
for(const [name,raw,select,expected] of choices){
 test(`saved world settings respect the ${name} checkbox`,()=>assert.equal(select(clean(raw)),expected));
}
// Literal booleans must retain their meaning, including options defaulting ON.
for(const [name,raw,select,expected] of [
 ['enabled literal level',{level:{enabled:true}},v=>v.level.enabled,true],
 ['default-on attribute collapse',{attributes:{}},v=>v.attributes.allowCollapse,true],
 ['default-on carousel',{addons:{}},v=>v.addons.carouselTracker.enabled,true],
 ['proficiency entry enabled by default',{proficiencies:{entries:[{label:'Luck'}]}},v=>v.proficiencies.entries[0].enabled,true],
 ['auto-sort defaults off',{inventory:{complex:{}}},v=>v.inventory.complex.autoSort,false],
])test(`boolean compatibility: ${name}`,()=>assert.equal(select(clean(raw)),expected));
