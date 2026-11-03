import { enableWindowResize } from "./window-resize.js";
import { createSheetClickSafety, installSheetClickSafety } from "../core/sheet-click-safety.js";
import { stackArtworkFor } from "../core/item-stack-artwork.js";
import { getItemQuantity } from "../core/dnd5e.js";
import { enhanceItemSheetArtwork } from "./item-artwork.js";
import { TEMPLATE_PATHS } from "../core/constants.js";
import { getSheetConfig } from "../core/config.js";
import { EQUIPMENT_SLOT_DEFINITIONS } from "../core/inventory-config.js";
import { buildItemPresentation, formatItemCardLabel } from "../core/item-presentation.js";
import { getItemRequirementState, itemUnitWeight } from "../core/item-runtime.js";
import { bindItemSheetUse, itemUseView } from "./item-use-actions.js";
import { BuxaItemConfig } from "./item-config.js";
import { buildStorageTooltip } from "../core/storage-tooltip.js";
import { normalizeItemSystemConfig } from "../core/item-config.js";
import { getItemKind } from "../core/effect-config.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

function formatNumber(value) {
  const number = Math.round((Number(value) || 0) * 100) / 100;
  return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function decorationGroups(groups = {}) {
  const decorate = (entries) => (entries ?? []).map((entry) => ({
    ...entry,
    divider: entry.type === "divider",
    symbolsType: entry.type === "symbols",
    textType: entry.type === "text",
    spacer: entry.type === "spacer"
  }));
  return {
    beforeDice: decorate(groups.beforeDice),
    between: decorate(groups.between),
    beforeDescription: decorate(groups.beforeDescription)
  };
}

export class BuxaItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["buxa", "buxa-item-sheet-app"],
    tag: "div",
    position: { width: 480, height: 520 },
    window: { icon: "fa-solid fa-gem", resizable: true },
    actions: {
      configureBuxaItem: BuxaItemSheet.#configureBuxaItem
    }
  };

  static PARTS = { body: { template: TEMPLATE_PATHS.ITEM_SHEET, scrollable: [".buxa-item-sheet-scroll"] } };

  constructor(options = {}) {
    super(options);
    this._clickSafety = createSheetClickSafety();
    this._detachClickSafety = null;
    this._clickSafetyRoot = null;
  }

  get title() { return this.item?.name || "Item"; }

  async _onRender(context, options) {
    await super._onRender(context, options);
    if (this._clickSafetyRoot !== this.element) {
      this._detachClickSafety?.();
      this._clickSafetyRoot = this.element;
      this._detachClickSafety = installSheetClickSafety(this.element, this._clickSafety);
    }
    enableWindowResize(this);
    enhanceItemSheetArtwork(this.element);
    bindItemSheetUse(this.element,this.item);
  }

  async _preClose(options) {
    this._detachClickSafety?.();
    this._detachClickSafety = null;
    this._clickSafetyRoot = null;
    this._clickSafety.reset();
    return super._preClose(options);
  }

  // Foundry temporarily collapses ApplicationV2 to a narrow title bar.
  // Its built-in controls must stay clickable instead of being covered by
  // Buxa's custom resize grip (which belongs on expanded windows only).
  async minimize(...args) {
    const grip = this.element?.querySelector?.("[data-buxa-window-resize]");
    if (grip) grip.hidden = true;
    try { return await super.minimize(...args); }
    catch (error) { if (grip) grip.hidden = false; throw error; }
  }

  async maximize(...args) {
    const result = await super.maximize(...args);
    const grip = this.element?.querySelector?.("[data-buxa-window-resize]");
    if (grip) grip.hidden = false;
    else enableWindowResize(this);
    return result;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const config = getSheetConfig();
    const presentation = buildItemPresentation(this.item, { actor: this.item?.parent, config });
    const { rules } = presentation;
    const storage = buildStorageTooltip(rules.storage, presentation.rarity?.color, normalizeItemSystemConfig(config.items).rarities);
    const storageTooltip = storage && {
      ...storage,
      title: formatItemCardLabel(storage.title),
      rows: storage.rows.map((row) => ({
        ...row,
        label: formatItemCardLabel(row.label),
        value: formatItemCardLabel(row.value)
      }))
    };
    const requirement = getItemRequirementState(this.item, this.item?.parent, config);
    const itemUse = itemUseView(this.item,config);
    const hasConfiguredDetails = Boolean(storageTooltip || itemUse.limits.enabled || itemUse.hasResourceEffects ||
      (itemUse.showStandaloneUse && itemUse.isOwned) ||
      presentation.diceLines.length || presentation.increaseLines.length || presentation.descriptionParts.length ||
      Object.values(presentation.decorations).some(group => group.length));
    const slotLabels = rules.equip.any
      ? ["Any slot"]
      : rules.equip.allowedTypes.map((id) => formatItemCardLabel(EQUIPMENT_SLOT_DEFINITIONS.find((entry) => entry.id === id)?.label || id.toUpperCase()));
    return {
      ...context,
      ...presentation,
      itemUse,
      stackArtwork: stackArtworkFor(this.item,getItemQuantity(this.item)),
      storageTooltip,
      hasStorageTooltip: Boolean(storageTooltip),
      hasDescriptionParts: presentation.descriptionParts.length > 0,
      diceLines: presentation.diceLines,
      increaseLines: presentation.increaseLines,
      item: this.item,
      isGM: game.user.isGM,
      requirement,
      requirementClass: requirement.enabled && requirement.actorLevel !== null ? (requirement.met ? "is-met" : "is-unmet") : "",
      slotLabels,
      unitWeightText: formatNumber(itemUnitWeight(this.item, config)),
      decorations: decorationGroups(presentation.decorations),
      hasDice: presentation.diceLines.length > 0,
      hasIncreases: presentation.increaseLines.length > 0,
      hasConfiguredDetails
    };
  }

  static async #configureBuxaItem(event) {
    event?.preventDefault?.();
    if (!game.user.isGM || !this.item) return null;
    const ConfigClass = getItemKind(this.item) === 'effect'
      ? (await import('./effect-config.js')).BuxaEffectConfig : BuxaItemConfig;
    const app = new ConfigClass({
      item: this.item,
      onSave: async () => {
        if (this.rendered) await this.render({ force: true });
      }
    });
    return app.render({ force: true });
  }
}

export function openBuxaItemSheet(item) {
  if (!item) return null;
  if (getItemKind(item) === 'effect') {
    return import('./effect-sheet.js').then(({ BuxaEffectSheet }) => new BuxaEffectSheet({document:item}).render({force:true}));
  }
  return new BuxaItemSheet({ document: item }).render({ force: true });
}
