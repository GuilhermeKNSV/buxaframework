/** Optional Sequencer integration for physical scene item interactions.
 * Buxa never requires Sequencer or an external asset pack. The GM chooses an
 * animation file in Addons; an empty path disables playback safely. */
import { getSheetConfig } from '../core/config.js';

export function sequencerAssetPath(value) {
  const path=String(value??'').trim().replace(/\\/g,'/');
  // Never interpret arbitrary URLs, data URIs or dangerous traversal as assets.
  if (!path || path.length>500 || /^(?:[a-z]+:|\/|\\)/i.test(path) || path.split('/').includes('..')) return '';
  return /\.(?:webm|mp4|gif|png|webp|svg)$/i.test(path) ? path : '';
}

export function canPlaySceneItemFx(config=getSheetConfig(), modules=globalThis.game?.modules) {
  return config?.addons?.sequencer?.enabled === true
    && modules?.get?.('sequencer')?.active === true
    && typeof globalThis.Sequence === 'function'
    && Boolean(sequencerAssetPath(config.addons.sequencer.effectFile));
}

export function playSceneItemFx(record, options={}) {
  try {
    if (!record || !globalThis.canvas?.ready || !canPlaySceneItemFx()) return false;
    const file=sequencerAssetPath(getSheetConfig().addons.sequencer.effectFile);
    const x=Number(record.x),y=Number(record.y),size=Number(record.size)||76;
    if (!Number.isFinite(x)||!Number.isFinite(y)) return false;
    const sequence=new globalThis.Sequence();
    const effect=sequence.effect().file(file).atLocation({x:x+size/2,y:y+size/2});
    effect.fadeIn?.(160);
    effect.fadeOut?.(240);
    const played=sequence.play();
    Promise.resolve(played).catch(error=>console.warn('buxaframework | Optional scene VFX failed.',error));
    return true;
  } catch(error) {
    console.warn('buxaframework | Optional scene VFX unavailable.',error);
    return false;
  }
}
