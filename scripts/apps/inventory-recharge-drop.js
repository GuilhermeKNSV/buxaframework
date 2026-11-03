/** Intercepts item-on-item recharge ahead of shape collision and auto stacking. */
import { getSheetConfig } from '../core/config.js';
import { canRechargeWithItem, rechargeItem } from '../core/item-recharge.js';
import { notifyWarning } from '../core/notifications.js';
export function inventoryRechargeTarget(actor,sourceId,element,hitId=null,config=getSheetConfig()) {
  const source=actor?.items?.get?.(sourceId);
  const id=hitId || element?.closest?.('[data-item-id]')?.dataset?.itemId
    || element?.closest?.('[data-hit-item-id]')?.dataset?.hitItemId;
  const target=actor?.items?.get?.(id);
  return source && target && canRechargeWithItem(source,target,config) ? {source,target}:null;
}
export async function performInventoryRecharge(actor,match,config=getSheetConfig()) {
  return rechargeItem(match.target,{actor,source:match.source,method:'item',config});
}
export function queueInventoryRecharge(queueMutation,actor,match) {
  void queueMutation(async()=>{
    try {await performInventoryRecharge(actor,match);}
    catch(error){notifyWarning(error.message || 'Could not recharge this Item.');}
  });
}
