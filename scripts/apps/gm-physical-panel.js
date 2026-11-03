/** Compact slide-out GM controls, reserved tabs for future modules. */
import { MODULE_ID } from '../core/constants.js';
import { notifySuccess, notifyError } from '../core/notifications.js';
import { PHYSICAL_SETTINGS, normalizePhysicalSettings } from '../core/physical-items.js';
import { registerTrashcanView, trashcanState, setTrashcanSelecting, trashcanDeleteSelected, setTrashcanMainSelecting, trashcanDeleteSelectedMain, trashcanDeleteNativeItem } from './gm-trashcan.js';
let panel=null;
let opener=null;
let activeTab='looting';
const fields = [
  { id:'dropDistance', label:'Item dropping range', suffix:'ft', min:0,max:200,description:'Maximum distance from the linked character to drop items.' },
  { id:'lootDistance', label:'Loot interaction range', suffix:'ft', min:0,max:200,description:'How close a linked character must be to loot.' },
  { id:'moveDistance', label:'Player movement interaction range',suffix:'ft',min:0,max:200,description:'How close a linked character must be to move an item.' },
  { id:'maxMoveDistance', label:'Maximum item movement',suffix:'ft',min:0,max:200,description:'Maximum distance from the item’s original position per drag.' }
];
const getPolicy=()=>normalizePhysicalSettings(game.settings.get(MODULE_ID,PHYSICAL_SETTINGS));
function markup() {
  const config=getPolicy();
  return `<header class="buxa-gm-head"><div><small>BUXA CONTROL CENTER</small><h3>GM Controls</h3></div><button type="button" data-close aria-label="Close GM controls">×</button></header>
    <nav class="buxa-gm-tabs"><button class="is-active" type="button">ITEM</button></nav>
    <nav class="buxa-gm-subtabs"><button type="button" data-gm-tab="looting" class="${activeTab==='looting'?'is-active':''}">LOOTING</button><button type="button" data-gm-tab="trash" class="${activeTab==='trash'?'is-active':''}"><i class="fa-solid fa-trash-can"></i> TRASHCAN</button></nav>
    <div class="buxa-gm-content"><div data-gm-pane="looting" ${activeTab==='looting'?'':'hidden'}>
      <section class="buxa-gm-group"><div class="buxa-gm-group-title"><strong>Item visibility</strong><small>Control what the GM sees on the board</small></div>
      <label class="buxa-gm-switch"><span><strong>GM Item View</strong><small>On: GMs always see all dropped items. Off: item visibility follows controlled or explicitly linked characters' sight.</small></span><input type="checkbox" data-setting="gmItemView" ${config.gmItemView?'checked':''}><i></i></label></section>
      <section class="buxa-gm-group"><div class="buxa-gm-group-title"><strong>Item looting</strong><small>Rules for physical items on the scene</small></div>
      <label class="buxa-gm-switch"><span><strong>Enable looting</strong><small>Allow characters to collect scene items</small></span><input type="checkbox" data-setting="lootEnabled" ${config.lootEnabled?'checked':''}><i></i></label>
      <label class="buxa-gm-switch"><span><strong>Always show loot</strong><small>On: show item names and rarity effects all the time. Off: reveal them when the item is right-clicked.</small></span><input type="checkbox" data-setting="alwaysShowLoot" ${config.alwaysShowLoot?'checked':''}><i></i></label>
      ${fields.filter(field=>field.id==='lootDistance').map(field=>rangeField(field,config)).join('')}</section>
      <section class="buxa-gm-group"><div class="buxa-gm-group-title"><strong>Item dropping</strong><small>Where players can place items from inventory</small></div>
      <label class="buxa-gm-switch"><span><strong>Limit player item dropping distance</strong><small>When off, players may drop items anywhere on the scene</small></span><input type="checkbox" data-setting="playerDropRangeEnabled" ${config.playerDropRangeEnabled?'checked':''}><i></i></label>
      ${fields.filter(field=>field.id==='dropDistance').map(field=>rangeField(field,config)).join('')}
      <label class="buxa-gm-switch"><span><strong>Show drop-distance outline</strong><small>Show the linked character's allowed drop radius while dragging an item onto the scene.</small></span><input type="checkbox" data-setting="showDropRangeOutline" ${config.showDropRangeOutline?'checked':''}><i></i></label></section>
      <section class="buxa-gm-group"><div class="buxa-gm-group-title"><strong>Item movement</strong><small>Players move physical items directly on the canvas</small></div>
      <label class="buxa-gm-switch"><span><strong>Players may move items</strong><small>The GM can always reposition items</small></span><input type="checkbox" data-setting="playerMoveEnabled" ${config.playerMoveEnabled?'checked':''}><i></i></label>
      ${fields.filter(field=>['moveDistance','maxMoveDistance'].includes(field.id)).map(field=>rangeField(field,config)).join('')}</section>
      <button class="buxa-gm-save" data-save type="button">Save rules</button></div>
      <section data-gm-pane="trash" class="buxa-gm-trash-pane" ${activeTab==='trash'?'':'hidden'}>
        <div class="buxa-gm-trash-zone" data-buxa-trash-zone role="region" aria-label="Drop an Item here to delete it">
          <i class="fa-solid fa-trash-can" aria-hidden="true"></i><strong>DROP ITEM TO DELETE</strong>
        </div>
        <button type="button" class="buxa-gm-trash-select" data-trash-select aria-pressed="${trashcanState().selecting}">${trashcanState().selecting?'Cancel selection':'Select scene items'}</button>
        <div class="buxa-gm-trash-selection" data-trash-selection ${trashcanState().selecting?'':'hidden'}>
          <span data-trash-count>${trashcanState().count} selected</span>
          <button type="button" data-trash-delete ${trashcanState().count?'':'disabled'}>Delete selected</button>
        </div>
        <button type="button" class="buxa-gm-trash-select" data-trash-main-select aria-pressed="${trashcanState().mainSelecting}">${trashcanState().mainSelecting?'Cancel selection':'Select Main Items'}</button>
        <div class="buxa-gm-trash-selection" data-trash-main-selection ${trashcanState().mainSelecting?'':'hidden'}>
          <span data-trash-main-count>${trashcanState().mainCount} selected</span>
          <button type="button" data-trash-main-delete ${trashcanState().mainCount?'':'disabled'}>Delete selected</button>
        </div>
      </section>
    </div>`;
}
function rangeField(field, config) {
  return `<label class="buxa-gm-range"><span><strong>${field.label}</strong><small>${field.description}</small></span>
    <div><input type="range" data-slider="${field.id}" min="${field.min}" max="${field.max}" step="1" value="${config[field.id]}">
    <input type="number" data-setting="${field.id}" min="${field.min}" max="${field.max}" step="1" value="${config[field.id]}"><span>${field.suffix}</span></div></label>`;
}
function toggle(open) {
  if(!panel)return;
  const state=open===undefined?!panel.classList.contains('is-open'):open;
  panel.classList.toggle('is-open',state);
  opener?.setAttribute('aria-expanded',String(state));
  opener?.classList.toggle('is-open',state);
  if(!state) { setTrashcanSelecting(false); setTrashcanMainSelecting(false); }
  if(state)panel.innerHTML=markup();
  // Let other nonmodal Buxa controls follow the GM panel's visibility without
  // coupling their positioning to its internal markup or stored settings.
  if(typeof globalThis.CustomEvent === 'function')
    globalThis.document?.dispatchEvent?.(new CustomEvent('buxa:gm-controls-toggled',{detail:{open:state}}));
}
async function save() {
  const config={...getPolicy()};
  for(const field of ['lootEnabled','alwaysShowLoot','gmItemView','playerMoveEnabled','playerDropRangeEnabled','showDropRangeOutline',...fields.map(f=>f.id)]){
    const input=panel?.querySelector(`[data-setting="${field}"]`);
    config[field]=input?.type==='checkbox'?Boolean(input.checked):Number(input?.value);
  }
  const button=panel?.querySelector('[data-save]');if(button)button.disabled=true;
  try{await game.settings.set(MODULE_ID,PHYSICAL_SETTINGS,normalizePhysicalSettings(config));notifySuccess('Physical item settings saved.');}
  catch(error){notifyError(error.message);}
  finally{if(button?.isConnected)button.disabled=false;}
}
export function installGmPhysicalPanel() {
  if (!game.user?.isGM || opener) return;
  opener=document.createElement('button');opener.type='button';opener.className='buxa-gm-opener';
  opener.setAttribute('aria-label','Open Buxa GM controls');opener.setAttribute('aria-expanded','false');
  opener.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square"/></svg>';
  panel=document.createElement('aside');panel.className='buxa-gm-panel';panel.setAttribute('aria-label','Buxa GM controls');
  document.body.append(opener,panel);
  opener.addEventListener('click',()=>toggle());
  registerTrashcanView(()=>{
    if(!panel?.isConnected)return;
    const state=trashcanState();
    const button=panel.querySelector('[data-trash-select]');
    if(button){button.textContent=state.selecting?'Cancel selection':'Select scene items';button.setAttribute('aria-pressed',String(state.selecting));}
    const group=panel.querySelector('[data-trash-selection]');if(group)group.hidden=!state.selecting;
    const count=panel.querySelector('[data-trash-count]');if(count)count.textContent=`${state.count} selected`;
    const del=panel.querySelector('[data-trash-delete]');if(del)del.disabled=!state.count;
    const main=panel.querySelector('[data-trash-main-select]');
    if(main){main.textContent=state.mainSelecting?'Cancel selection':'Select Main Items';main.setAttribute('aria-pressed',String(state.mainSelecting));}
    const mainGroup=panel.querySelector('[data-trash-main-selection]');if(mainGroup)mainGroup.hidden=!state.mainSelecting;
    const mainCount=panel.querySelector('[data-trash-main-count]');if(mainCount)mainCount.textContent=`${state.mainCount} selected`;
    const mainDelete=panel.querySelector('[data-trash-main-delete]');if(mainDelete)mainDelete.disabled=!state.mainCount;
  });
  panel.addEventListener('click',event=>{
    const tab=event.target.closest('[data-gm-tab]');
    if(tab){
      activeTab=tab.dataset.gmTab;
      for(const button of panel.querySelectorAll('[data-gm-tab]'))button.classList.toggle('is-active',button===tab);
      for(const pane of panel.querySelectorAll('[data-gm-pane]'))pane.hidden=pane.dataset.gmPane!==activeTab;
    }
    if(event.target.closest('[data-trash-select]'))setTrashcanSelecting(!trashcanState().selecting);
    if(event.target.closest('[data-trash-delete]'))void trashcanDeleteSelected();
    if(event.target.closest('[data-trash-main-select]'))setTrashcanMainSelecting(!trashcanState().mainSelecting);
    if(event.target.closest('[data-trash-main-delete]'))void trashcanDeleteSelectedMain();
    if(event.target.closest('[data-close]'))toggle(false);
    if(event.target.closest('[data-save]'))void save();
  });
  panel.addEventListener('dragover',event=>{
    if(!game.user?.isGM||!event.target.closest('[data-buxa-trash-zone]'))return;
    event.preventDefault();event.dataTransfer.dropEffect='move';
    panel.querySelector('[data-buxa-trash-zone]')?.classList.add('is-over');
  });
  panel.addEventListener('dragleave',event=>{
    if(!event.relatedTarget?.closest?.('[data-buxa-trash-zone]'))panel.querySelector('[data-buxa-trash-zone]')?.classList.remove('is-over');
  });
  panel.addEventListener('drop',event=>{
    const slot=event.target.closest('[data-buxa-trash-zone]');
    if(!slot||!game.user?.isGM)return;
    event.preventDefault();event.stopPropagation();slot.classList.remove('is-over');
    const raw=event.dataTransfer?.getData('text/plain')||event.dataTransfer?.getData('text')||'';
    void trashcanDeleteNativeItem(raw);
  });
  panel.addEventListener('input',event=>{
    const target=event.target;
    const other=target.matches('[data-slider]')?panel.querySelector(`[data-setting="${target.dataset.slider}"]`)
      :target.matches('[data-setting]')?panel.querySelector(`[data-slider="${target.dataset.setting}"]`):null;
    if(other)other.value=target.value;
  });
}
