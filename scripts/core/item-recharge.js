import {beginActorResourceUse} from './actor-transactions.js';
/** Item recharge transactions. Only individual Actor-owned Item instances carry charges. */
import { MODULE_ID } from './constants.js';
import { getSheetConfig } from './config.js';
import { getItemRules } from './item-config.js';
import { normalizeItemUsage, remainingItemUses, rechargeItemUsage } from './item-use-config.js';
import { getEffectiveResourceState } from './resources.js';
import { writeResourceUpdate, getItemQuantity } from './dnd5e.js';
import { validStackQuantity } from './stack-quantity.js';

const busy = new WeakSet();
// Different target Items must not spend the same material or HP/MP concurrently.
const busyActors = new WeakSet();
const usageOf = item => normalizeItemUsage(item.getFlag?.(MODULE_ID, 'itemUsage'));
function check(item,actor,config,method) {
  if (!item || !actor || item.parent !== actor || !actor.isOwner ||
      (typeof actor.items?.get === 'function' && actor.items.get(item.id) !== item))
    throw Error('Recharge an Item owned by this Actor.');
  const limits = getItemRules(item,config).limits;
  if (!limits.enabled || !limits.recharge?.[method]?.enabled) throw Error('This Item does not support that recharge method.');
  const current = usageOf(item);
  if (!current.used) throw Error('This Item is already fully charged.');
  return {limits,entry:limits.recharge[method],current};
}
function updateResource(actor,resource,state) {
  const update={};
  writeResourceUpdate(actor,resource,{current:state},update);
  return update;
}
function matchingMaterial(item,templateId) {
  if (!templateId) return false;
  const origin = item.getFlag?.(MODULE_ID,'itemInstance')?.originUuid || '';
  return origin === `Item.${templateId}` || item.getFlag?.('core','sourceId') === `Item.${templateId}`;
}
export function canRechargeWithItem(source,target,config=getSheetConfig()) {
  if (!source || !target || source===target || source.id===target.id ||
      !target.parent || source.parent!==target.parent || !target.parent.isOwner ||
      (typeof target.parent.items?.get === 'function' &&
        (target.parent.items.get(source.id)!==source || target.parent.items.get(target.id)!==target))) return false;
  const limits=getItemRules(target,config).limits;
  return Boolean(validStackQuantity(source) && getItemQuantity(source) >= 1 &&
    limits.enabled && limits.recharge.item.enabled && matchingMaterial(source,limits.recharge.item.templateId));
}
export async function rechargeItem(target, {actor=target?.parent, config=getSheetConfig(),method='button',source=null}={}) {
  if (!target || typeof target!=='object' || !actor || typeof actor!=='object')
    throw Error('Choose a valid owned Item to recharge.');
  if (busy.has(target) || busyActors.has(actor)) throw Error('Another recharge is already in progress for this Actor.');
  const releaseActor = beginActorResourceUse(actor);
  busy.add(target);
  busyActors.add(actor);
  try {
    const {limits,entry,current}=check(target,actor,config,method);
    let resource, previous, next, materialAmount;
    if (method==='button' && entry.resourceId) {
      resource=config.resources?.find(r=>r.id===entry.resourceId);
      if (!resource) throw Error('The recharge resource no longer exists.');
      previous=getEffectiveResourceState(actor,resource,config);
      const cost=entry.costType==='percent'?Math.ceil(previous.max*entry.cost/100):Math.ceil(entry.cost);
      if (previous.current<cost) throw Error(`Not enough ${resource.label} to recharge.`);
      next=previous.current-cost;
    }
    if (method==='item') {
      if (!source || source.parent!==actor || actor.items?.get?.(source.id)!==source ||
          !matchingMaterial(source,entry.templateId) || source.id===target.id)
        throw Error('Drop the selected recharge Item from this Actor inventory.');
      if (!validStackQuantity(source)) throw Error('The recharge material has an invalid quantity; repair it before using it.');
      materialAmount=getItemQuantity(source);
      if (materialAmount<1) throw Error('The recharge Item is empty.');
    }
    const expected=rechargeItemUsage(limits,current,entry.charges);
    // Recharge first; if this write rejects, resources/materials remain untouched.
    try {await target.update({[`flags.${MODULE_ID}.itemUsage`]:expected},{[`${MODULE_ID}.recharge`]:true});}
    catch(error) {
      if(usageOf(target).used===expected.used) {
        await target.update({[`flags.${MODULE_ID}.itemUsage`]:current},{[`${MODULE_ID}.recharge`]:true});
      }
      throw error;
    }
    let attemptedResourcePayment=false, attemptedMaterialConsumption=false;
    try {
      if(resource && getEffectiveResourceState(actor,resource,config).current!==previous.current)
        throw Error(`${resource.label} changed before recharge payment. Retry.`);
      if (resource && getEffectiveResourceState(actor,resource,config).max !== previous.max)
        throw Error(`${resource.label} maximum changed before recharge payment. Retry.`);
      if (resource) {
        attemptedResourcePayment=true;
        await actor.update(updateResource(actor,resource,next),{[`${MODULE_ID}.recharge`]:true});
      }
      if (method==='item') {
        if (actor.items?.get?.(source.id)!==source || !validStackQuantity(source) || getItemQuantity(source)!==materialAmount)
          throw Error('The recharge material changed during the operation. Retry.');
        attemptedMaterialConsumption=true;
        if(materialAmount===1) await actor.deleteEmbeddedDocuments('Item',[source.id],{[`${MODULE_ID}.recharge`]:true});
        else await source.update({'system.quantity':materialAmount-1},{[`${MODULE_ID}.recharge`]:true});
      }
    } catch(error) {
      // A Foundry hook can throw after writing. Do not refund successfully consumed resources/materials.
      const paid=attemptedResourcePayment && resource && getEffectiveResourceState(actor,resource,config).current===next;
      const consumed=attemptedMaterialConsumption && method==='item' &&
        (materialAmount===1 ? !actor.items?.get?.(source.id) : getItemQuantity(source)===materialAmount-1);
      if (!paid && !consumed && usageOf(target).used===expected.used) {
        try {await target.update({[`flags.${MODULE_ID}.itemUsage`]:current},{[`${MODULE_ID}.recharge`]:true});}
        catch(rollbackError) {throw Error('Recharge failed and its use counter needs review.',{cause:rollbackError});}
      }
      if (!paid && !consumed) throw error;
    }
    return {ok:true,method,
      added:remainingItemUses(limits,expected)-remainingItemUses(limits,current),
      remaining:remainingItemUses(limits,expected)};
  } finally {busy.delete(target);busyActors.delete(actor);releaseActor();}
}
