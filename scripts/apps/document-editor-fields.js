/** Declarative, side-effect-free editor schema and opt-in update builders.
 * Keep bulk changes narrowly scoped: no object-wide replacement, no implicit
 * writes to unselected fields, and no updates to embedded documents. */
import { MODULE_ID } from "../core/constants.js";

const choice = (value, label) => ({ value: String(value), label });
const choices = (values) => values.map(([value, label]) => choice(value,label));
const optionFrom = (source, fallback) => {
  const values = source && typeof source === "object" ? Object.entries(source) : [];
  return values.length ? values.map(([value, entry]) => choice(value, entry?.label || entry?.name || value)) : fallback;
};
const input = (key, label, type="number", extras={}) => ({ key, label, type, ...extras });
// Sliders are intentionally capped at a useful everyday range. The numeric
// input keeps the full Foundry range available; the slider expands to match
// typed out-of-range values without silently clamping document values.
const SLIDER_LIMITS = {
  "prototypeToken.width": 10, "prototypeToken.height": 10,
  "prototypeToken.texture.scaleX": 3, "prototypeToken.texture.scaleY": 3,
  "prototypeToken.alpha": 1, "prototypeToken.rotation": 360,
  "prototypeToken.sight.range": 120, "prototypeToken.sight.angle": 360,
  "prototypeToken.sight.attenuation": 1,
  "prototypeToken.light.dim": 120, "prototypeToken.light.bright": 120,
  "prototypeToken.light.angle": 360, "prototypeToken.light.alpha": 1,
  "prototypeToken.light.animation.speed": 10,
  "prototypeToken.light.animation.intensity": 10
};
const FIELD_HELP = {
  "prototypeToken.width":"Grid squares across", "prototypeToken.height":"Grid squares high",
  "prototypeToken.texture.scaleX":"Artwork horizontal scale", "prototypeToken.texture.scaleY":"Artwork vertical scale",
  "prototypeToken.alpha":"Token transparency", "prototypeToken.rotation":"Token facing",
  "prototypeToken.sight.range":"Distance in scene units", "prototypeToken.sight.angle":"Field of view",
  "prototypeToken.sight.attenuation":"Falloff near the edges",
  "prototypeToken.light.dim":"Soft light distance", "prototypeToken.light.bright":"Full light distance",
  "prototypeToken.light.angle":"Light spread", "prototypeToken.light.alpha":"Light color strength",
  "prototypeToken.light.animation.speed":"Light animation speed",
  "prototypeToken.light.animation.intensity":"Light animation strength",
  "prototypeToken.bar1.attribute":"Path to the first resource",
  "prototypeToken.bar2.attribute":"Path to the second resource"
};
const actorFields = (canvasConfig={}) => [
  { id:"general", label:"Actor", icon:"fa-user", fields:[
    input("name","Actor name","text"),
    input("img","Portrait image","text", {placeholder:"icons/..."}),
    input("system.traits.size","Creature size","select", {options:choices([["tiny","Tiny"],["sm","Small"],["med","Medium"],["lg","Large"],["huge","Huge"],["grg","Gargantuan"]]), optional:true})
  ]},
  { id:"token",label:"Token",icon:"fa-chess-pawn",fields:[
    input("prototypeToken.name","Token name","text"),
    input("prototypeToken.texture.src","Token artwork","text",{placeholder:"icons/..."}),
    input("prototypeToken.width","Width (grid cells)","number",{min:0.5,max:100,step:0.5}),
    input("prototypeToken.height","Height (grid cells)","number",{min:0.5,max:100,step:0.5}),
    input("prototypeToken.texture.scaleX","Image scale X","number",{min:0.1,max:10,step:0.1}),
    input("prototypeToken.texture.scaleY","Image scale Y","number",{min:0.1,max:10,step:0.1}),
    input("prototypeToken.alpha","Opacity","number",{min:0,max:1,step:0.05}),
    input("prototypeToken.disposition","Disposition","select",{options:choices([[-1,"Hostile"],[0,"Neutral"],[1,"Friendly"],[2,"Secret"]])}),
    input("prototypeToken.displayName","Show name","select",{options:choices([[0,"Never"],[10,"Control"],[20,"Hover"],[30,"Owner hover"],[40,"Owner"],[50,"Always"]])}),
    input("prototypeToken.displayBars","Show bars","select",{options:choices([[0,"Never"],[10,"Control"],[20,"Hover"],[30,"Owner hover"],[40,"Owner"],[50,"Always"]])}),
    input("prototypeToken.rotation","Rotation","number",{min:0,max:360,step:1}),
    input("prototypeToken.actorLink","Link actor data","checkbox"),
    input("prototypeToken.lockRotation","Lock rotation","checkbox"),
    input("prototypeToken.bar1.attribute","Bar 1 attribute","text",{placeholder:"attributes.hp"}),
    input("prototypeToken.bar2.attribute","Bar 2 attribute","text",{placeholder:"attributes.spell"})
  ]},
  { id:"vision",label:"Vision",icon:"fa-eye",fields:[
    input("prototypeToken.sight.enabled","Token has vision","checkbox"),
    input("prototypeToken.sight.range","Vision range","number",{min:0,max:100000,step:1}),
    input("prototypeToken.sight.angle","Vision angle","number",{min:0,max:360,step:1}),
    input("prototypeToken.sight.visionMode","Vision mode","select",{options:optionFrom(canvasConfig.visionModes,choices([["basic","Basic"],["darkvision","Darkvision"]]))}),
    input("prototypeToken.sight.color","Sight color","color"),
    input("prototypeToken.sight.attenuation","Vision attenuation","number",{min:0,max:1,step:0.05})
  ]},
  { id:"detection",label:"Detection",icon:"fa-radar",fields:[
    input("detection","Detection mode & range","detection",{options:optionFrom(canvasConfig.detectionModes,choices([["basicSight","Basic sight"],["seeInvisibility","See invisibility"],["feelTremor","Tremorsense"]]))})
  ]},
  { id:"light",label:"Light",icon:"fa-lightbulb",fields:[
    input("prototypeToken.light.dim","Dim radius","number",{min:0,max:100000,step:1}),
    input("prototypeToken.light.bright","Bright radius","number",{min:0,max:100000,step:1}),
    input("prototypeToken.light.angle","Light angle","number",{min:0,max:360,step:1}),
    input("prototypeToken.light.color","Light color","color"),
    input("prototypeToken.light.alpha","Color intensity","number",{min:0,max:1,step:0.05}),
    input("prototypeToken.light.animation.type","Animation","select",{options:optionFrom(canvasConfig.lightAnimations,choices([["","None"],["torch","Torch"],["pulse","Pulse"]]))}),
    input("prototypeToken.light.animation.speed","Animation speed","number",{min:1,max:10,step:1}),
    input("prototypeToken.light.animation.intensity","Animation intensity","number",{min:1,max:10,step:1})
  ]}
];
const itemFields = rarities => [
  {id:"item",label:"Item",icon:"fa-gem",fields:[
    input("img","Item artwork","text",{placeholder:"icons/..."}),
    input(`flags.${MODULE_ID}.item.rarityId`,"Rarity","select",{options:rarities.map(r=>choice(r.id,r.label))}),
    input("system.quantity","Quantity","number",{min:0,max:100000,step:1}),
    input("item.weight","Weight","number",{min:0,max:100000,step:0.01}),
    input(`flags.${MODULE_ID}.item.multiple.enabled`,"Stackable","checkbox"),
    input(`flags.${MODULE_ID}.item.equip.enabled`,"Can equip","checkbox"),
    input("system.equipped","Equipped","checkbox",{optional:true})
  ]}
];
export function editorSections(kind, {canvasConfig={},rarities=[]}={}) { return kind==="Actor" ? actorFields(canvasConfig) : itemFields(rarities); }
/** Foundry V14 can expose prototype detection modes as a Collection,
 * keyed object or plain array, depending on document/data-model state.
 * Resolve the shape once, without mutating any original token data.
 */
export function detectionModeEntries(token) {
  const raw = token?.detectionModes;
  const read = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (Array.isArray(value.contents)) return value.contents;
    if (value instanceof Map) return [...value.entries()].map(([id, entry]) => {
      const data = entry?.toObject?.() ?? entry;
      return {...(data && typeof data === "object" ? data : {}), id: data?.id ?? id};
    });
    if (typeof value.values === "function") {
      const entries = Array.from(value.values());
      if (entries.length) return entries;
    }
    if (typeof value.toObject === "function") {
      const plain = value.toObject();
      if (plain && plain !== value) return read(plain);
    }
    if (typeof value === "object") {
      return Object.entries(value).filter(([, entry]) => entry && typeof entry === "object")
        .map(([id, entry]) => ({...entry, id: entry.id ?? id}));
    }
    return [];
  };
  // Prefer the model value, but fall back to serialized data for unusual
  // Foundry collections whose custom getters aren't enumerable.
  let entries = read(raw);
  if (!entries.length && typeof token?.toObject === "function") {
    entries = read(token.toObject()?.detectionModes);
  }
  return entries.map(entry => {
    const data = typeof entry?.toObject === "function" ? entry.toObject() : entry;
    return data && typeof data === "object" ? {...data} : null;
  }).filter(entry => entry && typeof entry.id === "string");
}

export function valueAt(object,path) {
  if (path==="item.weight") {
    const weight = object?.system?.weight;
    return typeof weight === "object" ? weight?.value : weight;
  }
  if (path==="detection") return detectionModeEntries(object?.prototypeToken).find(x=>x.enabled!==false) ?? {id:"basicSight",range:0};
  return path.split(".").reduce((value,key)=>value?.[key],object);
}
export function fieldValue(doc,field) {
  const value = valueAt(doc,field.key);
  if (field.type === "checkbox") return value===true;
  if (field.type === "color") return /^#[0-9a-f]{6}$/i.test(value??"") ? value : "#ffffff";
  if (field.type === "select") return String(value ?? field.options?.[0]?.value ?? "");
  if (field.type === "number") return Number.isFinite(Number(value)) ? Number(value) : 0;
  if (field.type === "detection") return {id:String(value?.id??"basicSight"),range:Number(value?.range)||0};
  return String(value ?? "");
}
export function editorView(kind,doc,opts={}) { return editorSections(kind,opts).map(section=>({
  ...section, fields:section.fields.filter(f=>!f.optional || valueAt(doc,f.key)!==undefined)
    .map(f=>({...f, value:fieldValue(doc,f), isCheck:f.type==="checkbox", isSelect:f.type==="select",isNumber:f.type==="number",isColor:f.type==="color",isDetection:f.type==="detection",isText:f.type==="text", detectionSliderMax:f.type==="detection"?Math.max(120,Number(fieldValue(doc,f).range)||0):120, isArtwork:["img","prototypeToken.texture.src"].includes(f.key),
      isWide:["name","img","prototypeToken.name","prototypeToken.texture.src","prototypeToken.bar1.attribute","prototypeToken.bar2.attribute","detection"].includes(f.key),
      hasSlider:f.type==="number" && SLIDER_LIMITS[f.key]!==undefined,
      sliderMin:f.min??0,sliderMax:Math.max(SLIDER_LIMITS[f.key]??0,fieldValue(doc,f)),
      help:FIELD_HELP[f.key]??"",
      options:f.options?.map(o=>({...o,selected:String(o.value)===String(fieldValue(doc,f))})) ?? [],
      detectionOptions:f.type==="detection"?f.options.map(o=>({...o,selected:o.value===fieldValue(doc,f).id})):[],
      selected:fieldValue(doc,f)===true}))
})); }
const finite = (raw,f) => {
  const number = Number(raw);
  if (!Number.isFinite(number) || String(raw).trim()==="") throw new Error(`${f.label} requires a number.`);
  if (f.min!==undefined && number<f.min || f.max!==undefined && number>f.max) throw new Error(`${f.label} is out of range.`);
  return number;
};
/** Flat dotted-key patch; Foundry updateDocuments accepts these without altering siblings. */
export function buildDocumentPatch(doc,kind,values,applied,{canvasConfig={},rarities=[]}={}) {
  const patch={};
  for (const group of editorSections(kind,{canvasConfig,rarities})) for(const f of group.fields) {
    if (!applied.has(f.key) || f.optional && valueAt(doc,f.key)===undefined) continue;
    let next = values[f.key];
    if (f.type==="checkbox") next = next===true;
    else if (f.type==="number") next=finite(next,f);
    else if(f.type==="select") {next=String(next??"");if(!f.options.some(o=>o.value===next)) throw new Error(`Invalid ${f.label}.`);if(["prototypeToken.disposition","prototypeToken.displayName","prototypeToken.displayBars"].includes(f.key)) next=Number(next);}
    else if(f.type==="color") { next=String(next??""); if(!/^#[0-9a-f]{6}$/i.test(next))throw new Error(`Invalid ${f.label}.`);}
    else if(f.type==="detection") {
      const id=String(next?.id??""); if(!f.options.some(o=>o.value===id))throw new Error("Invalid detection mode.");
      const range=finite(next?.range,{label:"Detection range",min:0,max:100000});
      const existing=detectionModeEntries(doc.prototypeToken);
      const matching=existing.find(m=>m.id===id);
      next=[...existing.filter(m=>m.id!==id),{...(matching??{}),id,range,enabled:true}];
      if(JSON.stringify(next)!==JSON.stringify(existing)) patch["prototypeToken.detectionModes"]=next;
      continue;
    } else next=String(next??"").trim();
    const path=f.key==="item.weight" ? typeof doc?.system?.weight==="object"?"system.weight.value":"system.weight" :f.key;
    if (JSON.stringify(valueAt(doc,f.key))!==JSON.stringify(next)) patch[path]=next;
  }
  return patch;
}
export function getEditorValues(root,kind,opts={}) {
  const formValues={},applied=new Set();
  for(const section of editorSections(kind,opts))for(const f of section.fields) {
    const field=root.querySelector(`[data-buxa-edit-field="${f.key}"]`);
    if (!field) continue;
    if(opts.onlyTouched && !field.dataset.buxaTouched) continue;
    const on=field.querySelector("[data-buxa-apply]");
    if(on && !on.checked) continue;
    applied.add(f.key);
    if(f.type==="detection") formValues[f.key]={id:field.querySelector('[data-buxa-detection-type]')?.value,range:field.querySelector('[data-buxa-detection-range]')?.value};
    else {const input=field.querySelector("[data-buxa-value]");formValues[f.key]=f.type==="checkbox"?!!input?.checked:input?.value;}
  }
  return {formValues,applied};
}
