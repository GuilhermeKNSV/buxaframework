import { applyRarityVisual } from '../core/rarity-visuals.js';
import { itemBoardImageOf } from '../core/item-board-image.js';
/** Lightweight HTML controls: ask stack quantity, show Loot on a clicked scene image. */
import { MODULE_ID } from '../core/constants.js';
import { notifySuccess, notifyError } from '../core/notifications.js';
import { normalizePhysicalSettings, PHYSICAL_SETTINGS, physicalQuantity } from '../core/physical-items.js';
import { requestPhysicalAction } from '../integrations/physical-item-transfers.js';
import { playSceneItemFx } from '../integrations/scene-item-sequencer.js';
import { rarityTier } from '../core/rarity-tier.js';

const esc = text => String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let openMenu;
const notify = (message, error = false) => error ? notifyError(message) : notifySuccess(message);
export function closePhysicalLootMenu() { if (openMenu?._buxaClose) openMenu._buxaClose(); else {openMenu?.remove();openMenu=null;} }
export function promptPhysicalQuantity(item) {
  const total=Number(item?.system?.quantity ?? 1);
  if (!Number.isSafeInteger(total) || total < 1) return Promise.resolve(null);
  if (total === 1) return Promise.resolve(1);
  return new Promise(resolve=>{
    const cover=document.createElement('div'); cover.className='buxa-physical-quantity-backdrop';
    cover.innerHTML=`<section class="buxa-physical-quantity" role="dialog" aria-modal="true" aria-label="Drop quantity">
      <header><span>DROP ITEMS</span><strong>${esc(item.name)}</strong></header>
      <p>Choose how many to place on the scene. Available: <b>${total}</b></p>
      <div class="buxa-physical-quantity-row"><button type="button" data-decrement aria-label="Decrease quantity">−</button><input type="number" min="1" max="${total}" step="1" value="${total}"><button type="button" data-increment aria-label="Increase quantity">+</button></div>
      <footer><button type="button" data-cancel>Cancel</button><button type="button" data-submit>Drop on scene</button></footer></section>`;
    document.body.append(cover);
    const input=cover.querySelector('input'); let finished=false;
    const close = value=> { if(finished)return;finished=true; document.removeEventListener('keydown',key,true);cover.remove();resolve(value); };
    const valid = () => Number.isSafeInteger(input.valueAsNumber) && input.valueAsNumber>=1 && input.valueAsNumber<=total;
    const submit =()=> {if(valid())close(input.valueAsNumber);else {input.setCustomValidity(`Enter 1 to ${total}`);input.reportValidity();}};
    const key=event=>{if(event.key==='Escape'){event.preventDefault();close(null);} if(event.key==='Enter'){event.preventDefault();submit();}};
    cover.querySelector('[data-cancel]').addEventListener('click',()=>close(null));
    cover.querySelector('[data-submit]').addEventListener('click',submit);
    cover.querySelector('[data-decrement]').addEventListener('click',()=>{input.value=Math.max(1,Number(input.value||1)-1);});
    cover.querySelector('[data-increment]').addEventListener('click',()=>{input.value=Math.min(total,Number(input.value||0)+1);});
    cover.addEventListener('pointerdown',e=>{if(e.target===cover)close(null);});
    document.addEventListener('keydown',key,true);input.focus();input.select();
  });
}
export async function physicalDropFromItem(item, payload) {
  const quantity=await promptPhysicalQuantity(item);
  if (!quantity) return false;
  try {await requestPhysicalAction({...payload,action:'drop',quantity});return true;}
  catch(error){notify(error.message,true);return false;}
}
/** Diablo-style pickup nameplate for a scene Item. No scene
 * document writes happen when this opens. Permissions are still enforced by the
 * transfer API. The canvas rarity beam is revealed behind the artwork. */
export function openPhysicalLootMenu({ item, sceneId, point, anchorPoint=point, getAnchor, rarity, onReveal, onClose, onEdit, onOpen,
  canEdit=false, canLoot=true, hasStorage=false, disableLooting=false }) {
  closePhysicalLootMenu();
  if (!globalThis.document?.createElement || !globalThis.document?.body?.append) return false;
  const policy=normalizePhysicalSettings(game.settings.get(MODULE_ID,PHYSICAL_SETTINGS));
  const allowTake=canLoot && policy.lootEnabled && !disableLooting;
  if (!allowTake && !hasStorage && !canEdit) return false;
  const accent=/^#[0-9a-f]{6}$/i.test(rarity?.color)?rarity.color:'#90a3bb';
  const itemName=String(item?.data?.name || 'Item');
  const quantity=physicalQuantity(item);
  const label=`${itemName}${quantity>1?` x${quantity}`:''}`;
  const primaryAction = hasStorage ? 'open' : (allowTake ? 'loot' : null);
  if (!primaryAction) return false;
  const element=document.createElement('aside');
  element.className='buxa-physical-loot-label buxa-scene-item-menu';
  const theme=applyRarityVisual(element,rarity);
  element.style.setProperty('--loot-accent',theme.glowColor);
  element.style.setProperty('--loot-label-scale',String(itemBoardImageOf(item?.data).sceneFx.label.scale));
  element.setAttribute('role','menu');
  element.setAttribute('aria-label',`Scene item: ${label}`);
  element.setAttribute('data-tier',String(rarityTier(rarity)));
  element.setAttribute('data-rarity',String(rarity?.id||'common').toLowerCase().replace(/[^a-z0-9_-]/g,'-'));
  if (rarity?.spectrum) element.setAttribute('data-spectrum','');
  element.innerHTML=`<button type="button" role="menuitem" class="buxa-scene-item-nameplate" data-${primaryAction}>
      <i class="buxa-scene-item-wing is-left" aria-hidden="true"></i>
      <span class="buxa-scene-item-name">${esc(label)}</span>
      <i class="buxa-scene-item-wing is-right" aria-hidden="true"></i>
      <i class="buxa-scene-item-shine" aria-hidden="true"></i>
    </button>`;
  document.body.append(element);
  let busy=false, closed=false, cleanupTimer=0, positionFrame=0, lastLeft=null, lastTop=null;
  const place=()=>{
    const bounds=element.getBoundingClientRect();
    const menuWidth=element.offsetWidth||bounds.width;
    const menuHeight=element.offsetHeight||bounds.height;
    const viewportWidth=globalThis.window?.innerWidth||1024;
    const viewportHeight=globalThis.window?.innerHeight||768;
    let liveAnchor=null;
    try { liveAnchor=getAnchor?.() ?? null; } catch { /* Keep the last valid canvas anchor. */ }
    const anchor=liveAnchor ?? anchorPoint ?? point;
    const x=Number.isFinite(Number(anchor?.x)) ? Number(anchor.x) : viewportWidth/2;
    const y=Number.isFinite(Number(anchor?.y)) ? Number(anchor.y) : viewportHeight/2;
    const left=Math.round(Math.max(8,Math.min(viewportWidth-menuWidth-8,x-menuWidth/2)));
    const top=Math.round(Math.max(8,Math.min(viewportHeight-menuHeight-8,y-menuHeight-10)));
    if(left!==lastLeft){element.style.left=`${left}px`;lastLeft=left;}
    if(top!==lastTop){element.style.top=`${top}px`;lastTop=top;}
  };
  place();
  let dismissOutside;
  const teardown=()=>{
    if(closed)return false;
    closed=true;
    if(positionFrame)globalThis.cancelAnimationFrame?.(positionFrame);
    positionFrame=0;
    document.removeEventListener('pointerdown',dismissOutside,true);
    document.removeEventListener('keydown',handleKey,true);
    if(openMenu===element)openMenu=null;
    onClose?.();
    return true;
  };
  const dismiss=()=>{
    if(!teardown())return;
    element.remove();
  };
  const finishCollected=()=>{
    if(!teardown())return;
    element.classList?.add('is-collected');
    cleanupTimer=setTimeout(()=>element.remove(),520);
  };
  const handleKey=event=>{
    if(event.key==='Escape'){event.preventDefault();dismiss();}
  };
  dismissOutside=event=>{
    if(element.contains(event.target)||document.getElementById?.('board')?.contains?.(event.target))return;
    dismiss();
  };
  element.querySelector('[data-open]')?.addEventListener('click',()=>{dismiss();playSceneItemFx(item);onOpen?.();});
  element.querySelector('[data-loot]')?.addEventListener('click',async()=>{
    if(busy || !allowTake) return;
    busy=true;
    const button=element.querySelector('[data-loot]');
    button.disabled=true;
    try {
      await requestPhysicalAction({action:'loot',sceneId,itemId:item.id});
      notify(`${label} added to your linked character.`);
      playSceneItemFx(item);
      finishCollected();
    } catch(error) {
      notify(error?.message||'Could not take item.',true);
      if(!closed)button.disabled=false;
      busy=false;
    }
  });
  document.addEventListener('pointerdown',dismissOutside,true);
  document.addEventListener('keydown',handleKey,true);
  openMenu=element;
  element._buxaClose=dismiss;
  onReveal?.();
  if(getAnchor&&typeof globalThis.requestAnimationFrame==='function'){
    const track=()=>{positionFrame=0;if(closed)return;place();positionFrame=globalThis.requestAnimationFrame(track);};
    positionFrame=globalThis.requestAnimationFrame(track);
  }
  void cleanupTimer; void onEdit;
  return true;
}
