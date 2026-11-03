import { mountItemUseEditor, readItemUseEditor } from "./item-use-editor.js";
import { mountItemConfigNavigation } from "./item-config-navigation.js";
import { bindItemBoardImageEditor } from "./item-board-image-editor.js";
import { bindItemEquipSizeEditor } from "./item-equip-size-editor.js";
import { bindItemStackEditor } from "./item-stack-editor.js";
import { enableWindowResize } from "./window-resize.js";
import { bindItemStorageEditor, bindStorageTooltipEditor, readItemStorageEditor } from "./item-storage-editor.js";
import { normalizeItemShape } from "../core/inventory-shapes.js";
import { bindItemShapeEditor } from "./item-shape-editor.js";
import { browseItemImage } from "./item-config-image-picker.js";
import { createItemRuleEditor } from "./item-rule-editor.js";
import { notifySuccess } from "../core/notifications.js";
import { MODULE_ID, TEMPLATE_PATHS } from "../core/constants.js";
import { getSheetConfig } from "../core/config.js";
import { EQUIPMENT_SLOT_DEFINITIONS } from "../core/inventory-config.js";
import { buildItemIncreaseTargetOptions } from "../core/item-increase-config.js";
import { selectedOptions, increaseViews, diceViews, decorationViews } from "./item-config-views.js";
import {
  buildDiceAttributeOptions,
  buildDiceModifierOptions,
  parseModifierSelection
} from "../core/item-dice-config.js";
import { getItemRules, itemRarityOptions } from "../core/item-config.js";
import { saveItemRules } from "../core/item-runtime.js";
import { reconcileInventoryState } from "../core/inventory.js";
import { visibilityOf } from "../core/item-discovery.js";
import { buildItemControlEntries } from "../core/item-control.js";
import { bindItemControl } from "./item-control.js";
import { BuxaAssetBrowser } from "./asset-browser.js";
import { getItemKind } from "../core/effect-config.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class BuxaItemConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "buxa-item-config",
    classes: ["buxa", "buxa-item-config-app"],
    tag: "form",
    position: { width: 760, height: 760 },
    window: { title: "Buxa Framework · Item Configuration", icon: "fa-solid fa-hammer", resizable: true },
    form: { handler: BuxaItemConfig.#onSubmit, closeOnSubmit: true, submitOnChange: false },
    actions: { browseItemImage: BuxaItemConfig.#browseItemImage }
  };

  static PARTS = {
    form: { template: TEMPLATE_PATHS.ITEM_CONFIG, scrollable: [".buxa-item-config-scroll"] },
    footer: { template: TEMPLATE_PATHS.ITEM_CONFIG_FOOTER }
  };

  constructor({ item, onSave, ...options } = {}) {
    super({ id: `buxa-item-config-${item?.id || foundry.utils.randomID(6)}`, ...options });
    this.item = item;
    this._onSave = typeof onSave === "function" ? onSave : null;
    this._activeTab = "info";
    this._shapeDraft = null;
    this._boardImageDraft = null;
    this._equipArtworkDraft = null;
    this._stackImagesDraft = null;
    this._stackRulesSource = null;
  }

  get title() {
    const scope = this.item?.parent?.documentName === "Actor" ? "Instance" : "Template";
    return `Buxa · ${scope} Item · ${this.item?.name ?? "Item"}`;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const config = getSheetConfig();
    const rules = getItemRules(this.item, config);
    this._shapeDraft ??= foundry.utils.deepClone(rules.shape);
    this._boardImageDraft ??= foundry.utils.deepClone(rules.boardImage);
    this._equipArtworkDraft ??= foundry.utils.deepClone(rules.equipArtwork);
    this._stackRulesSource ??= foundry.utils.deepClone(rules.multiple.stackImages);
    this._configRarities=config.items?.rarities||[];
    const rarities = itemRarityOptions(config, rules.rarityId);
    const targets = buildItemIncreaseTargetOptions(config);
    return {
      ...context,
      activeConfigTabs: Object.fromEntries(['info','basic','stack','image','increase','dice','size','control','resource','limits'].map(key => [key,key===this._activeTab])),
      item: this.item,
      itemKind: getItemKind(this.item),
      kindItem: getItemKind(this.item) === 'item',
      kindMagic: getItemKind(this.item) === 'magic',
      kindEffect: getItemKind(this.item) === 'effect',
      rules: {...rules, boardImage:this._boardImageDraft},
      descriptionStandard: rules.description.mode === "standard",
      descriptionModular: rules.description.mode === "modular",
      controlEntries: buildItemControlEntries(rules, config),
      rarities,
      increaseTargets: selectedOptions(targets, "stat:damageReduction:value"),
      increases: increaseViews(rules, config),
      dice: diceViews(rules, config),
      decorations: decorationViews(rules, config),
      descriptionParts: (rules.description.parts || []).map((part) => ({
        ...part, isRevealed: part.visibility === "revealed", isLocked: part.visibility === "locked",
        isHidden: part.visibility === "hidden", isDmOnly: part.visibility === "dmOnly",
        joinSpace: part.join === "space", joinNone: part.join === "none", joinLine: part.join === "line"
      })),
      diceAttributeOptions: buildDiceAttributeOptions(config),
      diceModifierOptions: buildDiceModifierOptions(config),
      tooltipRarities: rarities,
      storageTooltipStyleItem: rules.storage.tooltip.style === "item",
      storageTooltipStyleNeutral: rules.storage.tooltip.style === "neutral",
      storageTooltipStyleCustom: rules.storage.tooltip.style === "custom",
      storageTooltipStyleRarity: rules.storage.tooltip.style === "rarity",
      storageTooltipRarities: itemRarityOptions(config, rules.storage.tooltip.rarityId),
      storageExternal: rules.storage.slots.external.map(entry=>({ ...entry,
        cellsText:entry.cells.join(','), isComplex:entry.mode==='complex',
        itemModeInherit:entry.itemMode==='inherit', itemModeSimple:entry.itemMode==='simple',
        itemModeComplex:entry.itemMode==='complex',
        styleItem:entry.rarityStyle==='item',styleNeutral:entry.rarityStyle==='neutral',styleCustom:entry.rarityStyle==='custom'
      })),
      hiddenEquipmentSlots: (config.inventory?.equipmentLayout?.slots||[]).filter(slot=>slot.hidden).map(slot=>({
        ...slot, checked:rules.storage.equipped.slotIds.includes(slot.id)
      })),
      slotTypes: EQUIPMENT_SLOT_DEFINITIONS.map((entry) => ({
        ...entry,
        checked: rules.equip.allowedTypes.includes(entry.id)
      }))
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    enableWindowResize(this);
    const root = this.element;
    bindItemShapeEditor(this, root);
    bindItemStackEditor(this, root);
    mountItemUseEditor(root, getItemRules(this.item, getSheetConfig()), getSheetConfig(), this.item);
    bindItemStorageEditor(root);
    bindStorageTooltipEditor(root);

    const setInactive = (selector, inactive) => {
      const element = root.querySelector(selector);
      if (!element) return;
      element.classList.toggle("is-disabled", inactive);
      element.setAttribute("aria-disabled", inactive ? "true" : "false");
    };

    const syncIncreaseRow = (row) => {
      if (!row) return;
      const style = row.querySelector("[data-item-increase-tooltip-style]")?.value || "neutral";
      const rarityField = row.querySelector("[data-item-increase-tooltip-rarity-wrap]");
      const colorField = row.querySelector("[data-item-increase-tooltip-color-wrap]");
      rarityField?.classList.toggle("is-disabled", style !== "rarity");
      colorField?.classList.toggle("is-disabled", style !== "custom");
      row.querySelector("[data-item-increase-tooltip-rarity]")?.toggleAttribute("disabled", style !== "rarity");
      row.querySelector("[data-item-increase-tooltip-color]")?.toggleAttribute("disabled", style !== "custom");
    };

    const syncDiceRow = (row) => {
      if (!row) return;
      const attributeEnabled = Boolean(row.querySelector("[data-item-dice-attribute-enabled]")?.checked);
      for (const button of row.querySelectorAll("[data-item-dice-source-option]")) {
        const selected = (button.dataset.itemDiceSourceOption === "attribute") === attributeEnabled;
        button.classList.toggle("is-active", selected);
        button.setAttribute("aria-pressed", String(selected));
      }
      row.querySelector("[data-item-dice-fixed-wrap]")?.classList.toggle("is-disabled", attributeEnabled);
      row.querySelector("[data-item-dice-count]")?.toggleAttribute("disabled", attributeEnabled);
      row.querySelector("[data-item-dice-faces]")?.toggleAttribute("disabled", attributeEnabled);
      row.querySelector("[data-item-dice-attribute-id]")?.toggleAttribute("disabled", !attributeEnabled);
      row.querySelector("[data-item-dice-attribute-faces]")?.toggleAttribute("disabled", !attributeEnabled);
      row.querySelector("[data-item-dice-attribute-wrap]")?.classList.toggle("is-disabled", !attributeEnabled);
      const style = row.querySelector("[data-item-dice-tooltip-style]")?.value || "neutral";
      row.querySelector("[data-item-dice-tooltip-rarity-wrap]")?.classList.toggle("is-disabled", style !== "rarity");
      row.querySelector("[data-item-dice-tooltip-color-wrap]")?.classList.toggle("is-disabled", style !== "custom");
      row.querySelector("[data-item-dice-tooltip-rarity]")?.toggleAttribute("disabled", style !== "rarity");
      row.querySelector("[data-item-dice-tooltip-color]")?.toggleAttribute("disabled", style !== "custom");
    };

    const syncMergeTargets = () => {
      const rows = [...root.querySelectorAll("[data-item-increase-row]")];
      for (const row of rows) {
        const select = row.querySelector("[data-item-increase-merge-into]");
        if (!select) continue;
        const previous = select.value || select.dataset.initialMerge || "";
        const candidates = rows.filter((other) => other !== row
          && other.querySelector("[data-item-increase-target]")?.value === row.querySelector("[data-item-increase-target]")?.value
          && other.querySelector("[data-item-increase-mode]")?.value === row.querySelector("[data-item-increase-mode]")?.value
          && other.querySelector("[data-item-increase-activation]")?.value === row.querySelector("[data-item-increase-activation]")?.value);
        select.replaceChildren();
        const add = (value, label) => {
          const option = root.ownerDocument.createElement("option");
          option.value = value; option.textContent = label; select.append(option);
        };
        add("", "Keep separate");
        for (const other of candidates) add(other.dataset.increaseId, `Merge with ${other.querySelector("[data-buxa-rule-title]")?.textContent || other.dataset.increaseId}`);
        if (previous && !candidates.some((other) => other.dataset.increaseId === previous)) add(previous, "Unavailable target (will display separately)");
        select.value = previous;
        delete select.dataset.initialMerge;
      }
    };

    const syncDecorationRow = (row) => {
      if (!row) return;
      const type = row.querySelector("[data-item-decoration-type]")?.value || "divider";
      row.querySelector("[data-item-decoration-text-wrap]")?.classList.toggle("is-disabled", !["symbols", "text"].includes(type));
      row.querySelector("[data-item-decoration-count-wrap]")?.classList.toggle("is-disabled", type !== "symbols");
      row.querySelector("[data-item-decoration-text]")?.toggleAttribute("disabled", !["symbols", "text"].includes(type));
      row.querySelector("[data-item-decoration-count]")?.toggleAttribute("disabled", type !== "symbols");
      const style = row.querySelector("[data-item-decoration-style]")?.value || "neutral";
      row.querySelector("[data-item-decoration-rarity-wrap]")?.classList.toggle("is-disabled", style !== "rarity");
      row.querySelector("[data-item-decoration-color-wrap]")?.classList.toggle("is-disabled", style !== "custom");
      row.querySelector("[data-item-decoration-rarity]")?.toggleAttribute("disabled", style !== "rarity");
      row.querySelector("[data-item-decoration-color]")?.toggleAttribute("disabled", style !== "custom");
    };

    const sync = () => {
      const description = Boolean(root.querySelector("[data-item-description-enabled]")?.checked);
      const level = Boolean(root.querySelector("[data-item-level-enabled]")?.checked);
      const weight = Boolean(root.querySelector("[data-item-weight-enabled]")?.checked);
      const typeLabel = Boolean(root.querySelector("[data-item-type-label-enabled]")?.checked);
      const equipMode = root.querySelector("[data-item-equip-mode]:checked")?.value || "none";
      const stackMode = root.querySelector("[data-item-multiple-mode]:checked")?.value || "single";

      setInactive("[data-item-description-body]", !description);
      const descriptionMode = root.querySelector("[data-item-description-mode]:checked")?.value || "standard";
      root.querySelector("[data-item-description-standard]")?.toggleAttribute("hidden", descriptionMode !== "standard");
      root.querySelector("[data-item-description-modular]")?.toggleAttribute("hidden", descriptionMode !== "modular");
      root.querySelector("[data-item-description-text]")?.toggleAttribute("disabled", !description || descriptionMode !== "standard");
      setInactive("[data-item-level-body]", !level);
      root.querySelector("[data-item-level-value]")?.toggleAttribute("disabled", !level);
      setInactive("[data-item-weight-body]", !weight);
      root.querySelector("[data-item-weight-value]")?.toggleAttribute("disabled", !weight);
      setInactive("[data-item-type-label-body]", !typeLabel);
      root.querySelector("[data-item-type-label]")?.toggleAttribute("disabled", !typeLabel);

      const restricted = equipMode === "restricted";
      setInactive("[data-item-equip-types]", !restricted);
      root.querySelectorAll("[data-item-equip-type]").forEach((input) => input.toggleAttribute("disabled", !restricted));

      const stackNote = root.querySelector("[data-item-stack-note]");
      stackNote?.classList.toggle("is-active", stackMode === "stackable");
      const maxStack = root.querySelector("[data-item-max-stack]");
      if (maxStack) maxStack.disabled = stackMode !== "stackable";
      root.querySelector("[data-item-stack-max-wrap]")?.classList.toggle("is-disabled", stackMode !== "stackable");
      root.querySelectorAll("[data-item-increase-row]").forEach(syncIncreaseRow);
      root.querySelectorAll("[data-item-dice-row]").forEach(syncDiceRow);
      root.querySelectorAll("[data-item-decoration-row]").forEach(syncDecorationRow);
      syncMergeTargets();
    };

    // After Resource and Limits mount, group the original live editors into
    // category/sub-tab navigation. This moves nodes, not input data or rules.
    this._tabNavigation = mountItemConfigNavigation(root, {
      activeTab: this._activeTab,
      onSelect: (tab) => { this._activeTab = tab; }
    });

    bindItemControl(root, { item: this.item, onSave: this._onSave });
    bindItemBoardImageEditor(root, this);
    bindItemEquipSizeEditor(root, this);

    root.querySelector("[data-item-add-increase]")?.addEventListener("click", (event) => {
      event.preventDefault();
      const template = root.querySelector("template[data-item-increase-template]");
      const list = root.querySelector("[data-item-increase-list]");
      if (!template || !list) return;
      const fragment = template.content.cloneNode(true);
      const row = fragment.querySelector("[data-item-increase-row]");
      if (row) row.dataset.increaseId = foundry.utils.randomID(12);
      list.append(fragment);
      syncIncreaseRow(list.lastElementChild);
      this._ruleEditor?.refresh();
      syncMergeTargets();
      list.lastElementChild?.querySelector("select, input")?.focus?.();
    });

    root.querySelector("[data-item-add-dice]")?.addEventListener("click", (event) => {
      event.preventDefault();
      const template = root.querySelector("template[data-item-dice-template]");
      const list = root.querySelector("[data-item-dice-list]");
      if (!template || !list) return;
      const fragment = template.content.cloneNode(true);
      const row = fragment.querySelector("[data-item-dice-row]");
      if (row) row.dataset.diceId = foundry.utils.randomID(12);
      list.append(fragment);
      syncDiceRow(list.lastElementChild);
      this._ruleEditor?.refresh();
      list.lastElementChild?.querySelector("input, select")?.focus?.();
    });

    root.querySelector("[data-item-add-decoration]")?.addEventListener("click", (event) => {
      event.preventDefault();
      const template = root.querySelector("template[data-item-decoration-template]");
      const list = root.querySelector("[data-item-decoration-list]");
      if (!template || !list) return;
      const fragment = template.content.cloneNode(true);
      const row = fragment.querySelector("[data-item-decoration-row]");
      if (row) row.dataset.decorationId = foundry.utils.randomID(12);
      list.append(fragment);
      syncDecorationRow(list.lastElementChild);
      list.lastElementChild?.querySelector("input, select")?.focus?.();
    });

    root.querySelector("[data-add-description-part]")?.addEventListener("click", (event) => {
      event.preventDefault();
      const template = root.querySelector("template[data-item-description-template]");
      const list = root.querySelector("[data-item-description-list]");
      if (!template || !list) return;
      const clone = template.content.cloneNode(true);
      const row = clone.querySelector("[data-item-description-part]");
      if (row) row.dataset.descriptionId = foundry.utils.randomID(12);
      list.append(clone);
      list.lastElementChild?.querySelector("textarea")?.focus();
    });

    root.addEventListener("click", (event) => {
      const sourceButton = event.target.closest?.("[data-item-dice-source-option]");
      if (sourceButton) {
        event.preventDefault();
        const row = sourceButton.closest("[data-item-dice-row]");
        const sourceInput = row?.querySelector("[data-item-dice-attribute-enabled]");
        if (sourceInput) {
          sourceInput.checked = sourceButton.dataset.itemDiceSourceOption === "attribute";
          syncDiceRow(row);
          sourceInput.dispatchEvent(new Event("change", { bubbles: true }));
        }
        return;
      }
      const removePart = event.target.closest?.("[data-remove-description-part]");
      if (removePart) { event.preventDefault(); removePart.closest("[data-item-description-part]")?.remove(); return; }
      const removeIncrease = event.target.closest?.("[data-item-remove-increase]");
      if (removeIncrease) {
        event.preventDefault();
        removeIncrease.closest("[data-item-increase-row]")?.remove();
        this._ruleEditor?.refresh();
        syncMergeTargets();
        return;
      }
      const removeDice = event.target.closest?.("[data-item-remove-dice]");
      if (removeDice) {
        event.preventDefault();
        removeDice.closest("[data-item-dice-row]")?.remove();
        this._ruleEditor?.refresh();
        return;
      }
      const removeDecoration = event.target.closest?.("[data-item-remove-decoration]");
      if (removeDecoration) {
        event.preventDefault();
        removeDecoration.closest("[data-item-decoration-row]")?.remove();
        return;
      }
      const browseIcon = event.target.closest?.("[data-item-tooltip-icon-browse]");
      if (browseIcon) {
        event.preventDefault();
        const row = browseIcon.closest("[data-item-increase-row], [data-item-dice-row]");
        const input = row?.querySelector?.("[data-item-tooltip-icon]");
        if (!input) return;
        const picker = new BuxaAssetBrowser({
          type: "image",
          current: input.value || "",
          title: "Buxa · Tooltip Icon",
          onSelect: async (path) => {
            if (!path || !row?.isConnected) return;
            const current = row.querySelector('[data-item-tooltip-icon]');
            if (!current?.isConnected) return;
            current.value = path;
            const EventClass = current.ownerDocument?.defaultView?.Event ?? Event;
            current.dispatchEvent(new EventClass('change', { bubbles:true }));
          }
        });
        void picker.render({ force: true });
      }
    });

    root.addEventListener("change", (event) => {
      if (event.target.matches?.("[data-item-increase-tooltip-style]")) syncIncreaseRow(event.target.closest("[data-item-increase-row]"));
      if (event.target.matches?.("[data-item-dice-tooltip-style], [data-item-dice-attribute-enabled]")) syncDiceRow(event.target.closest("[data-item-dice-row]"));
      if (event.target.matches?.("[data-item-decoration-type], [data-item-decoration-style]")) syncDecorationRow(event.target.closest("[data-item-decoration-row]"));
      if (event.target.matches?.("[data-item-increase-target], [data-item-increase-mode], [data-item-increase-activation]")) syncMergeTargets();
    });

    root.querySelectorAll([
      "[data-item-description-enabled]",
      "[data-item-description-mode]",
      "[data-item-level-enabled]",
      "[data-item-weight-enabled]",
      "[data-item-type-label-enabled]",
      "[data-item-equip-mode]",
      "[data-item-multiple-mode]"
    ].join(",")).forEach((input) => input.addEventListener("change", sync));

    sync();
    this._ruleEditor?.destroy();
    this._ruleEditor = createItemRuleEditor(root);
  }

  async _onClose(options) {
    this._stackModalCleanup?.();
    this._stackModalCleanup=null;
    this._ruleEditor?.destroy();
    this._ruleEditor = null;
    await super._onClose(options);
  }

  static async #browseItemImage() { return browseItemImage(this); }

  static async #onSubmit() {
    if (!game.user.isGM || !this.item) return;
    const root = this.element;
    const config = getSheetConfig();
    const previous = getItemRules(this.item, config);
    const allowedTypes = [...root.querySelectorAll("[data-item-equip-type]:checked")].map((input) => input.value);
    const equipMode = root.querySelector("[data-item-equip-mode]:checked")?.value || "none";
    const stackMode = root.querySelector("[data-item-multiple-mode]:checked")?.value || "single";
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

    const decorations = [...root.querySelectorAll("[data-item-decoration-row]")].map((row) => ({
      id: row.dataset.decorationId || foundry.utils.randomID(12),
      type: row.querySelector("[data-item-decoration-type]")?.value || "divider",
      placement: row.querySelector("[data-item-decoration-placement]")?.value || "between",
      text: row.querySelector("[data-item-decoration-text]")?.value || "",
      count: Number(row.querySelector("[data-item-decoration-count]")?.value ?? 3),
      style: row.querySelector("[data-item-decoration-style]")?.value || "neutral",
      rarityId: row.querySelector("[data-item-decoration-rarity]")?.value || "",
      color: row.querySelector("[data-item-decoration-color]")?.value || "#b8c3d2"
    }));

    const data = {
      name: root.querySelector("[data-item-name]")?.value ?? this.item.name,
      disableLooting: Boolean(root.querySelector("[data-item-disable-looting]")?.checked),
      boardImage: this._boardImageDraft,
      equipArtwork: this._equipArtworkDraft,
      img: root.querySelector("[data-item-image]")?.value ?? this.item.img,
      description: {
        enabled: Boolean(root.querySelector("[data-item-description-enabled]")?.checked),
        mode: root.querySelector("[data-item-description-mode]:checked")?.value || "standard",
        text: root.querySelector("[data-item-description-text]")?.value || "",
        parts: [...root.querySelectorAll("[data-item-description-part]")].map((row) => ({
          id: row.dataset.descriptionId || foundry.utils.randomID(12),
          text: row.querySelector("[data-description-text]")?.value || "",
          revealedText: row.querySelector("[data-description-reveal-text]")?.value || "",
          visibility: row.querySelector("[data-description-visibility]")?.value || "revealed",
          join: row.querySelector("[data-description-join]")?.value || "space"
        }))
      },
      levelRequirement: {
        enabled: Boolean(root.querySelector("[data-item-level-enabled]")?.checked),
        level: Number(root.querySelector("[data-item-level-value]")?.value ?? 1)
      },
      equip: { enabled: equipMode !== "none", any: equipMode === "any", allowedTypes },
      weight: {
        enabled: Boolean(root.querySelector("[data-item-weight-enabled]")?.checked),
        value: Number(root.querySelector("[data-item-weight-value]")?.value ?? 0)
      },
      multiple: { enabled: stackMode === "stackable", stackKey: previous.multiple.stackKey,
        maxStack: Math.min(999999, Math.max(1, Math.round(Number(root.querySelector("[data-item-max-stack]")?.value) || 99))),
        stackImages: this._stackImagesDraft ?? previous.multiple.stackImages },
      typeLabel: {
        enabled: Boolean(root.querySelector("[data-item-type-label-enabled]")?.checked),
        label: root.querySelector("[data-item-type-label]")?.value ?? ""
      },
      increases,
      dice,
      ...readItemUseEditor(root),
      decorations,
      shape: this._shapeDraft,
      storage: readItemStorageEditor(root),
      rarityId: root.querySelector("[data-item-rarity]")?.value || "common"
    };
    // Changing a state in configuration should have the same rarity result as
    // clicking Reveal in the configuration Control tab.
    const oldRows = [ ...(previous.increases || []), ...(previous.dice || []) ];
    const rarityIds = new Set(config.items?.rarities?.map((r) => r.id) || []);
    for (const entry of [ ...increases, ...dice ]) {
      const prior = oldRows.find((r) => r.id === entry.id);
      if (prior && visibilityOf(prior) !== "revealed" && entry.visibility === "revealed"
        && rarityIds.has(entry.reveal.rarityId)) data.rarityId = entry.reveal.rarityId;
    }
    await saveItemRules(this.item, data, config);
    const kind = root.querySelector('[data-buxa-item-kind]')?.value || getItemKind(this.item);
    if (kind !== getItemKind(this.item)) {
      if (kind === 'effect') {
        // Preserve the chosen rarity across Item/Magic -> Effect conversion.
        // Keep any existing effect-specific rules intact.
        await this.item.update({
          [`flags.${MODULE_ID}.effect.rarityId`]: data.rarityId,
          [`flags.${MODULE_ID}.itemKind`]: kind
        });
      } else await this.item.setFlag(MODULE_ID, 'itemKind', kind);
    }
    if (this.item.parent?.documentName === "Actor" || this.item.parent?.constructor?.name === "Actor") {
      await reconcileInventoryState(this.item.parent, getSheetConfig());
    }
    await this._onSave?.(this.item);
    notifySuccess("Item configuration saved.");
  }
}
