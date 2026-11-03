import { getSheetConfig } from '../core/config.js';
import { getItemRules } from '../core/item-config.js';
import { resolveItemDice } from '../core/item-dice.js';
import { isRevealed } from '../core/item-discovery.js';
import { useItemWithoutDice, itemUseState } from '../core/item-use-runtime.js';
import { notifyError } from '../core/notifications.js';
export function bindItemSheetUse(root,item) {
  root.querySelector('[data-use-item-standalone]')?.addEventListener('click',async event=> {
    const button=event.currentTarget;
    button.disabled=true;
    try {await useItemWithoutDice(item,{actor:item.parent,config:getSheetConfig()}); }
    catch(error) {notifyError(error.message || 'Item use failed.');}
    finally {button.disabled=false;}
  });
}
function resourceAmountText(rule, config, item) {
  if (rule.amountType !== 'dice') {
    const amount=Math.max(0,Number(rule.amount)||0);
    return `${rule.amountType==='percent'?amount:Math.ceil(amount)}${rule.amountType==='percent'?'%':''}`;
  }
  // The same resolver drives the real Resource roll. It accounts for rebirth
  // dice, equipped bonuses and the Actor's actual attribute/proficiency mod.
  return resolveItemDice(item, rule, {actor:item?.parent, config}).displayFormula;
}

export function itemUseView(item,config) {
  const rules=getItemRules(item,config);
  const state=itemUseState(item,config);
  const aftermath={disable:'LOCKS WHEN EMPTY',destroy:'One copy is consumed at 0 charges',transform:'Transforms into another item at 0 charges'};
  const recharge=state.limits.recharge;
  const hasVisibleRoll=rules.dice.some(dice=>dice.chatRoll && isRevealed(dice));
  const resourceName=id=>config.resources?.find(resource=>resource.id===id)?.label||'resource';
  const charges=count=>`${count} ${count===1?'charge':'charges'}`;
  const cost=entry=>entry.costType==='percent'
    ? `${entry.cost}% of max ${resourceName(entry.resourceId)}`
    : `${Math.ceil(Number(entry.cost)||0)} ${resourceName(entry.resourceId)}`;
  return {
    ...state,hasResourceEffects:rules.resourceEffects.length>0,
    resourceEffects:rules.resourceEffects.map(rule=>{
      const label=resourceName(rule.resourceId);
      const amount=resourceAmountText(rule,config,item);
      const amountLabel=rule.amountType==='percent'
        ? `${amount.replace(/%$/,'')}% of max ${label}`
        : `${amount} ${label}`;
      return {
        ...rule,
        label,
        amountText:amount,
        description:`${rule.action==='fill'?'Restores':'Spends'} ${amountLabel}${hasVisibleRoll?` ${rule.timing==='after'?'after':'before'} the roll`:''}`,
        fill:rule.action==='fill',before:rule.timing==='before',
        actionText:rule.action==='fill'?'RESTORE':'DRAIN',
        rollModeText:rule.amountType==='dice' && rule.rollMode!=='normal' ? rule.rollMode.toUpperCase() : ''
      };
    }),
    showStandaloneUse:(rules.resourceEffects.length>0 || rules.limits.enabled) && !rules.dice.some(d=>d.chatRoll),
    isOwned:item.parent?.documentName==='Actor',
    limitsDisplay:state.limits.enabled ? `${state.remaining} / ${state.limits.maxUses}` : '',
    usesPercent:state.limits.enabled ? Math.max(0,Math.min(100,100*state.remaining/state.limits.maxUses)).toFixed(2) : '0',
    onExhaustLabel:aftermath[state.limits.onExhaust] || '',
    rechargeLabels:state.limits.enabled ? [
      recharge.button.enabled ? `Right-click to recharge ${charges(recharge.button.charges)}${recharge.button.resourceId && Number(recharge.button.cost)>0
        ? ` for ${cost(recharge.button)}` : ' for free'}` : '',
      recharge.item.enabled ? `Consume a matching item to restore ${charges(recharge.item.charges)}` : '',
      recharge.combat.enabled ? `Regains ${charges(recharge.combat.charges)} every ${recharge.combat.everyTurns} combat ${recharge.combat.everyTurns===1?'turn':'turns'}` : ''
    ].filter(Boolean) : [],
    exhaustedText:state.exhausted ? 'NO CHARGES REMAIN' : ''
  };
}
