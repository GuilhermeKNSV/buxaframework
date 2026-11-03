import {beginActorResourceUse} from './actor-transactions.js';
/** Item use transactions: resources and per-instance limits. Player-triggered, owner-authorized. */
import { MODULE_ID } from './constants.js';
import { getItemRules } from './item-config.js';
import { normalizeItemUsage, remainingItemUses, itemIsExhausted } from './item-use-config.js';
import { getEffectiveResourceState } from './resources.js';
import { getItemQuantity } from "./dnd5e.js";
import { writeResourceUpdate } from './dnd5e.js';
import { getSheetConfig } from "./config.js";
import { resolveItemDice } from './item-dice.js';
import { notifyWarning } from './notifications.js';

const active = new WeakSet();
const finite = value => Number.isFinite(Number(value)) ? Number(value) : 0;
export function itemUseState(item, config) {
  const limits = getItemRules(item, config).limits;
  const usage = normalizeItemUsage(item?.getFlag?.(MODULE_ID,'itemUsage'));
  return { limits, usage, remaining:remainingItemUses(limits,usage), exhausted:itemIsExhausted(limits,usage) };
}
export function preflightItemUse(item, actor, config) {
  if (!actor?.isOwner || !item || item.parent !== actor ||
      (typeof actor.items?.get === 'function' && actor.items.get(item.id) !== item))
    throw Error('Only the owner can use an item in their Actor inventory.');
  const rules = getItemRules(item, config);
  const state = itemUseState(item, config);
  if (state.exhausted) throw Error(`${item.name} has no charges remaining.`);
  if (rules.limits.enabled && remainingItemUses(rules.limits,state.usage)===1 &&
      ['destroy','transform'].includes(rules.limits.onExhaust)) {
    const placements=actor.getFlag?.(MODULE_ID,'inventory')?.placements||{};
    if(Object.values(placements).some(p=>p?.area==='storage' && String(p.storageId||'').startsWith(`${item.id}:`)))
      throw Error('Empty this container before its final use can destroy or transform it.');
  }
  if (rules.limits.enabled && rules.limits.onExhaust === 'transform') {
    if (getItemQuantity(item)>1) throw Error('Unstack this item before transforming it, to preserve the other stack members.');
    const target = game.items?.get?.(rules.limits.transformItemId);
    if (!target) throw Error('Choose a valid world Item in Limits → Transform before using this item.');
    if (target.type !== item.type) throw Error('The transformation target must have the same Foundry Item type.');
  }
  for (const effect of rules.resourceEffects) {
    if (!config.resources?.some(resource=>resource.id===effect.resourceId)) throw Error('An Item Resource effect references a deleted resource.');
    if (effect.amountType !== 'dice') continue;
    if (effect.attributeDice.enabled && !config.attributes?.entries?.some(attribute=>attribute.id===effect.attributeDice.attributeId))
      throw Error('An Item Resource effect references a missing attribute dice source.');
    const modifier = effect.modifier;
    if (modifier.source === 'attribute' && !config.attributes?.entries?.some(attribute=>attribute.id===modifier.id))
      throw Error('An Item Resource effect references a missing attribute modifier.');
    if (modifier.source === 'proficiency' && !config.proficiencies?.entries?.some(proficiency=>proficiency.id===modifier.id))
      throw Error('An Item Resource effect references a missing proficiency modifier.');
  }
  return {rules,state};
}
async function effectAmount(effect, actor, item, config, Roller) {
  if (effect.amountType !== 'dice') return Math.max(0, finite(effect.amount));
  const resolved = resolveItemDice(item, {
    count:effect.count,faces:effect.faces,attributeDice:effect.attributeDice,flat:effect.flat,
    modifier:effect.modifier,rollMode:effect.rollMode
  },{actor,config});
  if (!resolved.sourceValid) throw Error('An Item Resource effect has a missing attribute dice source.');
  const roll = new Roller(resolved.formula);
  await roll.evaluate({allowInteractive:false});
  return Math.max(0, Math.floor(finite(roll.total)));
}
async function planPhase(effects, timing, actor, item, config, Roller, initial) {
  const values = new Map(initial);
  const results=[];
  for (const rule of effects.filter(entry=>entry.timing===timing)) {
    const resource = config.resources.find(entry=>entry.id===rule.resourceId);
    const state = values.get(resource.id) || getEffectiveResourceState(actor,resource,config);
    const rolled = await effectAmount(rule,actor,item,config,Roller);
    const amount = rule.amountType === 'percent' ? Math.ceil(state.max * rolled / 100) : Math.ceil(rolled);
    if (rule.action === 'drain' && state.current < amount) throw Error(`Not enough ${resource.label}: needs ${amount}, has ${state.current}.`);
    const next = Math.max(0,Math.min(state.max,state.current + (rule.action === 'fill' ? amount : -amount)));
    values.set(resource.id,{...state,current:next});
    results.push({resourceId:resource.id,label:resource.label,action:rule.action,amount:Math.abs(next-state.current),timing});
  }
  return {values,results};
}
async function saveResourceValues(actor, config, values) {
  const update = {};
  for (const [id, state] of values) {
    const resource = config.resources.find(entry => entry.id === id);
    if (resource) writeResourceUpdate(actor, resource, { current: state.current }, update);
  }
  if (Object.keys(update).length) await actor.update(update, { [`${MODULE_ID}.runtime`]: true });
}
function liveResource(actor, config, id) {
  const resource = config.resources.find(entry => entry.id === id);
  return resource && getEffectiveResourceState(actor, resource, config);
}
/** Never overwrite a change made by another action while a dice roll was pending. */
async function commitPhase(actor, config, phase, prior, expectedWrites) {
  const changes = new Map();
  for (const id of new Set(phase.results.map(entry => entry.resourceId))) {
    const current = liveResource(actor, config, id);
    const previous = prior.get(id);
    if (!current || !previous || current.current !== previous.current || current.max !== previous.max) {
      throw Error('A resource changed while the item was being used. Retry after checking HP/MP.');
    }
    const next = phase.values.get(id);
    if (next.current !== current.current) {
      changes.set(id, next);
      // Remember the expected result before writing: hooks may throw after a save.
      expectedWrites.set(id, next.current);
    }
  }
  if (changes.size) await saveResourceValues(actor, config, changes);
}
/** Restore only our own committed values, never another action's newer update. */
async function rollbackResources(actor, config, originals, expectedWrites) {
  const restore = new Map();
  const conflicts = [];
  for (const [id, expected] of expectedWrites) {
    const previous = originals.get(id);
    const current = liveResource(actor, config, id);
    if (!current || !previous || current.current === previous.current) continue;
    if (current.current !== expected) { conflicts.push(id); continue; }
    restore.set(id, previous);
  }
  if (restore.size) {
    try { await saveResourceValues(actor, config, restore); }
    catch (error) {
      // A Foundry hook can throw after the database write has committed.
      // Report failure only if at least one resource truly was not restored.
      if ([...restore].some(([id, state]) => liveResource(actor, config, id)?.current !== state.current)) throw error;
    }
  }
  if (conflicts.length) throw Error('Resources changed during the failed item use and were not overwritten. Check HP/MP before retrying.');
}
async function exhaustItem(item, rules, actor) {
  if (rules.limits.onExhaust === 'destroy') {
    if (getItemQuantity(item)>1) {
      const nextQuantity=getItemQuantity(item)-1;
      try { await item.update({'system.quantity':nextQuantity,[`flags.${MODULE_ID}.itemUsage`]:{used:0}},{[`${MODULE_ID}.itemUse`]:true}); }
      catch(error) {
        // Hooks sometimes throw after Foundry has already committed a write.
        if (getItemQuantity(item)!==nextQuantity || normalizeItemUsage(item.getFlag?.(MODULE_ID,'itemUsage')).used!==0) throw error;
      }
      return 'one consumed';
    }
    try { await actor.deleteEmbeddedDocuments('Item',[item.id],{[`${MODULE_ID}.itemUse`]:true}); }
    catch(error) { if (actor.items?.get?.(item.id)) throw error; }
    return 'destroyed';
  }
  if (rules.limits.onExhaust === 'transform') {
    const target = game.items?.get?.(rules.limits.transformItemId);
    if (!target || target.type !== item.type) throw Error('Transformation target is missing or incompatible.');
    // Update the same Item instead of removing it. The Actor's inventory placement,
    // source identity, and any contained storage remain addressable by the same id.
    const source = target.toObject();
    const nextRules = getItemRules(target,getSheetConfig());
    try { await item.update({ name:source.name,img:source.img,system:foundry.utils.deepClone(source.system),
      [`flags.${MODULE_ID}.item`]:nextRules,[`flags.${MODULE_ID}.itemUsage`]:{used:0},
      [`flags.${MODULE_ID}.itemInstance.originUuid`]:target.uuid || `Item.${target.id}`
    },{[`${MODULE_ID}.itemUse`]:true}); }
    catch(error) {
      // A post-save hook failure must not undo resource payments for an
      // already-transformed item and accidentally grant free uses.
      if (item.name !== source.name || item.img !== source.img || normalizeItemUsage(item.getFlag?.(MODULE_ID,'itemUsage')).used !== 0) throw error;
    }
    return 'transformed';
  }
  return 'locked';
}
/** performRoll returns {publish?} after evaluating the main roll; no-roll USE is also supported. */
export async function executeItemUse(item,{actor=item?.parent,config=getSheetConfig(),performRoll=async()=>({})}={}) {
  if (active.has(item)) throw Error('This item is already being used.');
  const releaseActor = beginActorResourceUse(actor);
  active.add(item);
  let snapshot, usageBefore, usageExpected;
  const expectedWrites = new Map();
  try {
    const {rules,state} = preflightItemUse(item,actor,config);
    const Roller=foundry.dice?.Roll ?? globalThis.Roll;
    if (!Roller && rules.resourceEffects.some(e=>e.amountType==='dice')) throw Error('Foundry Roll API is unavailable.');
    const original = new Map();
    for (const effect of rules.resourceEffects) {
      const resource=config.resources.find(entry=>entry.id===effect.resourceId);
      if (!original.has(resource.id)) original.set(resource.id,getEffectiveResourceState(actor,resource,config));
    }
    snapshot=original; usageBefore=state.usage.used;
    const before=await planPhase(rules.resourceEffects,'before',actor,item,config,Roller,original);
    if (before.results.length) await commitPhase(actor,config,before,original,expectedWrites);
    const rolled=await performRoll();
    if (rolled === false) throw Error('The Item roll could not be completed.');
    const after=await planPhase(rules.resourceEffects,'after',actor,item,config,Roller,before.values);
    if (after.results.length) await commitPhase(actor,config,after,before.values,expectedWrites);
    let remaining=null, outcome='';
    if (rules.limits.enabled) {
      const liveUsage = normalizeItemUsage(item.getFlag?.(MODULE_ID, 'itemUsage')).used;
      if (liveUsage !== usageBefore) throw Error('Item charges changed while rolling. Retry with the updated charge counter.');
      const used=state.usage.used+1;
      usageExpected=used;
      await item.update({[`flags.${MODULE_ID}.itemUsage`]:{used}},{[`${MODULE_ID}.itemUse`]:true});
      remaining=Math.max(0,rules.limits.maxUses-used);
      if (remaining===0) outcome=await exhaustItem(item,rules,actor);
    }
    try { await rolled?.publish?.([...before.results,...after.results],remaining,outcome); }
    catch (error) {
      console.warn(`${MODULE_ID} | Item was used, but chat publication failed.`,error);
      notifyWarning('Item was used and charges/resources were applied, but the chat message failed. Do not use it again to retry the message.');
    }
    return {ok:true,resources:[...before.results,...after.results],remaining,outcome};
  } catch (error) {
    // Avoid undoing unrelated HP/MP or use-counter changes during an async roll.
    try { if (snapshot?.size && expectedWrites.size) await rollbackResources(actor,config,snapshot,expectedWrites); }
    catch (rollbackError) {
      console.error(`${MODULE_ID} | Resource rollback unsafe or failed`,rollbackError);
      throw new Error('Item use failed; resource recovery needs review. Check HP/MP before retrying.',{cause:error});
    }
    if (usageExpected !== undefined && actor?.items?.get?.(item.id)
        && itemUseState(item,config).usage.used === usageExpected) {
      try { await item.update({[`flags.${MODULE_ID}.itemUsage`]:{used:usageBefore}},{[`${MODULE_ID}.itemUse`]:true}); }
      catch (rollbackError) {
        if (itemUseState(item,config).usage.used !== usageBefore) {
          console.error(`${MODULE_ID} | Use counter rollback failed`,rollbackError);
          throw new Error('Item use failed; remaining charges could not be restored. Check the Item counter.',{cause:error});
        }
      }
    }
    throw error;
  } finally { active.delete(item); releaseActor(); }
}
export async function useItemWithoutDice(item,{actor=item?.parent,config=getSheetConfig()}={}) {
  return executeItemUse(item,{actor,config,performRoll:async()=>({publish:async(results,remaining,outcome)=>{
    const Chat = foundry.documents?.ChatMessage ?? globalThis.ChatMessage;
    if (!Chat || (!results.length && remaining === null)) return;
    const escape = foundry.utils.escapeHTML;
    const lines = results.map(entry=>`<div class="buxa-item-use-chat-line"><strong>${entry.action === 'fill' ? '+' : '−'}${entry.amount}</strong> ${escape(entry.label)} <small>${entry.timing.toUpperCase()}</small></div>`).join('');
    await Chat.create({user:game.user.id,speaker:Chat.getSpeaker({actor}),content:
      `<section class="buxa-chat-roll-card buxa-item-chat-roll"><header><strong>${escape(item.name)}</strong><span>ITEM USED</span></header>${lines}${remaining===null?'':`<footer>CHARGES LEFT <strong>${remaining}</strong> ${escape(outcome)}</footer>`}</section>`});
  }})});
}
