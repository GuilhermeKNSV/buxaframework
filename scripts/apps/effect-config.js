/** Effect configuration shares Buxa's existing item-rule form controls. */
import { bindEffectConfigUi } from './effect-config-ui.js';
import { BuxaItemConfig } from './item-config.js';
import { TEMPLATE_PATHS, MODULE_ID } from '../core/constants.js';
import { getEffectRules, saveEffectRules, getItemKind } from '../core/effect-config.js';
import { getSheetConfig } from '../core/config.js';
import { itemRarityOptions } from '../core/item-config.js';
import { increaseViews, diceViews } from './item-config-views.js';
import { parseModifierSelection } from '../core/item-dice-config.js';
import { mountItemUseEditor, readItemUseEditor } from './item-use-editor.js';
import { normalizeDescriptionParts } from '../core/item-discovery.js';
import { notifySuccess } from '../core/notifications.js';

export class BuxaEffectConfig extends BuxaItemConfig {
  static DEFAULT_OPTIONS = {
    ...BuxaItemConfig.DEFAULT_OPTIONS,
    classes:['buxa','buxa-item-config-app','buxa-effect-config-app'],
    window:{title:'Buxa Framework · Effect Configuration',icon:'fa-solid fa-bolt',resizable:true},
    form:{handler:BuxaEffectConfig.#onSubmit,closeOnSubmit:true,submitOnChange:false}
  };
  static PARTS = {
    form:{template:TEMPLATE_PATHS.EFFECT_CONFIG,scrollable:['.buxa-item-config-scroll']},
    footer:{template:TEMPLATE_PATHS.ITEM_CONFIG_FOOTER}
  };
  get title() {return `Buxa · Effect · ${this.item?.name || 'Effect'}`;}
  async _prepareContext(options) {
    const base = await super._prepareContext(options);
    const config = getSheetConfig();
    const rules = getEffectRules(this.item,config);
    const kind = getItemKind(this.item);
    return {...base,rules,itemKind:kind,kindEffect:kind==='effect',kindItem:kind==='item',kindMagic:kind==='magic',
      rarities:itemRarityOptions(config,rules.rarityId),increases:increaseViews(rules,config),dice:diceViews(rules,config),
      descriptionStandard:rules.description.mode==='standard',descriptionModular:rules.description.mode==='modular',
      descriptionParts:rules.description.parts.map(part=>({...part,
        isRevealed:part.visibility==='revealed',isLocked:part.visibility==='locked',
        isHidden:part.visibility==='hidden',isDmOnly:part.visibility==='dmOnly',
        joinSpace:part.join==='space',joinNone:part.join==='none',joinLine:part.join==='line'})),
      behaviorTimed:rules.behavior==='timed',behaviorPassive:rules.behavior==='passive',
      stackReplace:rules.stackBehavior==='replace',stackStack:rules.stackBehavior==='stack',stackRefresh:rules.stackBehavior==='refresh',
      durationTurns:rules.duration.mode==='turns',durationPermanent:rules.duration.mode==='permanent',
      visibilityRevealed:rules.visibility==='revealed',visibilityHidden:rules.visibility==='hidden',visibilityDmOnly:rules.visibility==='dmOnly',
      activeConfigTabs:Object.fromEntries(['info','behavior','resource','dice','increase','description'].map(tab=>[tab,tab===this._activeTab]))};
  }
  async _onRender(context, options) {
    await super._onRender(context,options);
    const root=this.element, config=getSheetConfig(),rules=getEffectRules(this.item,config);
    // The common resource editor is mounted with the Effect rules, not the
    // ordinary Item flag. Move the live controls, never clone their handlers.
    const host=root.ownerDocument.createElement('div');
    host.innerHTML='<nav class="buxa-item-config-tabs"></nav><div class="buxa-item-config-stack" data-item-config-panel="image"></div>';
    mountItemUseEditor(host,rules,config,this.item);
    const correct=host.querySelector('[data-item-config-panel="resource"]');
    const former=root.querySelector('[data-item-config-panel="resource"]');
    if(correct){ if(former) former.replaceWith(correct); else root.querySelector('[data-item-config-panel="behavior"]')?.after(correct);}
    root.querySelector('[data-item-config-panel="limits"]')?.remove();
    for(const button of [...root.querySelectorAll('[data-item-config-tab="resource"]')].slice(1)) button.remove();
    root.querySelector('[data-item-config-tab="limits"]')?.remove();
    bindEffectConfigUi(root,{activeTab:this._activeTab,onSelect:tab=>{this._activeTab=tab;}});
  }
  static async #onSubmit() {
    if(!globalThis.game?.user?.isGM || !this.item)return;
    const root=this.element,config=getSheetConfig();
    const revealData = (row) => ({
      mergeInto: row.querySelector("[data-item-increase-merge-into]")?.value || "",
      rarityId: row.querySelector("[data-item-reveal-rarity]")?.value || "",
      label: row.querySelector("[data-item-reveal-label]")?.value || "",
      icon: row.querySelector("[data-item-reveal-icon]")?.value || "",
      style: row.querySelector("[data-item-reveal-style]")?.value || "keep",
      color: row.querySelector("[data-item-reveal-color]")?.value || "#b8c3d2",
      tooltipRarityId: row.querySelector("[data-item-reveal-color-rarity]")?.value || ""
    });
    const increases = [...root.querySelectorAll("[data-item-increase-row]")].map((row) => ({
      id: row.dataset.increaseId || foundry.utils.randomID(12),
      visibility: row.querySelector("[data-item-entry-visibility]")?.value || "revealed",
      reveal: revealData(row),
      target: row.querySelector("[data-item-increase-target]")?.value || "stat:damageReduction:value",
      mode: row.querySelector("[data-item-increase-mode]")?.value === "percent" ? "percent" : "flat",
      activation: row.querySelector("[data-item-increase-activation]")?.value === "passive" ? "passive" : "equipped",
      value: Number(row.querySelector("[data-item-increase-value]")?.value ?? 0),
      tooltip: {
        enabled: Boolean(row.querySelector("[data-item-increase-tooltip-enabled]")?.checked),
        style: row.querySelector("[data-item-increase-tooltip-style]")?.value || "neutral",
        rarityId: row.querySelector("[data-item-increase-tooltip-rarity]")?.value || "",
        color: row.querySelector("[data-item-increase-tooltip-color]")?.value || "#b8c3d2",
        label: row.querySelector("[data-item-increase-tooltip-label]")?.value || "",
        icon: row.querySelector("[data-item-tooltip-icon]")?.value || ""
      }
    }));

    const dice = [...root.querySelectorAll("[data-item-dice-row]")].map((row) => {
      const modifier = parseModifierSelection(row.querySelector("[data-item-dice-modifier]")?.value || "none:");
      return {
        id: row.dataset.diceId || foundry.utils.randomID(12),
        visibility: row.querySelector("[data-item-entry-visibility]")?.value || "revealed",
        reveal: revealData(row),
        label: row.querySelector("[data-item-dice-label]")?.value || "Damage",
        count: Number(row.querySelector("[data-item-dice-count]")?.value ?? 1),
        faces: Number(row.querySelector("[data-item-dice-faces]")?.value ?? 20),
        attributeDice: {
          enabled: Boolean(row.querySelector("[data-item-dice-attribute-enabled]")?.checked),
          attributeId: row.querySelector("[data-item-dice-attribute-id]")?.value || "",
          faces: Number(row.querySelector("[data-item-dice-attribute-faces]")?.value ?? 20)
        },
        modifier,
        flat: Number(row.querySelector("[data-item-dice-flat]")?.value ?? 0),
        rollMode: row.querySelector("[data-item-dice-roll-mode]")?.value || "normal",
        showRange: Boolean(row.querySelector("[data-item-dice-show-range]")?.checked),
        chatRoll: Boolean(row.querySelector("[data-item-dice-chat-roll]")?.checked),
        tooltip: {
          enabled: Boolean(row.querySelector("[data-item-dice-tooltip-enabled]")?.checked),
          style: row.querySelector("[data-item-dice-tooltip-style]")?.value || "neutral",
          rarityId: row.querySelector("[data-item-dice-tooltip-rarity]")?.value || "",
          color: row.querySelector("[data-item-dice-tooltip-color]")?.value || "#b8c3d2",
          label: row.querySelector("[data-item-dice-tooltip-label]")?.value || "",
          icon: row.querySelector("[data-item-tooltip-icon]")?.value || ""
        }
      };
    });


    const data = {
      name:root.querySelector('[data-item-name]')?.value ?? this.item.name,
      img:root.querySelector('[data-item-image]')?.value ?? this.item.img,
      rarityId:root.querySelector('[data-item-rarity]')?.value,
      behavior:root.querySelector('[name="bfx-behavior"]:checked')?.value || 'timed',
      duration:{mode:root.querySelector('[data-bfx-duration-mode]')?.value || 'turns',value:Number(root.querySelector('[data-bfx-duration-value]')?.value)||1},
      stackBehavior:root.querySelector('[name="bfx-stack"]:checked')?.value || 'refresh',
      triggers:Object.fromEntries(['onApply','onRemove','onCombatTurnStart','onCombatTurnEnd']
        .map(key=>[key,Boolean(root.querySelector(`[data-bfx-trigger="${key}"]`)?.checked)])),
      tickLabel:root.querySelector('[data-bfx-tick-label]')?.value || '',
      visibility:root.querySelector('[data-bfx-visibility]')?.value || 'revealed',
      description:{ enabled:Boolean(root.querySelector('[data-item-description-enabled]')?.checked),
        mode:root.querySelector('[data-item-description-mode]:checked')?.value || 'standard',
        text:root.querySelector('[data-item-description-text]')?.value || '',
        parts:[...root.querySelectorAll('[data-item-description-part]')].map(row=>({
          id:row.dataset.descriptionId||foundry.utils.randomID(12),
          text:row.querySelector('[data-description-text]')?.value||'',
          revealedText:row.querySelector('[data-description-reveal-text]')?.value||'',
          visibility:row.querySelector('[data-description-visibility]')?.value||'revealed',
          join:row.querySelector('[data-description-join]')?.value||'space'
        }))},
      increases,dice,resourceEffects:readItemUseEditor(root).resourceEffects
    };
    await saveEffectRules(this.item,data,config);
    const kind=root.querySelector('[data-buxa-item-kind]')?.value || 'effect';
    if(kind!=='effect') {
      // A converted Item or Magic must retain the Effect's selected rarity.
      await this.item.update({
        [`flags.${MODULE_ID}.item.rarityId`]: data.rarityId,
        [`flags.${MODULE_ID}.itemKind`]: kind
      });
    }
    await this._onSave?.(this.item);
    notifySuccess('Effect configuration saved.');
  }
}
