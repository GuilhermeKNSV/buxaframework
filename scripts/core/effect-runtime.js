/** Authoritative actor Effect instances. The ordinary Foundry Item remains the
 * source template; the actor flag records the applied copy and its clock. */
import { MODULE_ID, EFFECT_FLAG, ACTIVE_EFFECTS_FLAG, HOOKS } from './constants.js';
import { getEffectRules, normalizeActiveEffect, getItemKind } from './effect-config.js';
import { getSheetConfig } from './config.js';
import { getEffectiveResourceState } from './resources.js';
import { writeResourceUpdate } from './dnd5e.js';
import { resolveItemDice } from './item-dice.js';

const gmIsPrimary=()=> {
  if (!game.user?.isGM) return false;
  const active=game.users?.activeGM;
  if (active?.isGM && active.active !== false) return active.id===game.user.id;
  const gms=[...(game.users?.contents || (game.users?.[Symbol.iterator] ? game.users : []))].filter(u=>u?.isGM && u.active!==false)
    .sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  return !gms.length || gms[0].id===game.user.id;
};
export const isPrimaryEffectGM = () => gmIsPrimary();
const pending = new WeakMap();
const randomId = () => globalThis.foundry?.utils?.randomID?.(16) ?? `effect-${Date.now()}-${Math.random()}`;
const numeric = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const cursor = combat => ({round:Math.max(0,Math.trunc(numeric(combat?.round))),turn:Math.max(0,Math.trunc(numeric(combat?.turn)))});
function turnsFrom(combat, start, count) {
  const n = Math.max(1,combat?.turns?.length || 1);
  const flat = start.round * n + start.turn + Math.max(1,count);
  return {round:Math.floor(flat / n),turn:flat % n};
}
function actorEffects(actor) {
  const values = actor?.getFlag?.(MODULE_ID, ACTIVE_EFFECTS_FLAG);
  return Array.isArray(values) ? values.filter(value => value && typeof value === 'object' && value.instanceId && value.effectItemId)
    .slice(0, 256).map(value => ({
      ...normalizeActiveEffect(value),
      ...(typeof value.lastTick === 'string' && value.lastTick.length <= 128 ? {lastTick:value.lastTick} : {})
    })) : [];
}
export function getActiveEffects(actor) { return actorEffects(actor); }
export function isEffectExpired(instance, combat, rules = {}) {
  if (instance?.behavior === 'passive' || rules?.duration?.mode === 'permanent') return false;
  if (Number.isInteger(rules?.duration?.value) && (instance?.progress ?? 0) >= rules.duration.value) return true;
  const end = instance?.expiresAt;
  if (!end || !combat) return false;
  return numeric(combat.round) > end.round ||
    (numeric(combat.round) === end.round && numeric(combat.turn) >= end.turn);
}
function findEffectItem(actor, id) {
  return actor?.items?.get?.(id) ?? globalThis.game?.items?.get?.(id)
    ?? [...(actor?.items ?? [])].find(i => i.id === id) ?? null;
}
function enqueue(actor, task) {
  const prev = pending.get(actor) || Promise.resolve();
  const next = prev.catch(() => {}).then(task);
  pending.set(actor,next);
  void next.finally(() => {if (pending.get(actor) === next) pending.delete(actor);}).catch(() => {});
  return next;
}
function emit(type, actor, effect, instance, context = {}) {
  try { globalThis.Hooks?.callAll?.(type, {actor, effect, instance:{...instance},...context}); }
  catch(error) { console.error('Buxa | Effect subscriber failed',error); }
}
async function payload(actor, effect, rules, phase, config) {
  const results = [];
  const resourceChanges = {};
  const state = new Map();
  for (const entry of rules.resourceEffects) {
    const resource = config.resources?.find(row => row.id === entry.resourceId);
    if (!resource) continue;
    let value = state.get(resource.id) ?? getEffectiveResourceState(actor,resource,config);
    if (!value) continue;
    let amount = Math.max(0,numeric(entry.amount));
    if (entry.amountType === 'dice') {
      const expression = resolveItemDice(effect,entry,{actor,config});
      if (!expression.sourceValid) continue;
      const Dice = globalThis.foundry?.dice?.Roll ?? globalThis.Roll;
      if (typeof Dice !== 'function') continue;
      const roll = await new Dice(expression.formula).evaluate({allowInteractive:false});
      amount = Math.max(0,Math.floor(numeric(roll.total)));
    }
    if (entry.amountType === 'percent') amount = Math.ceil(value.max * amount / 100);
    const current = Math.max(0,Math.min(value.max,value.current + (entry.action === 'fill' ? amount : -amount)));
    value = {...value,current};
    state.set(resource.id,value);
    writeResourceUpdate(actor, resource,{current},resourceChanges);
    results.push({kind:'resource',label:resource.label,amount,action:entry.action});
  }
  if (Object.keys(resourceChanges).length) await actor.update(resourceChanges,{[`${MODULE_ID}.effectTick`]:true});
  for (const die of rules.dice) {
    const expression = resolveItemDice(effect,die,{actor,config});
    const Dice = globalThis.foundry?.dice?.Roll ?? globalThis.Roll;
    if (!expression.sourceValid || typeof Dice !== 'function') continue;
    const roll = await new Dice(expression.formula).evaluate({allowInteractive:false});
    results.push({kind:'dice',label:die.label,total:numeric(roll.total)});
  }
  return {phase,results};
}
export async function applyEffectToActor(actor, effectItem, {sourceItemId = '', combat = globalThis.game?.combat} = {}) {
  if (!globalThis.game?.user?.isGM || !actor?.setFlag || !effectItem || getItemKind(effectItem) !== 'effect') return null;
  return enqueue(actor,async () => {
    const config = getSheetConfig();
    const rules = getEffectRules(effectItem,config);
    const existing = actorEffects(actor);
    const old = existing.find(inst => inst.effectItemId === effectItem.id);
    const start = cursor(combat);
    const expiresAt = rules.behavior === 'passive' || rules.duration.mode === 'permanent'
      ? null : turnsFrom(combat,start,rules.duration.value);
    const replacement = normalizeActiveEffect({instanceId:old && rules.stackBehavior !== 'replace' ? old.instanceId : randomId(),
      effectItemId:effectItem.id,sourceItemId:sourceItemId || effectItem.id,behavior:rules.behavior,
      appliedAt:start,expiresAt,progress:0,rarityId:rules.rarityId,
      stackCount:old && rules.stackBehavior === 'stack' ? old.stackCount + 1 : old && rules.stackBehavior === 'refresh' ? old.stackCount : 1});
    const next = existing.filter(inst => inst.effectItemId !== effectItem.id);
    if (next.length >= 256) throw Error('Actor has reached the Effect instance limit.');
    next.push(replacement);
    await actor.setFlag(MODULE_ID,ACTIVE_EFFECTS_FLAG,next);
    if (old && rules.stackBehavior === 'replace') {
      if (rules.triggers.onRemove) await payload(actor,effectItem,rules,'onRemove',config);
      emit(HOOKS.EFFECT_REMOVED,actor,effectItem,old,{reason:'replaced'});
    }
    if (rules.triggers.onApply) await payload(actor,effectItem,rules,'onApply',config);
    emit(HOOKS.EFFECT_APPLIED,actor,effectItem,replacement);
    return replacement;
  });
}
export async function removeEffectFromActor(actor, instanceId, {effectItemId = null} = {}) {
  if (!globalThis.game?.user?.isGM || !actor?.setFlag) return false;
  return enqueue(actor, async () => {
    const all = actorEffects(actor);
    const removed = all.filter(value => value.instanceId === instanceId || (effectItemId && value.effectItemId === effectItemId));
    if (!removed.length) return false;
    await actor.setFlag(MODULE_ID,ACTIVE_EFFECTS_FLAG,all.filter(value => !removed.includes(value)));
    const config = getSheetConfig();
    for (const entry of removed) {
      const item = findEffectItem(actor,entry.effectItemId);
      if (item?.getFlag?.(MODULE_ID,EFFECT_FLAG)?.triggers?.onRemove) await payload(actor,item,getEffectRules(item,config),'onRemove',config);
      emit(HOOKS.EFFECT_REMOVED,actor,item,entry,{reason:'manual'});
    }
    return true;
  });
}
/** `phase` is onCombatTurnStart or onCombatTurnEnd. Every phase has a stable
 * combat cursor; repeated hooks/replays cannot award another timed tick. */
export async function tickActorEffects(actor, combat, phase = 'onCombatTurnStart') {
  if (!gmIsPrimary() || !actor?.setFlag || !['onCombatTurnStart','onCombatTurnEnd'].includes(phase)) return [];
  return enqueue(actor, async () => {
    const all = actorEffects(actor);
    if (!all.length) return [];
    const config = getSheetConfig(), now = cursor(combat);
    const changes = [], expired = [];
    const next = [];
    for (const old of all) {
      const effect = findEffectItem(actor,old.effectItemId);
      if (!effect) { next.push(old); continue; }
      const rules = getEffectRules(effect,config);
      const key = `${combat?.id ?? ''}|${now.round}|${now.turn}|${phase}`;
      // Ledger is an optional field on the persisted instance, left outside
      // normalized schema so older stored instances remain fully compatible.
      const original = (actor.getFlag?.(MODULE_ID,ACTIVE_EFFECTS_FLAG) ?? []).find(row => row.instanceId === old.instanceId);
      if (original?.lastTick === key) { next.push({...old,lastTick:key}); continue; }
      const instance = {...old,lastTick:key};
      if (rules.triggers[phase]) {
        const result = await payload(actor,effect,rules,phase,config);
        changes.push({effect,instance,result});
      }
      if (phase === 'onCombatTurnStart' && rules.behavior === 'timed' && rules.duration.mode === 'turns') {
        instance.progress++;
        if (instance.progress >= rules.duration.value) {expired.push({effect,instance,rules}); continue;}
      }
      next.push(instance);
    }
    // One write for the complete set, including removals; write the tick key
    // with each instance so another GM/hook does not replay this phase.
    await actor.setFlag(MODULE_ID,ACTIVE_EFFECTS_FLAG,next);
    for (const {effect,instance,result} of changes) emit(HOOKS.EFFECT_TICK,actor,effect,instance,{phase,result});
    for (const {effect,instance,rules} of expired) {
      if (rules.triggers.onRemove) await payload(actor,effect,rules,'onRemove',config);
      emit(HOOKS.EFFECT_REMOVED,actor,effect,instance,{reason:'expired'});
    }
    return changes;
  });
}
