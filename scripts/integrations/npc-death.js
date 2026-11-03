import {archiveEncounterDeaths} from '../core/combat-encounter-death.js';
/** GM-authoritative NPC death, scene loot publishing and corpse retrieval. */
import { MODULE_ID } from '../core/constants.js';
import { getSheetConfig } from '../core/config.js';
import { npcCorpseState, npcDropResource, npcDropTable, rollNpcDrops, uniqueNpcInventoryDrops } from '../core/npc-dropping.js';
import { getEffectiveResourceState } from '../core/resources.js';
import { physicalActiveGM, writePhysical } from './physical-item-transfers.js';
import { scenePhysicalItems, toPhysicalItem, physicalDropArtworkOrigin, physicalDistanceFt } from '../core/physical-items.js';
import { trackInventoryItem } from '../core/inventory.js';
import { notifyError, notifySuccess } from '../core/notifications.js';
const CHANNEL=`module.${MODULE_ID}`;
/** Convert browser coordinates to scene coordinates without asking a Token5e
 * display object for bounds. getBounds() can traverse unmounted Pixi children
 * and throw while a token is being destroyed or re-rendered. */
export function npcScreenPoint(event, activeCanvas=globalThis.canvas) {
  const renderer=activeCanvas?.app?.renderer;
  const surface=renderer?.canvas ?? activeCanvas?.app?.view;
  const rect=surface?.getBoundingClientRect?.();
  if(!rect?.width || !rect?.height)return null;
  const sx=(Number(event?.clientX)-rect.left)*(Number(renderer?.screen?.width)||rect.width)/rect.width;
  const sy=(Number(event?.clientY)-rect.top)*(Number(renderer?.screen?.height)||rect.height)/rect.height;
  if(!Number.isFinite(sx)||!Number.isFinite(sy))return null;
  const m=activeCanvas?.stage?.worldTransform;
  if(m && [m.a,m.b,m.c,m.d,m.tx,m.ty].every(Number.isFinite)) {
    const determinant=m.a*m.d-m.b*m.c;
    if(Math.abs(determinant)<1e-9)return null;
    return {x:(m.d*(sx-m.tx)-m.c*(sy-m.ty))/determinant,
      y:(-m.b*(sx-m.tx)+m.a*(sy-m.ty))/determinant};
  }
  const scale=Number(activeCanvas?.stage?.scale?.x)||1;
  return {x:(sx-(Number(activeCanvas?.stage?.position?.x)||0))/scale,
    y:(sy-(Number(activeCanvas?.stage?.position?.y)||0))/(Number(activeCanvas?.stage?.scale?.y)||scale)};
}
export function npcTokenScreenBounds(token,activeCanvas=globalThis.canvas){
  const doc=token?.document??token;
  const renderer=activeCanvas?.app?.renderer;
  const surface=renderer?.canvas??activeCanvas?.app?.view;
  const rect=surface?.getBoundingClientRect?.();
  if(!rect?.width||!rect?.height||!doc)return null;
  const cell=Math.max(1,Number(activeCanvas?.scene?.grid?.size??activeCanvas?.grid?.size)||100);
  const x=Number(doc.x),y=Number(doc.y),w=(Number(doc.width)||1)*cell,h=(Number(doc.height)||1)*cell;
  if(![x,y,w,h].every(Number.isFinite))return null;
  const m=activeCanvas?.stage?.worldTransform;
  const corners=[[x,y],[x+w,y],[x,y+h],[x+w,y+h]].map(([px,py])=>m&&[m.a,m.b,m.c,m.d,m.tx,m.ty].every(Number.isFinite)
    ? {x:m.a*px+m.c*py+m.tx,y:m.b*px+m.d*py+m.ty}
    : {x:px*(Number(activeCanvas?.stage?.scale?.x)||1)+(Number(activeCanvas?.stage?.position?.x)||0),
       y:py*(Number(activeCanvas?.stage?.scale?.y)||1)+(Number(activeCanvas?.stage?.position?.y)||0)});
  const xs=corners.map(p=>p.x),ys=corners.map(p=>p.y);
  const sw=Number(renderer?.screen?.width)||rect.width,sh=Number(renderer?.screen?.height)||rect.height;
  const left=rect.left+Math.min(...xs)*rect.width/sw,top=rect.top+Math.min(...ys)*rect.height/sh;
  return {left,top,width:(Math.max(...xs)-Math.min(...xs))*rect.width/sw,
    height:(Math.max(...ys)-Math.min(...ys))*rect.height/sh};
}
const locks=new Map(),requests=new Map();
const canKill=token=>Boolean(game.user?.isGM && token?.actor?.type==='npc' && token.document?.id &&
  token.actor.isOwner && !npcCorpseState(token) &&
  (()=>{const rule=npcDropResource(token.actor,getSheetConfig());
    return rule && getEffectiveResourceState(token.actor,rule,getSheetConfig()).current<=0;})());
const setState=(token,state)=>token.document.update({[`flags.${MODULE_ID}.npcLoot`]:state});
async function publishGround(token,state){
  const scene=token.document.parent ?? canvas.scene;
  if(!state.ground?.length)return {...state,groundPublished:true};
  const entries=scenePhysicalItems(scene);
  const used=new Set(entries.map(r=>r.id));
  const cell=Math.max(20,Number(scene.grid?.size)||100);
  const tx=Number(token.document.x)||0,ty=Number(token.document.y)||0;
  const tw=(Number(token.document.width)||1)*cell,th=(Number(token.document.height)||1)*cell;
  const origin={x:tx+tw/2,y:ty+th/2};
  const newly=[];
  const occurrences=new Map();
  for(let i=0;i<state.ground.length;i++){
    const drop=state.ground[i];
    // A drop table may deliberately contain the same entry more than once.
    // Preserve the original unsuffixed ID for the first copy (legacy saves),
    // then assign stable distinct IDs for subsequent occurrences.
    const base=`npc-${token.id}-${drop.id}`;
    const ordinal=occurrences.get(base)||0;
    occurrences.set(base,ordinal+1);
    const id=ordinal===0?base:`${base}-${ordinal+1}`;
    if(used.has(id))continue;
    // Spread drops around the body rather than stacking all art on the center.
    const angle=i*2.399963229728653,dist=cell*(.58+Math.sqrt(i)*.55);
    const center={x:origin.x+Math.cos(angle)*dist,y:origin.y+Math.sin(angle)*dist};
    const item={toObject:()=>structuredClone(drop.data)};
    const image=Number(drop.data?.flags?.[MODULE_ID]?.item?.boardImage?.size)||76;
    const location=physicalDropArtworkOrigin(center,image,scene) ?? physicalDropArtworkOrigin(origin,image,scene);
    if(!location)throw Error('The NPC loot artwork does not fit inside this scene.');
    newly.push(toPhysicalItem(item,drop.quantity,location,cell,id));
    used.add(id);
  }
  if(newly.length)await writePhysical(scene,[...entries,...newly]);
  return {...state,groundPublished:true};
}
async function removeCombatTurns(token){
  const sceneId=token.document.parent?.id || canvas.scene?.id;
  for(const combat of game.combats??[]){
    const ids=[...(combat.combatants??[])].filter(c=>c.tokenId===token.id && (c.sceneId||combat.scene?.id||combat.scene)==sceneId).map(c=>c.id);
    if(ids.length){
      const victims=[...(combat.combatants||[])].filter(c=>ids.includes(c.id));
      await archiveEncounterDeaths(combat,victims,{actorFor:member=>member?.token?.actor||token.actor,force:true});
    }
  }
}
export async function killNpcToken(token){
  if(!game.user?.isGM || !token?.document?.id || token.actor?.type!=='npc')throw Error('Only the GM can kill NPC tokens.');
  const key=`${token.document.parent?.id}:${token.id}`;
  if(locks.has(key))return locks.get(key);
  const work=(async()=>{
    let state=npcCorpseState(token);
    if(!state){
      if(!canKill(token))throw Error('This NPC has not reached zero HP.');
      const rolled=rollNpcDrops(npcDropTable(token.actor));
      state={killed:true,rolledAt:Date.now(),inventory:uniqueNpcInventoryDrops(rolled.filter(r=>r.destination==='inventory')),
        ground:rolled.filter(r=>r.destination==='ground'),groundPublished:false};
      // Save the roll before publishing anything. A retry reuses this exact roll.
      await setState(token,state);
    }
    await removeCombatTurns(token);
    if(!state.groundPublished){
      state=await publishGround(token,state);
      await setState(token,state);
    }
    // Ground-only drops leave no corpse inventory to access. Clear the token
    // from players' view only after every ground item has been saved.
    if(state.groundPublished && state.ground?.length && !state.inventory?.length && !token.document.hidden)
      await token.document.update({hidden:true});
    return state;
  })();
  locks.set(key,work);
  try {return await work;} finally {locks.delete(key);}
}
const corpseToken=(sceneId,tokenId)=>game.scenes?.get?.(sceneId)?.tokens?.get?.(tokenId);
const candidateRecipient=(user,scene,token)=>{
  const actors=[...(game.actors||[])].filter(a=>a.type==='character' &&
    (a.getFlag?.(MODULE_ID,'linkedUsers')?.includes?.(user.id) || (user.isGM && a.id===user.character?.id)) &&
    (user.isGM || a.testUserPermission?.(user,'OWNER')));
  // Ownership must be checked for the *requesting* user, not the GM executor.
  for(const actor of actors){
    if(!user.isGM && actor.testUserPermission && !actor.testUserPermission(user,'OWNER'))continue;
    const characterToken=[...(scene.tokens||[])].find(t=>t.actorId===actor.id && !t.hidden);
    if(!characterToken && !user.isGM)continue;
    if(characterToken){
      const cell=Number(scene.grid?.size)||100;
      const point={x:Number(characterToken.x)+(Number(characterToken.width)||1)*cell/2,
        y:Number(characterToken.y)+(Number(characterToken.height)||1)*cell/2};
      const corpse={x:Number(token.x)+(Number(token.width)||1)*cell/2,
        y:Number(token.y)+(Number(token.height)||1)*cell/2};
      if(!user.isGM && physicalDistanceFt(point,corpse,scene)>10)continue;
    }
    return actor;
  }
  return user.isGM?user.character??null:null;
};
/** Receipt persists on the transferred Item so a GM reconnect after a saved
 * creation cannot mint the same corpse drop a second time. */
const corpseReceipt=(sceneId,tokenId,entryId)=>`${sceneId}:${tokenId}:${entryId}`;
const actorItems=actor=>[...(actor?.items??[])];
const itemReceipt=item=>{
  try { return item?.getFlag?.(MODULE_ID,'corpseLootReceipt') ?? item?.flags?.[MODULE_ID]?.corpseLootReceipt; }
  catch { return item?.flags?.[MODULE_ID]?.corpseLootReceipt; }
};
async function removeCorpseItemAfterFailure(recipient,item,error) {
  if(!item?.id)return;
  try {
    await recipient.deleteEmbeddedDocuments('Item',[item.id]);
    if(recipient.items?.get?.(item.id))throw Error('Item still exists after deletion.');
  } catch(rollback) {
    console.error(`${MODULE_ID} | CRITICAL corpse loot rollback failed`,rollback);
    throw Error('Corpse transfer needs GM reconciliation: the created Item could not be safely removed. Do not retry.',{cause:error});
  }
}
export async function takeNpcCorpseItem({sceneId,tokenId,entryId,user}){
  if(!game.user?.isGM)throw Error('The GM must process NPC corpse loot.');
  const scene=game.scenes?.get?.(sceneId),token=corpseToken(sceneId,tokenId);
  if(!scene||!token||token.hidden&&!user?.isGM)throw Error('NPC corpse not available.');
  const key=`${sceneId}:${tokenId}`;
  const previous=locks.get(key)||Promise.resolve();
  const operation=previous.catch(()=>{}).then(async()=>{
    const state=token.getFlag?.(MODULE_ID,'npcLoot');
    if(!state?.killed)throw Error('This NPC is not killed.');
    const matching=state.inventory?.filter(r=>r.id===entryId) || [];
    if(matching.length>1)throw Error('Legacy corpse contains duplicate Item IDs; GM reconciliation is needed before pickup. No loot was removed.');
    const entry=matching[0];
    if(!entry)throw Error('That corpse item has already been taken.');
    const recipient=candidateRecipient(user,scene,token);
    if(!recipient)throw Error('You need a linked character token within 10 feet of the corpse.');
    const receipt=corpseReceipt(sceneId,tokenId,entryId);
    // A recovered committed creation belongs to its original recipient.
    // Never generate another copy merely because the source flag still
    // contains the entry after an interrupted transfer.
    const existing=[...(game.actors||[])].flatMap(actor=>actorItems(actor)
      .filter(item=>itemReceipt(item)===receipt).map(item=>({actor,item})));
    if(existing.length>1 || (existing.length && existing[0].actor.id!==recipient.id))
      throw Error('This corpse Item was already delivered elsewhere. GM reconciliation is required; do not retry.');
    const quantity=Number(entry.quantity);
    if(entry.quantity==null || typeof entry.quantity==='boolean' ||
        (typeof entry.quantity==='string' && !entry.quantity.trim()) ||
        !Number.isSafeInteger(quantity) || quantity<1 || quantity>1_000_000)
      throw Error('This corpse contains an invalid item quantity. Ask the GM to inspect its loot.');
    const data=structuredClone(entry.data);
    if(!data || typeof data!=='object' || Array.isArray(data) || typeof data.name!=='string' || !data.name.trim())
      throw Error('This corpse contains malformed Item data. Ask the GM to inspect its loot.');
    delete data._id;delete data._stats;
    if(!data.system || typeof data.system!=='object' || Array.isArray(data.system)) data.system={};
    data.system.quantity=quantity;
    if(!data.flags || typeof data.flags!=='object' || Array.isArray(data.flags))data.flags={};
    if(!data.flags[MODULE_ID] || typeof data.flags[MODULE_ID]!=='object' || Array.isArray(data.flags[MODULE_ID]))data.flags[MODULE_ID]={};
    data.flags[MODULE_ID].corpseLootReceipt=receipt;
    const createdBefore=new Set(actorItems(recipient).map(item=>item.id));
    let item=existing[0]?.item??null;
    try {
      if(!item){
        try {
          const created=await recipient.createEmbeddedDocuments('Item',[data]);
          item=created?.[0]??null;
        } catch(createError) {
          // Foundry hooks may throw after creating a document. Recover only
          // a uniquely identifiable, newly created Item from this attempt.
          const survivors=actorItems(recipient).filter(candidate=>
            !createdBefore.has(candidate.id) && itemReceipt(candidate)===receipt);
          if(survivors.length!==1) {
            if(survivors.length)throw Error('Ambiguous corpse Item creation requires GM reconciliation; do not retry.',{cause:createError});
            throw createError;
          }
          item=survivors[0];
        }
      }
      if(!item?.id)throw Error('Could not add the item to inventory.');
      await trackInventoryItem(recipient,item.id,getSheetConfig());
      await token.update({[`flags.${MODULE_ID}.npcLoot`]:{...state,inventory:state.inventory.filter(r=>r.id!==entryId)}});
      if(token.getFlag?.(MODULE_ID,'npcLoot')?.inventory?.some(r=>r.id===entryId))
        throw Error('Corpse loot removal did not persist.');
      return {name:data.name,actorId:recipient.id};
    }catch(error){
      // The source Item may already be removed even when an update hook
      // rejects. Treat a verified persisted transfer as successful.
      const live=token.getFlag?.(MODULE_ID,'npcLoot');
      if(live?.killed && Array.isArray(live.inventory) && !live.inventory.some(r=>r.id===entryId) && item?.id)
        return {name:data.name,actorId:recipient.id};
      // Do not delete a receipt from a previous operation on an ambiguous
      // attempt: that Item needs explicit GM attention rather than duplication.
      if(existing.length)throw Error('Corpse loot retry could not finish. GM reconciliation is required; do not retry.',{cause:error});
      await removeCorpseItemAfterFailure(recipient,item,error);
      throw error;
    }
  });
  locks.set(key,operation);try{return await operation;}finally{if(locks.get(key)===operation)locks.delete(key);}
}

function requestCorpseLoot(sceneId,tokenId,entryId){
  if(game.user?.isGM)return takeNpcCorpseItem({sceneId,tokenId,entryId,user:game.user});
  const id=foundry.utils.randomID(18),gm=physicalActiveGM();
  if(!gm)return Promise.reject(Error('A GM must be online to loot this corpse.'));
  if(!game.socket?.emit)return Promise.reject(Error('Foundry socket is unavailable.'));
  if(requests.size>=48)return Promise.reject(Error('Too many corpse loot requests are pending. Wait for the GM to respond.'));
  return new Promise((resolve,reject)=>{
    // An uncertain response may mean that the GM already delivered the item.
    // Receipts on Actor Items prevent a duplicate when the GM retries.
    const timeout=setTimeout(()=>{requests.delete(id);reject(Error('NPC loot response timed out. Check your inventory and ask the GM before retrying.'));},12000);
    requests.set(id,{resolve,reject,timeout});
    try {game.socket.emit(CHANNEL,{type:'buxaNpcLootRequest',id,userId:game.user.id,sceneId,tokenId,entryId});}
    catch(error){clearTimeout(timeout);requests.delete(id);
      reject(Error('NPC loot request could not be delivered. Check with the GM before retrying.',{cause:error}));}
  });
}
function installSocket(){
  game.socket?.on?.(CHANNEL,async (payload,authenticatedSenderId)=>{
    if(payload?.type==='buxaNpcLootResult' && payload.userId===game.user.id &&
      authenticatedSenderId===physicalActiveGM()?.id){
      const pending=requests.get(payload.id);if(!pending)return;
      clearTimeout(pending.timeout);requests.delete(payload.id);
      if(payload.ok)pending.resolve(payload.result);else pending.reject(Error(payload.error||'Could not loot NPC.'));
      return;
    }
    if(payload?.type!=='buxaNpcLootRequest'||!game.user?.isGM||physicalActiveGM()?.id!==game.user.id)return;
    if(typeof authenticatedSenderId!=='string' || authenticatedSenderId!==payload.userId)return;
    const user=game.users?.get?.(authenticatedSenderId);
    if(!user||!user.active || !/^[a-zA-Z0-9_-]{6,64}$/.test(String(payload.id)))return;
    let result,ok=false,error;
    try {result=await takeNpcCorpseItem({...payload,user});ok=true;}
    catch(e){error=e.message;}
    try {game.socket.emit(CHANNEL,{type:'buxaNpcLootResult',id:payload.id,userId:payload.userId,ok,result,error});}
    catch(sendError){console.error(`${MODULE_ID} | Corpse loot response could not be delivered; the Item receipt prevents duplicate retries.`,sendError);}
  });
}
let activeCorpseClose=null;
function openCorpse(token){
  const state=npcCorpseState(token);
  if(!state?.killed)return false;
  activeCorpseClose?.();
  const shade=document.createElement('div');shade.className='buxa-npc-corpse-shade';
  shade.innerHTML='<section class="buxa-npc-corpse-window"><header><strong></strong><button type="button" data-close aria-label="Close loot">×</button></header><div class="buxa-npc-corpse-items"></div><p data-status></p></section>';
  shade.querySelector('header strong').textContent=`${token.actor?.name||'NPC'} · LOOT`;
  let lootHook=null;
  const pendingLoot=new Set();
  const close=()=>{
    shade.remove();document.removeEventListener('keydown',escape,true);
    if(lootHook!==null)Hooks.off('updateToken',lootHook);
    lootHook=null;
    if(activeCorpseClose===close)activeCorpseClose=null;
  };
  activeCorpseClose=close;
  const escape=e=>{
    if(e.key!=='Escape' || !shade.isConnected) return;
    const active=document.activeElement;
    // Do not steal Escape from another modal that is currently above the loot window.
    const topDialog=document.querySelector('dialog[open], [role=dialog][aria-modal=true]');
    if(topDialog && !shade.contains(topDialog) && !topDialog.contains(shade)
      && (topDialog.contains(active) || active===topDialog)) return;
    e.preventDefault();e.stopPropagation();close();
  };
  shade.addEventListener('pointerdown',e=>{if(e.target===shade)close();});
  shade.querySelector('[data-close]').addEventListener('click',close);
  document.addEventListener('keydown',escape,true);
  const grid=shade.querySelector('.buxa-npc-corpse-items'),status=shade.querySelector('[data-status]');
  const refresh=()=>{
    const items=npcCorpseState(token)?.inventory||[];
    grid.replaceChildren();status.textContent=items.length?'':'Empty';
    for(const item of items){
      const button=document.createElement('button');button.type='button';
      const image=document.createElement('img');image.src=item.data?.img||'icons/svg/item-bag.svg';image.alt='';
      const name=document.createElement('span');name.className='buxa-npc-corpse-item-name';name.textContent=item.data?.name||'Item';
      const quantity=document.createElement('small');quantity.textContent=`×${item.quantity}`;
      button.append(image,name,quantity);button.title=`Take ${item.data?.name||'Item'}`;
      button.disabled=pendingLoot.has(item.id);
      button.addEventListener('click',async()=>{
        if(pendingLoot.has(item.id))return;
        pendingLoot.add(item.id);button.disabled=true;
        try {const result=await requestCorpseLoot(token.document.parent?.id||canvas.scene?.id,token.id,item.id);
          notifySuccess(`${result.name} added to inventory.`);
          // Let the authoritative Token flag decide whether this loot still exists.
          if(shade.isConnected)refresh();
        }catch(e){notifyError(e.message);}
        finally{pendingLoot.delete(item.id);if(shade.isConnected)refresh();}
      });grid.append(button);
    }
  };
  refresh();document.body.append(shade);
  // Another client can loot the same corpse while this window is open.
  // Reread its authoritative Token flag rather than showing stale buttons.
  lootHook=Hooks.on('updateToken',doc=>{
    if(doc?.id===token.id && doc?.parent?.id===token.document.parent?.id && shade.isConnected)refresh();
  });
  return true;
}
function tokenByPointer(event){
  const point=npcScreenPoint(event);
  if(!point)return null;
  const cell=Math.max(1,Number(canvas?.scene?.grid?.size??canvas?.grid?.size)||100);
  return [...(canvas.tokens?.placeables||[])].reverse().find(token=>{
    if(!npcCorpseState(token)?.killed || token.document?.hidden && !game.user?.isGM)return false;
    const doc=token.document;
    return doc && point.x>=Number(doc.x) && point.x<Number(doc.x)+(Number(doc.width)||1)*cell &&
      point.y>=Number(doc.y) && point.y<Number(doc.y)+(Number(doc.height)||1)*cell;
  })||null;
}

let hover=null,indicator=null,animation=0,board=null,hoverTimer=0,inControl=false;
function hideIndicator(){clearTimeout(hoverTimer);hoverTimer=0;inControl=false;hover=null;indicator?.remove();indicator=null;if(animation)clearTimeout(animation);animation=0;}
function renderIndicator(){
  animation=0;if(!hover||!canvas?.scene||hover.document?.parent?.id!==canvas.scene.id){hideIndicator();return;}
  if(!hover.visible){hideIndicator();return;}
  const state=npcCorpseState(hover);
  if(!state && !canKill(hover)){hideIndicator();return;}
  if(!indicator){
    indicator=document.createElement('div');indicator.className='buxa-npc-kill-control';document.body.append(indicator);
    indicator.addEventListener('pointerenter',()=>{inControl=true;clearTimeout(hoverTimer);hoverTimer=0;});
    indicator.addEventListener('pointerleave',()=>{inControl=false;hideIndicator();});
  }
  const mode=state?.killed?(state.groundPublished?'dead':'pending'):'kill';
  if(indicator.dataset.mode!==mode){
    indicator.dataset.mode=mode;indicator.replaceChildren();
    const button=document.createElement('button');button.type='button';
    button.textContent=mode==='kill'?'KILL':mode==='pending'?'RETRY':'LOOT';
    button.addEventListener('click',async()=>{
      if(button.disabled)return;
      if(mode==='dead'){openCorpse(hover);return;}
      button.disabled=true;try{await killNpcToken(hover);notifySuccess('NPC killed and drops resolved.');}
      catch(error){notifyError(error.message);}finally{button.disabled=false;}
    });indicator.append(button);
  }
  const bounds=npcTokenScreenBounds(hover);
  if(!bounds){hideIndicator();return;}
  if(bounds){
    const left=`${bounds.left+bounds.width/2}px`;
    const top=`${bounds.top-4}px`;
    if(indicator.style.left!==left)indicator.style.left=left;
    if(indicator.style.top!==top)indicator.style.top=top;
  }
  // Avoid a permanent 60fps DOM-layout loop during long NPC hover sessions.
  animation=setTimeout(renderIndicator,90);
}
export function installNpcDeath(){
  installSocket();
  Hooks.on('hoverToken',(token,hovered)=>{
    if(!game.user?.isGM || token.actor?.type!=='npc')return;
    if(hovered){hideIndicator();hover=token;renderIndicator();}
    else if(hover===token){
      // The pointer must be able to travel from the PIXI token to the HTML Kill
      // button without immediately destroying the button under the cursor.
      clearTimeout(hoverTimer);hoverTimer=setTimeout(()=>{if(!inControl && hover===token)hideIndicator();},550);
    }
  });
  Hooks.on('canvasTearDown',hideIndicator);
  // The corpse flag is persistent on each TokenDocument. Do not attach a Pixi
  // Text child to Token5e: Pixi v7 interprets v8 Text options as [object Object],
  // and reading its bounds during canvas refresh can crash the token renderer.
  Hooks.on('updateToken',(doc)=>{
    if(!game.user?.isGM || hover?.document?.id!==doc.id)return;
    // Existing hover control follows the updated death state next frame.
    if(!hover?.visible)hideIndicator();
  });
  Hooks.on('updateActor',actor=>{
    if(!game.user?.isGM || hover || actor?.type!=='npc')return;
    const token=(canvas?.tokens?.placeables||[]).find(t=>t.actor?.id===actor.id && t.hover);
    if(token){hover=token;renderIndicator();}
  });

  const listenBoard=()=>{
    const surface=canvas?.app?.renderer?.canvas||canvas?.app?.view;
    if(board===surface)return;board?.removeEventListener('dblclick',doubleClick,true);board=surface;
    board?.addEventListener('dblclick',doubleClick,true);
    // Token death state is read from persistent flags when hovered/double-clicked.
  };
  const doubleClick=e=>{
    const token=tokenByPointer(e);
    if(!token)return;
    e.preventDefault();e.stopImmediatePropagation();openCorpse(token);
  };
  Hooks.on('canvasReady',listenBoard);
  if(canvas?.ready)listenBoard();
}
