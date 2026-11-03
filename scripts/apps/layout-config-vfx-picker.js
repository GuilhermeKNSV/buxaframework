/** Optional Sequencer asset picker for the Addons page. Does not save until the
 * normal configuration Save action, so unsaved sibling settings are preserved. */

export async function openSequencerAssetPicker(app) {
  const input=app?.element?.querySelector?.('[data-addon-sequencer-asset]');
  if (!input) return;
  const { BuxaAssetBrowser } = await import('./asset-browser.js');
  new BuxaAssetBrowser({
    type:'image',
    extensions:['webm','mp4','gif','png','webp','svg'],
    source:'data',
    target:'',
    current:input.value,
    allowClear:true,
    title:'Buxa · Select scene-item VFX asset',
    onSelect:async path => {input.value=String(path??'');}
  }).render({force:true});
}

export function setGameIconsFolder(app) {
  const root=app?.element;
  const source=root?.querySelector?.('[data-addon-icon-source-source]');
  const path=root?.querySelector?.('[data-addon-icon-source-path]');
  if(!source||!path)return false;
  source.value='data';
  path.value='modules/game-icons-net/whitebackgrounds';
  const display=root.querySelector('[data-addon-icon-source-display]');
  if(display) display.textContent=path.value;
  const type=root.querySelector('[data-addon-icon-source-source-display]');
  if(type)type.textContent='USER DATA';
  return true;
}
