import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildDocumentPatch, fieldValue, editorSections, editorView, valueAt, detectionModeEntries, getEditorValues } from "../scripts/apps/document-editor-fields.js";
import { genericCardData } from "../scripts/apps/world-directory-shared.js";

const canvasConfig={visionModes:{basic:{label:"Basic"},darkvision:{label:"Darkvision"}},detectionModes:{basicSight:{label:"Basic"},seeInvisibility:{label:"Invisible"}},lightAnimations:{"":{label:"None"},torch:{label:"Torch"}}};
const rarities=[{id:"common",label:"COMMON"},{id:"epic",label:"EPIC"}];
const settings={canvasConfig,rarities};
function actor(id,range,enabled=false){return {id,documentName:"Actor",name:`Actor ${id}`,img:"a.webp",system:{traits:{size:"med"}},prototypeToken:{width:1,height:1,sight:{enabled,range,angle:360,visionMode:"basic"},texture:{src:"token.png",scaleX:1,scaleY:1},detectionModes:[{id:"basicSight",enabled:true,range:30},{id:"seeInvisibility",enabled:false,range:5}],light:{bright:0,dim:0}}};}
function item(){return {id:"i1",documentName:"Item",img:"item.webp",system:{quantity:4,weight:{value:2,units:"lb"},equipped:false},flags:{buxaframework:{item:{rarityId:"common",multiple:{enabled:false},equip:{enabled:true}}}}};}
test("actor editor covers vision, size, token lighting and detection tabs",()=>{
  const sections=editorSections("Actor",settings);
  assert.deepEqual(sections.map(s=>s.id),["general","token","vision","detection","light"]);
  const fields=sections.flatMap(s=>s.fields.map(f=>f.key));
  for(const f of ["prototypeToken.sight.enabled","prototypeToken.sight.range","prototypeToken.sight.visionMode","prototypeToken.width","prototypeToken.height","detection","prototypeToken.light.bright","prototypeToken.texture.src"])assert.ok(fields.includes(f));
  assert.ok(editorView("Actor",actor("1",20),settings)[2].fields.some(f=>f.key==="prototypeToken.sight.enabled"&&!f.selected));
});
test("bulk actor vision patch only updates enabled and range",()=>{
  const docs=[actor("1",40),actor("2",90,true)];
  const applied=new Set(["prototypeToken.sight.enabled","prototypeToken.sight.range"]);
  const values={"prototypeToken.sight.enabled":true,"prototypeToken.sight.range":"30","prototypeToken.width":"100"};
  const a=buildDocumentPatch(docs[0],"Actor",values,applied,settings);
  const b=buildDocumentPatch(docs[1],"Actor",values,applied,settings);
  assert.deepEqual(a,{"prototypeToken.sight.enabled":true,"prototypeToken.sight.range":30});
  assert.deepEqual(b,{"prototypeToken.sight.range":30});
  assert.equal("prototypeToken.width" in a,false);
});
test("actor patch allows different token size and vision mode, retains other options",()=>{
  const doc=actor("3",15);
  const patch=buildDocumentPatch(doc,"Actor",{"prototypeToken.width":"2","prototypeToken.height":"3","prototypeToken.sight.visionMode":"darkvision"},new Set(["prototypeToken.width","prototypeToken.height","prototypeToken.sight.visionMode"]),settings);
  assert.deepEqual(patch,{"prototypeToken.width":2,"prototypeToken.height":3,"prototypeToken.sight.visionMode":"darkvision"});
});
test("detection patch merges a mode and preserves other detection modes",()=>{
  const doc=actor("3",20);
  const patch=buildDocumentPatch(doc,"Actor",{detection:{id:"seeInvisibility",range:"45"}},new Set(["detection"]),settings);
  assert.deepEqual(patch["prototypeToken.detectionModes"],[{id:"basicSight",enabled:true,range:30},{id:"seeInvisibility",enabled:true,range:45}]);
});
test("item bulk rarity, quantity and stack updates do not reset existing configurations",()=>{
  const doc=item();
  const patch=buildDocumentPatch(doc,"Item",{"flags.buxaframework.item.rarityId":"epic","system.quantity":"6","flags.buxaframework.item.multiple.enabled":true},new Set(["flags.buxaframework.item.rarityId","system.quantity","flags.buxaframework.item.multiple.enabled"]),settings);
  assert.deepEqual(patch,{"flags.buxaframework.item.rarityId":"epic","system.quantity":6,"flags.buxaframework.item.multiple.enabled":true});
  assert.equal(Object.keys(patch).some(k=>k.includes("increases")||k.includes("dice")),false);
});
test("item weight field respects dnd5e weight.value schema",()=>{
  const patch=buildDocumentPatch(item(),"Item",{"item.weight":"6.5"},new Set(["item.weight"]),settings);
  assert.deepEqual(patch,{"system.weight.value":6.5});
});
test("invalid numeric values and unknown select options are rejected",()=>{
  assert.throws(()=>buildDocumentPatch(actor("4",10),"Actor",{"prototypeToken.sight.range":"NaN"},new Set(["prototypeToken.sight.range"]),settings));
  assert.throws(()=>buildDocumentPatch(actor("4",10),"Actor",{"prototypeToken.sight.visionMode":"imaginary"},new Set(["prototypeToken.sight.visionMode"]),settings));
  assert.throws(()=>buildDocumentPatch(item(),"Item",{"system.quantity":"-1"},new Set(["system.quantity"]),settings));
});
test("editor package contains Buxa tab template, batch selector and CSS",()=>{
  const template=fs.readFileSync(new URL("../templates/document-editor.hbs",import.meta.url),"utf8");
  const dir=fs.readFileSync(new URL("../scripts/apps/directory-multi-edit.js",import.meta.url),"utf8");
  const generic=fs.readFileSync(new URL("../scripts/apps/world-directory-generic.js",import.meta.url),"utf8");
  const item=fs.readFileSync(new URL("../scripts/apps/item-directory-view.js",import.meta.url),"utf8");
  assert.match(template,/data-buxa-edit-tab/);
  assert.match(template,/data-buxa-apply/);
  assert.match(dir,/Multi edit/);
  assert.match(generic,/openActorEditor/);
  assert.match(item,/directoryMultiEdit/);
  assert.match(fs.readFileSync(new URL("../styles/buxa.css",import.meta.url),"utf8"),/128-document-editor.css/);
});


test("V14 detection collection formats do not crash the Actor editor", () => {
  const expected = [{id:"basicSight",enabled:true,range:30},{id:"seeInvisibility",enabled:false,range:5}];
  const variants = [
    expected,
    new Map(expected.map(e => [e.id,e])),
    {contents:expected},
    {basicSight:expected[0],seeInvisibility:expected[1]},
    {toObject:() => ({basicSight:expected[0],seeInvisibility:expected[1]})},
    {values:() => expected.values()},
    {contents:expected.map(e => ({toObject:() => ({...e})}))}
  ];
  for(const detectionModes of variants) {
    const doc=actor("v14",20);
    doc.prototypeToken.detectionModes=detectionModes;
    assert.deepEqual(detectionModeEntries(doc.prototypeToken),expected);
    assert.deepEqual(valueAt(doc,"detection"),expected[0]);
    assert.doesNotThrow(() => editorView("Actor",doc,settings));
    const patch=buildDocumentPatch(doc,"Actor",{detection:{id:"seeInvisibility",range:"40"}},new Set(["detection"]),settings);
    assert.deepEqual(patch["prototypeToken.detectionModes"],[expected[0],{...expected[1],enabled:true,range:40}]);
    assert.deepEqual(detectionModeEntries(doc.prototypeToken),expected,"source collection remains unchanged");
  }
});

test("detect unchanged mode does not write a collection back unnecessarily", () => {
  const doc=actor("v14-unchanged",30);
  doc.prototypeToken.detectionModes = new Map([["basicSight",{id:"basicSight",range:30,enabled:true}]]);
  const patch=buildDocumentPatch(doc,"Actor",{detection:{id:"basicSight",range:"30"}},new Set(["detection"]),settings);
  assert.deepEqual(patch,{});
});

test("editor skips optional or absent fields before accessing touched flag", () => {
  const root={querySelector:()=>null};
  const state=getEditorValues(root,"Actor",{...settings,onlyTouched:true});
  assert.deepEqual(state.formValues,{});
  assert.deepEqual([...state.applied],[]);
});

test("scene directory does not access deprecated Scene.background getter", () => {
  const scene={width:2000,height:1600,thumb:"scene-thumb.webp"};
  Object.defineProperty(scene,"background",{get(){throw Error("Scene#background deprecated");}});
  assert.equal(genericCardData(scene,"Scene").image,"scene-thumb.webp");
  const noThumb={width:2000,height:1600};
  Object.defineProperty(noThumb,"background",{get(){throw Error("Scene#background deprecated");}});
  assert.equal(genericCardData(noThumb,"Scene").image,"icons/svg/direction.svg");
});
