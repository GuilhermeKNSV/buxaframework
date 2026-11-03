import { BuxaItemSheet } from './item-sheet.js';
import { TEMPLATE_PATHS } from '../core/constants.js';
import { getSheetConfig } from '../core/config.js';
import { getEffectRules, getEffectRarity } from '../core/effect-config.js';
import { getActiveEffects } from '../core/effect-runtime.js';
import { normalizeItemRules, rarityPresentation } from '../core/item-config.js';
import { buildItemPresentation } from '../core/item-presentation.js';
import { itemUseView } from './item-use-actions.js';

export function effectDurationText(rules, instance) {
  if (rules.behavior === 'passive' || rules.duration.mode === 'permanent') return 'Permanent';
  const remaining = Math.max(0,rules.duration.value - (instance?.progress || 0));
  return remaining <= 1 ? 'Expires this turn' : `${remaining} turns remaining`;
}
export class BuxaEffectSheet extends BuxaItemSheet {
  static DEFAULT_OPTIONS = {
    ...BuxaItemSheet.DEFAULT_OPTIONS,
    classes:['buxa','buxa-item-sheet-app','buxa-effect-sheet-app'],
    window:{icon:'fa-solid fa-bolt',resizable:true}
  };
  static PARTS = {body:{template:TEMPLATE_PATHS.EFFECT_SHEET,scrollable:['.buxa-item-sheet-scroll']}};
  get title(){return `${this.item?.name || 'Effect'} · Effect`;}
  async _prepareContext(options) {
    const context=await super._prepareContext(options);
    const config=getSheetConfig(),rules=getEffectRules(this.item,config);
    const effectRarity=getEffectRarity(this.item,config);
    const effectTheme=rarityPresentation(effectRarity,config.items);
    // Existing Item tooltip builders are the source of truth for resource,
    // dice, increase and modular-description presentation. No flag rewrite.
    const previewItem=Object.create(this.item);
    previewItem.getFlag=(module,flag)=>flag==='item' ? normalizeItemRules({...rules,rarityId:rules.rarityId},config.items)
      : this.item.getFlag?.(module,flag);
    const presentation=buildItemPresentation(previewItem,{actor:this.item?.parent,config});
    const itemUse=itemUseView(previewItem,config);
    const active=this.item?.parent?.documentName==='Actor'
      ? getActiveEffects(this.item.parent).find(e=>e.effectItemId===this.item.id):null;
    const duration=effectDurationText(rules,active);
    const triggers=[
      ['onApply','Applied','fa-wand-magic-sparkles'],['onRemove','Removed','fa-arrow-right-from-bracket'],
      ['onCombatTurnStart','Turn start','fa-play'],['onCombatTurnEnd','Turn end','fa-stop']
    ].filter(([key])=>rules.triggers[key]).map(([key,label,icon])=>({key,label,icon}));
    return {...context,...presentation,item:this.item,
      rarity: {...effectRarity},rarityClass:effectTheme.className,rarityStyle:effectTheme.style,
      behavior:rules.behavior==='passive'?'Passive':'Timed',
      isTimed:rules.behavior==='timed',duration:rules.behavior==='passive'?'':rules.duration.mode==='permanent'?'Permanent':`${rules.duration.value} turns`,
      stackRule:rules.stackBehavior,tickLabel:rules.tickLabel,triggers,hasTriggers:triggers.length>0,
      active,activeDuration:duration,expiresSoon:active&&duration==='Expires this turn',
      hasStacks:(active?.stackCount || 0)>1,itemUse,
      hasDice:presentation.diceLines?.length>0,hasIncreases:presentation.increaseLines?.length>0,
      hasDescriptionParts:presentation.descriptionParts?.length>0,
      hasConfiguredDetails:!!(rules.resourceEffects.length||rules.increases.length||rules.dice.length||
        rules.description.enabled||triggers.length)};
  }
}
