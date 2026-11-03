import { numericField } from './numeric-field.js';
/** Stack-dependent artwork. Thresholds belong to item rules, never item quantity state.
 * Pure, safe normalization allows old Items to retain their ordinary artwork. */
const clamp=(value,defaultValue,min,max)=>{
  return numericField(value,defaultValue,min,max);
};
export function normalizeStackImages(input) {
  if(!Array.isArray(input))return [];
  const unique=new Map();
  for(const raw of input.slice(0,64)){
    if(!raw || typeof raw!=='object')continue;
    const at=Math.round(clamp(raw.at,2,2,999999));
    const mode=raw.mode==='custom'?'custom':'image';
    const layers=(Array.isArray(raw.layers)?raw.layers:[]).slice(0,12).map(layer=>({
      img:String(layer?.img||'').trim().slice(0,1024),
      x:clamp(layer?.x,50,-50,150),y:clamp(layer?.y,50,-50,150),
      size:clamp(layer?.size,55,5,250),rotation:clamp(layer?.rotation,0,-3600,3600),
      opacity:clamp(layer?.opacity,1,0.05,1)
    })).filter(layer=>layer.img);
    const image=String(raw.img||'').trim().slice(0,1024);
    if(mode==='image' && !image || mode==='custom' && !layers.length)continue;
    unique.set(at,{at,mode,img:image,layers});
  }
  return [...unique.values()].sort((a,b)=>a.at-b.at).slice(0,32);
}
export function stackArtworkFor(data,quantity=1) {
  const source=data?.flags?.buxaframework?.item ?? data?.getFlag?.('buxaframework','item') ?? data;
  const base=String(data?.img||data?.data?.img||'icons/svg/item-bag.svg');
  const rules=source?.multiple;
  if(rules?.enabled!==true)return {img:base,layers:[],custom:false};
  const rule=normalizeStackImages(rules.stackImages).filter(entry=>quantity>=entry.at).at(-1);
  if(!rule)return {img:base,layers:[],custom:false};
  return rule.mode==='image'?{img:rule.img,layers:[],custom:false}:
    {img:base,layers:rule.layers.map(layer=>({...layer,style:`left:${layer.x}%;top:${layer.y}%;width:${layer.size}%;transform:translate(-50%,-50%) rotate(${layer.rotation}deg);opacity:${layer.opacity}`})),custom:true};
}
/** HTML only for the plain ground-container renderer; template views use Handlebars escaping. */
export function stackArtworkMarkup(art,escape) {
  if(!art.custom)return `<img src="${escape(art.img)}" alt="" draggable="false">`;
  return `<span class="buxa-stack-composite">${art.layers.map(layer=>`<img src="${escape(layer.img)}" style="${escape(layer.style)}" alt="" draggable="false">`).join('')}</span>`;
}
