/** Floating, diffed Effect cards bound to an open Buxa Actor sheet. */
import { effectHudPlacement, effectHudClock } from './effect-hud-presentation.js';
import { getActiveEffects, removeEffectFromActor } from '../core/effect-runtime.js';
import { getEffectRarity, getEffectRules } from '../core/effect-config.js';
import { getSheetConfig } from '../core/config.js';
import { applyRarityVisual } from '../core/rarity-visuals.js';

const mounted = new WeakMap();
const open = new Set();
function findItem(actor,id) {
  return actor?.items?.get?.(id) ?? globalThis.game?.items?.get?.(id)
    ?? [...(actor?.items ?? [])].find(item=>item.id===id) ?? null;
}
function make(tag,className,text) {
  const node=document.createElement(tag);
  if (className) node.className=className;
  if (text != null) node.textContent=String(text);
  return node;
}
function layout(record) {
  const sheet=record.element,root=record.root;
  if (!sheet?.isConnected || !root?.isConnected) return;
  root.hidden = sheet.classList.contains('minimized') || sheet.getBoundingClientRect().height < 65;
  const position=effectHudPlacement(sheet.getBoundingClientRect(),window.innerWidth,window.innerHeight);
  root.classList.toggle('is-compact',position.compact);
  root.dataset.side=position.side;
  for(const key of ['width','left','top','maxHeight'])root.style[key]=`${position[key]}px`;
}
function createCard(record,entry,item,rules,config) {
  const card=make('article','bfx-effect-card');
  card.dataset.effectInstance=entry.instanceId;
  const rarity=getEffectRarity(item,config);
  applyRarityVisual(card,rarity);
  if (rarity.animated) card.dataset.aura=rarity.id;
  const art=make('span','bfx-effect-hud-art');
  const img=make('img');img.src=item.img || 'icons/svg/aura.svg';img.alt='';art.append(img);
  const stack=make('b','bfx-effect-hud-stack');art.append(stack);
  const details=make('span','bfx-effect-hud-copy');
  const title=make('strong','bfx-effect-hud-name',item.name);
  const timer=make('small','bfx-effect-hud-time');
  const openButton=make('button','bfx-effect-hud-open');openButton.type='button';
  openButton.addEventListener('click',()=>{
    const current=findItem(record.actor,entry.effectItemId);
    current?.sheet?.render?.({force:true});
  });
  details.append(title,timer);openButton.append(art,details);card.append(openButton);
  const meter=make('span','bfx-effect-hud-meter');meter.setAttribute('aria-hidden','true');card.append(meter);
  if(globalThis.game?.user?.isGM){
    const remove=make('button','bfx-effect-hud-remove','×');remove.type='button';remove.title='Remove effect';
    remove.setAttribute('aria-label',`Remove ${item.name}`);
    remove.addEventListener('click',async event=>{
      event.stopPropagation();remove.disabled=true;
      try{await removeEffectFromActor(record.actor,entry.instanceId);refreshActorEffectHuds(record.actor);}
      catch(error){console.error('Buxa | Could not remove effect',error);remove.disabled=false;}
    });card.append(remove);
  }
  card.classList.add('is-entering');record.root.append(card);
  (globalThis.requestAnimationFrame || (fn=>fn()))(() => card.classList.remove('is-entering'));
  return card;
}
function updateRecord(record){
  if(!record?.root?.isConnected)return;
  const config=getSheetConfig(),actor=record.actor;
  const seen=new Set();
  for(const entry of getActiveEffects(actor)){
    const item=findItem(actor,entry.effectItemId);
    if(!item)continue;
    // Do not show GM-only and hidden Effects to other players.
    const rules=getEffectRules(item,config);
    if(!globalThis.game?.user?.isGM && rules.visibility!=='revealed')continue;
    seen.add(entry.instanceId);
    let card=record.cards.get(entry.instanceId);
    if(!card){card=createCard(record,entry,item,rules,config);record.cards.set(entry.instanceId,card);}
    const timer=card.querySelector('.bfx-effect-hud-time');
    const clock=effectHudClock(entry,rules);
    if(timer){timer.textContent=clock.text;timer.classList.toggle('is-expiring',clock.expiring);}
    card.classList.toggle('is-expiring',clock.expiring);
    card.style.setProperty('--bfx-remaining',String(clock.ratio));
    card.querySelector('.bfx-effect-hud-meter').hidden=clock.permanent;
    const openButton=card.querySelector('.bfx-effect-hud-open');
    openButton.title=`${item.name} · ${clock.text}`;
    openButton.setAttribute('aria-label',`Open ${item.name}, ${clock.text}`);
    const rarity=getEffectRarity(item,config),signature=JSON.stringify(rarity);
    if(card.dataset.raritySignature!==signature){
      applyRarityVisual(card,rarity);card.dataset.raritySignature=signature;
      if(rarity.animated)card.dataset.aura=rarity.id;else delete card.dataset.aura;
    }
    card.querySelector('.bfx-effect-hud-remove')?.setAttribute('aria-label',`Remove ${item.name}`);
    const badge=card.querySelector('.bfx-effect-hud-stack');
    if(badge){badge.textContent=entry.stackCount>1?`×${entry.stackCount}`:'';badge.hidden=entry.stackCount<=1;}
    const name=card.querySelector('.bfx-effect-hud-name');if(name&&name.textContent!==item.name)name.textContent=item.name;
    const image=card.querySelector('.bfx-effect-hud-art img');if(image&&image.getAttribute('src')!==(item.img||'icons/svg/aura.svg'))image.src=item.img||'icons/svg/aura.svg';
  }
  for(const [id,card] of [...record.cards])if(!seen.has(id)){
    record.cards.delete(id);card.classList.add('is-leaving');
    const remove=()=>card.remove();
    if(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)remove();
    else{card.addEventListener('transitionend',remove,{once:true});setTimeout(remove,320);}
  }
  layout(record);
}
export function mountEffectHud(sheet){
  if(!sheet?.actor || !sheet?.element || !document?.body)return;
  let record=mounted.get(sheet);
  if(!record){
    const root=make('aside','bfx-effect-hud');root.setAttribute('aria-label','Active effects');
    document.body.append(root);
    record={sheet,actor:sheet.actor,element:sheet.element,root,cards:new Map(),resize:null,mutation:null,observers:[]};
    record.onResize=()=>layout(record);window.addEventListener('resize',record.onResize,{passive:true});
    mounted.set(sheet,record);open.add(record);
  }
  if(record.element!==sheet.element || (!record.resize && !record.mutation && !record.observers.length)){
    // Foundry may replace a sheet DOM node on render. Attach observers to the
    // replacement without disconnecting during reposition or reconciliation.
    // Every observer is released together when the HUD unmounts.
    for(const observer of record.observers)observer.disconnect();
    record.observers.length=0;
    record.element=sheet.element;
    record.resize=typeof ResizeObserver==='function'?new ResizeObserver(()=>layout(record)):null;
    record.mutation=typeof MutationObserver==='function'?new MutationObserver(()=>layout(record)):null;
    if(record.resize){record.resize.observe(record.element);record.observers.push(record.resize);}
    if(record.mutation){record.mutation.observe(record.element,{attributes:true,attributeFilter:['style','class']});record.observers.push(record.mutation);}
  }
  updateRecord(record);
}
export function unmountEffectHud(sheet){
  const record=mounted.get(sheet);if(!record)return;
  for(const observer of record.observers)observer.disconnect();
  record.observers.length=0;
  window.removeEventListener('resize',record.onResize);
  record.root.remove();record.cards.clear();open.delete(record);mounted.delete(sheet);
}
export function refreshActorEffectHuds(actor){for(const record of open)if(record.actor===actor || record.actor?.id===actor?.id)updateRecord(record);}
