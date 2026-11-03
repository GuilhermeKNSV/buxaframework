/** Lightweight preview-only geometry. Never mutates a TokenDocument or canvas.
 * Coordinates are in the fixed SVG viewport (320 × 300). */
import { detectionModeEntries } from "./document-editor-fields.js";
const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number.isFinite(Number(value))?Number(value):min));
const numeric=(value,fallback=0)=>Number.isFinite(Number(value))&&value!==""&&value!==null?Number(value):fallback;
const RAD=Math.PI/180;
const point=(cx,cy,r,deg)=>({x:cx+Math.cos(deg*RAD)*r,y:cy+Math.sin(deg*RAD)*r});
const pos=p=>`${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
/** SVG filled cone for radius/angle; two arcs for the full-circle case. */
export function sectorPath(radius,angle=360,rotation=0) {
  const r=clamp(radius,0,140),a=clamp(angle,0,360);
  if(r<=0||a<=0)return "";
  const cx=160,cy=150,forward=-90+numeric(rotation);
  if(a>=359.99){
    const a1=point(cx,cy,r,forward),a2=point(cx,cy,r,forward+180);
    return `M ${pos(a1)} A ${r} ${r} 0 1 1 ${pos(a2)} A ${r} ${r} 0 1 1 ${pos(a1)} Z`;
  }
  const p1=point(cx,cy,r,forward-a/2),p2=point(cx,cy,r,forward+a/2);
  return `M ${cx} ${cy} L ${pos(p1)} A ${r} ${r} 0 ${a>180?1:0} 1 ${pos(p2)} Z`;
}
const get = (source,path) => path.split(".").reduce((o,k)=>o?.[k],source);
const tokenField=(root,doc,key)=>{
  const field=root?.querySelector?.(`[data-buxa-edit-field="${key}"]`);
  if(field){
    // Bulk changes are previews of the *selected* changes applied to the first actor.
    const apply=field.querySelector("[data-buxa-apply]");
    if(!apply||apply.checked){
      const input=field.querySelector("[data-buxa-value]");
      if(input)return input.type==="checkbox"?input.checked:input.value;
    }
  }
  if(key==="detection")return detectionModeEntries(doc?.prototypeToken).find(x=>x.enabled!==false)??{id:"basicSight",range:0};
  return get(doc,key);
};
export function previewState(doc,values={}){
  const read=(key,fallback)=>Object.hasOwn(values,key)?values[key]:(get(doc,key)??fallback);
  const width=clamp(read("prototypeToken.width",1),0.5,100);
  const height=clamp(read("prototypeToken.height",1),0.5,100);
  const image=String(read("prototypeToken.texture.src",doc?.img||"icons/svg/mystery-man.svg")||doc?.img||"icons/svg/mystery-man.svg");
  return {
    name:String(read("prototypeToken.name",doc?.name||"Token")||doc?.name||"Token"),image,
    width,height,scaleX:clamp(read("prototypeToken.texture.scaleX",1),0.1,10),scaleY:clamp(read("prototypeToken.texture.scaleY",1),0.1,10),
    opacity:clamp(read("prototypeToken.alpha",1),0,1),rotation:clamp(read("prototypeToken.rotation",0),0,360),
    sightEnabled:read("prototypeToken.sight.enabled",false)===true||read("prototypeToken.sight.enabled",false)==="true",
    sightRange:clamp(read("prototypeToken.sight.range",0),0,100000),sightAngle:clamp(read("prototypeToken.sight.angle",360),0,360),
    sightColor:String(read("prototypeToken.sight.color","#80bce8")||"#80bce8"),
    dim:clamp(read("prototypeToken.light.dim",0),0,100000),bright:clamp(read("prototypeToken.light.bright",0),0,100000),
    lightAngle:clamp(read("prototypeToken.light.angle",360),0,360),lightColor:String(read("prototypeToken.light.color","#f4b45f")||"#f4b45f"),
    lightAlpha:clamp(read("prototypeToken.light.alpha",0.5),0,1),
    detectionRange:clamp(read("detection",{range:0})?.range??0,0,100000),
    detectionMode:String(read("detection",{id:"basicSight"})?.id??"basicSight")
  };
}
export function syncRangePair(field,target){
  if(!field||!target)return;
  const range=field.querySelector("[data-buxa-range]"),number=field.querySelector('[data-buxa-value][type="number"], [data-buxa-detection-range]');
  if(!range||!number)return;
  if(target===range){number.value=range.value;}
  else if(target===number){
    const value=numeric(number.value,0);
    const originalMax = Number(range.dataset?.buxaConfiguredMax ?? range._buxaConfiguredMax ?? range.max);
    if (!range.dataset?.buxaConfiguredMax && !range._buxaConfiguredMax) {
      if (range.dataset) range.dataset.buxaConfiguredMax = range.max;
      else range._buxaConfiguredMax = range.max;
    }
    range.max = String(Math.max(originalMax, number.value !== '' ? value : originalMax));
    range.value = String(clamp(value,Number(range.min),Number(range.max)));
  }
  const min=numeric(range.min),max=numeric(range.max,1),v=clamp(range.value,min,max);
  range.style.setProperty("--buxa-range-progress",`${max>min?100*(v-min)/(max-min):0}%`);
}
const footprint=(n)=>Number.isInteger(n)?String(n):n.toFixed(1);
const SCALAR=0.85;
function geometry(state){
  const cell=Math.min(42,200/Math.max(state.width,state.height,1));
  return {
    tokenWidth:Math.max(12,state.width*cell),tokenHeight:Math.max(12,state.height*cell),
    sight:state.sightEnabled?sectorPath(22+state.sightRange*SCALAR,state.sightAngle,state.rotation):"",
    detection:state.detectionRange>0?sectorPath(22+state.detectionRange*SCALAR,360):"",
    dim:state.dim>0?sectorPath(22+state.dim*SCALAR,state.lightAngle,state.rotation):"",
    bright:state.bright>0?sectorPath(22+state.bright*SCALAR,state.lightAngle,state.rotation):""
  };
}
/** DOM update uses only unsaved form state. Throttle-free and limited to one preview. */
export function updateTokenPreview(root,doc){
  const panel=root?.querySelector?.(".buxa-edit-preview");
  if(!panel||!doc)return;
  const keys=["prototypeToken.name","prototypeToken.texture.src","prototypeToken.width","prototypeToken.height","prototypeToken.texture.scaleX","prototypeToken.texture.scaleY","prototypeToken.alpha","prototypeToken.rotation","prototypeToken.sight.enabled","prototypeToken.sight.range","prototypeToken.sight.angle","prototypeToken.sight.color","prototypeToken.light.dim","prototypeToken.light.bright","prototypeToken.light.angle","prototypeToken.light.color","prototypeToken.light.alpha","detection"];
  const values=Object.fromEntries(keys.map(key=>[key,tokenField(root,doc,key)]));
  const state=previewState(doc,values),geo=geometry(state);
  const el=selector=>panel.querySelector(selector);
  const image=el("[data-buxa-preview-image]");
  if(image){if(image.getAttribute("src")!==state.image)image.src=state.image;image.style.transform=`scale(${state.scaleX},${state.scaleY})`;}
  const token=el("[data-buxa-preview-token]");
  if(token){token.style.width=`${geo.tokenWidth}px`;token.style.height=`${geo.tokenHeight}px`;token.style.opacity=String(state.opacity);token.style.setProperty("--buxa-token-rotation",`${state.rotation}deg`);}
  for(const [key,path,fill] of [["detection",geo.detection,"#76c6aa"],["sight",geo.sight,state.sightColor],["dim",geo.dim,state.lightColor],["bright",geo.bright,state.lightColor]]){
    const node=el(`[data-buxa-preview-${key}]`);
    if(node){node.setAttribute("d",path);node.style.fill=/^#[0-9a-f]{6}$/i.test(fill)?fill:(key==="sight"?"#80bce8":"#f4b45f");node.style.opacity=key==="sight"?"0.17":key==="detection"?"0.11":String(Math.min(0.38,Math.max(0.08,state.lightAlpha*(key==="dim"?0.28:0.48))));}
  }
  const named=el("[data-buxa-preview-name]");if(named)named.textContent=state.name;
  const size=el("[data-buxa-preview-footprint]");if(size)size.textContent=`${footprint(state.width)} × ${footprint(state.height)} grid cells`;
  const sight=el("[data-buxa-preview-sight-label]");if(sight)sight.textContent=state.sightEnabled?`Sight ${state.sightRange}`:"Vision off";
  const light=el("[data-buxa-preview-light-label]");if(light)light.textContent=state.bright||state.dim?`Light ${state.bright} / ${state.dim}`:"No light";
  const detection=el("[data-buxa-preview-detection-label]");if(detection)detection.textContent=state.detectionRange?`Detection ${state.detectionRange}`:"No detection";
  // Paint slider progress without writing to the authoritative number field.
  // This matters while typing partial numbers (empty, decimal point, etc.).
  root.querySelectorAll("[data-buxa-range]").forEach(range=>{
    const min=numeric(range.min),max=numeric(range.max,1),value=clamp(range.value,min,max);
    range.style.setProperty("--buxa-range-progress",`${max>min?100*(value-min)/(max-min):0}%`);
  });
}
