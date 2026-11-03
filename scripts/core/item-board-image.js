import { normalizeSceneItemVisualLayout } from './scene-item-visual-layout.js';
/** Persisted artwork defaults shared by item templates, inventory instances and scene drops. */
export function normalizeItemBoardImage(value) {
  const source=value && typeof value==='object' ? value : {};
  const number=(field,fallback,min,max)=>{
    const raw=source[field];
    if (raw == null || typeof raw==='boolean' || !['number','string'].includes(typeof raw) ||
        (typeof raw==='string' && !raw.trim())) return fallback;
    const n=Number(raw);
    return Number.isFinite(n)
      ? Math.max(min,Math.min(max,n)) : fallback;
  };
  return {
    size:Math.round(number('size',76,20,800)),
    rotation:((number('rotation',0,-3600,3600)%360)+360)%360,
    opacity:Number(number('opacity',1,0.05,1).toFixed(2)),
    sceneFx:normalizeSceneItemVisualLayout(source.sceneFx)
  };
}
export function itemBoardImageOf(value) {
  const flags=value?.flags ?? value?.data?.flags;
  return normalizeItemBoardImage(flags?.buxaframework?.item?.boardImage);
}
