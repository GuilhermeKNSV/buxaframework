/** Persistable offsets/scales for the click-to-loot beam and nameplate. */
const number=(v,fallback,min,max)=>{
  if(v==null || typeof v==='boolean' || !['number','string'].includes(typeof v) ||
    (typeof v==='string' && !v.trim()))return fallback;
  const n=Number(v);
  return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;
};
export function normalizeSceneItemVisualLayout(input) {
  const source=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
  const normalize=type=>{
    const entry=source[type]&&typeof source[type]==='object'?source[type]:{};
    return {x:Math.round(number(entry.x,0,-500,500)),y:Math.round(number(entry.y,0,-500,500)),scale:Math.round(number(entry.scale,1,.3,4)*100)/100};
  };
  return {beam:normalize('beam'),label:normalize('label')};
}
/** Keep tiny ground items legible without creating outsize pancake shadows. */
export function groundFxSize(visibleWidth,visibleHeight,rarityTier=0) {
  const size=value=>value==null || typeof value==='boolean' || !['string','number'].includes(typeof value) ||
    (typeof value==='string'&&!value.trim()) || !Number.isFinite(Number(value)) ? 76 : Math.max(1,Number(value));
  const w=size(visibleWidth);
  const h=size(visibleHeight);
  const longest=Math.max(w,h);
  const factor=Math.max(.62,Math.min(800/76,longest/76));
  const footprint=Math.max(28,Math.min(160,w));
  const radius=rarityTier>2?33:31;
  return {factor,footprint,groundX:Math.max(.4,Math.min(2.8,footprint/(radius*2*factor))),
    groundY:Math.max(.38,Math.min(1,h/Math.max(longest,38)))};
}
