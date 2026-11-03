import { enableWindowResize } from "./window-resize.js";
import { notifySuccess, notifyWarning } from "../core/notifications.js";
import { MODULE_ID, RESOURCE_LINKS, TEMPLATE_PATHS } from "../core/constants.js";
import {
  createAttribute,
  createCustomResource,
  createField,
  getSheetConfig,
  normalizeSheetConfig,
  setSheetConfig
} from "../core/config.js";
import { getAbilityOptions } from "../core/dnd5e.js";
import { createProficiency } from "../core/proficiency-config.js";
import { reconcileInventoryState } from "../core/inventory.js";
import { synchronizeConfiguredResourceLabels } from "../core/resources.js";
import { refreshOpenBuxaSheets, reconcileConfiguredInventories, syncStatsChoices, syncProficiencyModeUi } from "./layout-config-sync.js";
import { BuxaEquipmentLayout } from "./equipment-layout.js";
import { PHYSICAL_SETTINGS, normalizePhysicalSettings } from "../core/physical-items.js";
import { openEntrySvgPicker } from "./layout-config-icon.js";
import { openIconSourcePicker } from "./layout-config-icon-source.js";
import { openSequencerAssetPicker, setGameIconsFolder } from "./layout-config-vfx-picker.js";
import { applyConfigNavigation, bindConfigNavigation } from "./layout-config-navigation.js";
import { bindLayoutConfigPresentation } from "./layout-config-presentation.js";
import { bindConfigWidgets } from "./layout-config-widgets.js";
import { previewWarningSettings, readWarningSettings } from "./layout-config-notifications.js";
import { bindRarityConfig, readRarityBackground, readRarityRows } from "./rarity-config.js";
import {
  RESOURCE_LINK_OPTIONS,
  RESTORE_OPTIONS,
  attributeRowHtml,
  checked,
  fieldRowHtml,
  moveRow,
  numberValue,
  readAttributeRows,
  readFieldRows,
  readRebirthStyles,
  readResourceRows,
  readProficiencyRows,
  proficiencyRowHtml,
  rebirthAttributeRowHtml,
  rebirthStyleRowHtml,
  resourceRowHtml,
  romanNumeral,
  syncRebirthRuleOrder,
  value
} from "./layout-config-helpers.js";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
export class BuxaLayoutConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "buxa-layout-config",
    classes: ["buxa", "buxa-layout-config-app"],
    tag: "form",
    position: { width: 900, height: 760 },
    window: {
      title: "Buxa Framework · Module Configuration",
      icon: "fa-solid fa-table-columns",
      resizable: true
    },
    form: {
      handler: BuxaLayoutConfig.#onSubmit,
      closeOnSubmit: false,
      submitOnChange: false
    },
    actions: {
      addField: BuxaLayoutConfig.#addField,
      removeField: BuxaLayoutConfig.#removeField,
      moveFieldUp: BuxaLayoutConfig.#moveFieldUp,
      moveFieldDown: BuxaLayoutConfig.#moveFieldDown,
      addResource: BuxaLayoutConfig.#addResource,
      removeResource: BuxaLayoutConfig.#removeResource,
      moveResourceUp: BuxaLayoutConfig.#moveResourceUp,
      moveResourceDown: BuxaLayoutConfig.#moveResourceDown,
      addAttribute: BuxaLayoutConfig.#addAttribute,
      removeAttribute: BuxaLayoutConfig.#removeAttribute,
      moveAttributeUp: BuxaLayoutConfig.#moveAttributeUp,
      moveAttributeDown: BuxaLayoutConfig.#moveAttributeDown,
      addProficiency: BuxaLayoutConfig.#addProficiency,
      removeProficiency: BuxaLayoutConfig.#removeProficiency,
      moveProficiencyUp: BuxaLayoutConfig.#moveProficiencyUp,
      moveProficiencyDown: BuxaLayoutConfig.#moveProficiencyDown,
      addRebirthStyle: BuxaLayoutConfig.#addRebirthStyle,
      removeRebirthStyle: BuxaLayoutConfig.#removeRebirthStyle,
      organizeEquipmentLayout: BuxaLayoutConfig.#organizeEquipmentLayout,
      pickEntrySvg: BuxaLayoutConfig.#pickEntrySvg,
      chooseIconSource: BuxaLayoutConfig.#chooseIconSource,
      pickSequencerAsset: BuxaLayoutConfig.#pickSequencerAsset,
      chooseGameIcons: BuxaLayoutConfig.#chooseGameIcons,
      previewWarning: BuxaLayoutConfig.#previewWarning,
      resetLayout: BuxaLayoutConfig.#resetLayout
    }
  };
  static PARTS = {
    form: {
      template: TEMPLATE_PATHS.LAYOUT_CONFIG,
      scrollable: [".buxa-config-main"]
    }
  };
  constructor(options = {}) {
    super(options);
    this._activeSection = "player-sheet";
    this._activeTab = "basic";
    this._activeUiTab = "warning";
    this._equipmentLayoutDraft = null;
  }
  async close(options) {
    this._configWidgetsCleanup?.();
    this._configPresentationCleanup?.();
    return super.close(options);
  }
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const config = getSheetConfig();
    const availableTypes = Object.keys(CONFIG.Actor?.dataModels ?? {});
    const actorTypes = availableTypes.map((id) => ({ id, checked: config.actorTypes.includes(id) }));
    const abilityOptions = getAbilityOptions();
    const resources = config.resources.map((resource) => ({
      ...resource,
      systemLinkLabel: resource.link === RESOURCE_LINKS.HP
        ? "D&D 5e · Hit Points"
        : resource.link === RESOURCE_LINKS.PRIMARY
          ? "D&D 5e · Primary"
          : resource.link,
      linkOptions: RESOURCE_LINK_OPTIONS.map((option) => ({ ...option, selected: option.id === resource.link })),
      restoreOptions: RESTORE_OPTIONS.map((option) => ({ ...option, selected: option.id === resource.levelUp.restoreMode }))
    }));
    const attributes = config.attributes.entries.map((attribute) => ({
      ...attribute,
      abilityOptions: abilityOptions.map((option) => ({ ...option, selected: option.id === attribute.ability }))
    }));
    const proficiencies = config.proficiencies.entries.map((proficiency) => ({
      ...proficiency,
      attributeOptions: [
        { id: "", label: "None", selected: !proficiency.attributeId },
        ...config.attributes.entries.map((attribute) => ({
          id: attribute.id,
          label: attribute.label,
          selected: attribute.id === proficiency.attributeId
        }))
      ]
    }));
    const rebirthStyles = (config.rebirthStyles ?? []).map((style, index) => ({ ...style, level: index + 1 }));
    const damageResourceOptions = config.resources.map((resource) => ({
      id: resource.id,
      label: resource.label,
      selected: resource.id === config.otherStats.damageReduction.resourceId
    }));
    const initiativeAttributeOptions = config.attributes.entries.map((attribute) => ({
      id: attribute.id,
      label: attribute.label,
      selected: attribute.id === config.otherStats.initiative.attributeId
    }));
    if (!this._equipmentLayoutDraft) {
      this._equipmentLayoutDraft = foundry.utils.deepClone(config.inventory.equipmentLayout);
    }
    const equipmentSlotCount = this._equipmentLayoutDraft?.slots?.length ?? 0;
    return {
      ...context,
      inventoryComplex: config.inventory.mode === "complex",
      config,
      physicalVisualBeam: normalizePhysicalSettings(game.settings.get(MODULE_ID, PHYSICAL_SETTINGS)).visualMode === "beam",
      physicalVisualShadow: normalizePhysicalSettings(game.settings.get(MODULE_ID, PHYSICAL_SETTINGS)).visualMode === "shadow",
      fields: config.fields,
      resources:resources.map(resource=>({...resource,npcDropSelected:resource.id===config.npc.dropping.resourceId})),
      attributes,
      proficiencies,
      rebirthStyles,
      actorTypes,
      damageResourceOptions,
      initiativeAttributeOptions,
      equipmentSlotCount,
      rarities: config.items.rarities.map((rarity) => ({
        ...rarity,
        backgroundGlint: rarity.backgroundMode !== "full",
        backgroundFull: rarity.backgroundMode === "full"
      })),
      numberDisplayOptions: ["truncate", "ceil", "floor", "full"].map((id) => ({
        id, label: ({ truncate: "Remove decimals", ceil: "Round up", floor: "Round down", full: "Show full number" })[id], selected: config.numberDisplay?.mode === id
      })),
      carouselTrackerInstalled: Boolean(game.modules.get("combat-tracker-dock")),
      carouselTrackerActive: Boolean(game.modules.get("combat-tracker-dock")?.active),
      addonSequencerActive: Boolean(game.modules.get("sequencer")?.active),
      addonAutoAnimationsActive: Boolean(game.modules.get("autoanimations")?.active),
      addonSocketlibActive: Boolean(game.modules.get("socketlib")?.active),
      addonGameIconsInstalled: Boolean(game.modules.get("game-icons-net")),
      iconSourcePublic: config.addons.iconSource?.source === "public",
      proficiencyModeModifier: config.proficiencies.mode === "modifier",
      proficiencyModeAttribute: config.proficiencies.mode === "attribute",
      levelPermissionGm: config.level.levelUpPermission === "gm",
      levelPermissionOwner: config.level.levelUpPermission === "owner",
      warningPositionLeft: config.ui.warning.position === "left",
      warningPositionCenter: config.ui.warning.position === "center",
      warningPositionRight: config.ui.warning.position === "right",
    };
  }
  async _onRender(context, options) {
    await super._onRender(context, options);
    enableWindowResize(this);
    applyConfigNavigation(this);
    bindConfigNavigation(this);
    bindLayoutConfigPresentation(this);
    bindConfigWidgets(this);
    bindRarityConfig(this);
    syncStatsChoices(this);
    syncProficiencyModeUi(this);
    const refreshRebirthPreview = (row) => {
      const preview = row?.querySelector(".buxa-rebirth-style-preview");
      if (!preview) return;
      const color = row.querySelector("[data-rebirth-style-color]")?.value || "#f1f4ff";
      const decoration = row.querySelector("[data-rebirth-style-decoration]")?.value || romanNumeral(Number(row.dataset.rebirthStyleLevel) || 1);
      preview.style.setProperty("--buxa-preview-color", color);
      const small = preview.querySelector("small");
      if (small) small.textContent = decoration;
    };
    this.element.addEventListener("input", (event) => {
      const target = event.target;
      if (!target || typeof target.matches !== "function") return;
      if (target.matches("[data-rebirth-style-color], [data-rebirth-style-decoration]")) {
        refreshRebirthPreview(target.closest("[data-rebirth-style-row]"));
      }
      if (target.matches("[data-attribute-label]")) {
        const id = target.closest("[data-attribute-row]")?.dataset.attributeId;
        const label = id ? this.element.querySelector(`[data-rebirth-attribute-row][data-rebirth-attribute-id="${CSS.escape(id)}"] strong`) : null;
        if (label) label.textContent = target.value || "ATTRIBUTE";
        syncStatsChoices(this);
      }
      if (target.matches("[data-resource-label]")) syncStatsChoices(this);
    });
    this.element.addEventListener("change", (event) => {
      if (event.target?.matches?.("[data-proficiencies-mode]")) syncProficiencyModeUi(this);
    });
  }
  static #addField() {
    const list = this.element.querySelector("[data-fields-list]");
    if (!list) return;
    list.insertAdjacentHTML("beforeend", fieldRowHtml(createField()));
  }
  static #removeField(_event, target) { target.closest("[data-field-row]")?.remove(); }
  static #moveFieldUp(_event, target) { moveRow(target, -1, "[data-field-row]"); }
  static #moveFieldDown(_event, target) { moveRow(target, 1, "[data-field-row]"); }
  static #addResource() {
    const list = this.element.querySelector("[data-resources-list]");
    if (!list) return;
    list.insertAdjacentHTML("beforeend", resourceRowHtml(createCustomResource()));
    syncStatsChoices(this);
  }
  static #removeResource(_event, target) {
    target.closest("[data-resource-row]")?.remove();
    syncStatsChoices(this);
  }
  static #moveResourceUp(_event, target) { moveRow(target, -1, "[data-resource-row]"); }
  static #moveResourceDown(_event, target) { moveRow(target, 1, "[data-resource-row]"); }
  static #addAttribute() {
    const list = this.element.querySelector("[data-attributes-list]");
    const rebirthList = this.element.querySelector("[data-rebirth-attribute-list]");
    if (!list) return;
    const attribute = createAttribute();
    list.insertAdjacentHTML("beforeend", attributeRowHtml(attribute, getAbilityOptions()));
    rebirthList?.insertAdjacentHTML("beforeend", rebirthAttributeRowHtml(attribute));
    syncStatsChoices(this);
  }
  static #removeAttribute(_event, target) {
    const row = target.closest("[data-attribute-row]");
    const id = row?.dataset.attributeId;
    row?.remove();
    if (id) this.element.querySelector(`[data-rebirth-attribute-row][data-rebirth-attribute-id="${CSS.escape(id)}"]`)?.remove();
    syncStatsChoices(this);
  }

  static #moveAttributeUp(_event, target) { moveRow(target, -1, "[data-attribute-row]"); syncRebirthRuleOrder(this); }
  static #moveAttributeDown(_event, target) { moveRow(target, 1, "[data-attribute-row]"); syncRebirthRuleOrder(this); }

  static #addProficiency() {
    const list = this.element.querySelector("[data-proficiencies-list]");
    if (!list) return;
    const attributes = [...this.element.querySelectorAll("[data-attribute-row]")].map((row) => ({
      id: row.dataset.attributeId,
      label: value(row, "[data-attribute-label]", "ATTRIBUTE").trim() || "ATTRIBUTE"
    }));
    list.insertAdjacentHTML("beforeend", proficiencyRowHtml(createProficiency(), attributes));
    syncStatsChoices(this);
    syncProficiencyModeUi(this);
  }

  static #removeProficiency(_event, target) { target.closest("[data-proficiency-config-row]")?.remove(); }
  static #moveProficiencyUp(_event, target) { moveRow(target, -1, "[data-proficiency-config-row]"); }
  static #moveProficiencyDown(_event, target) { moveRow(target, 1, "[data-proficiency-config-row]"); }

  static #addRebirthStyle() {
    const list = this.element.querySelector("[data-rebirth-styles]");
    if (!list) return;
    const level = list.querySelectorAll("[data-rebirth-style-row]").length + 1;
    const previous = list.lastElementChild;
    const color = previous?.querySelector("[data-rebirth-style-color]")?.value || "#f1f4ff";
    list.insertAdjacentHTML("beforeend", rebirthStyleRowHtml({ color, decoration: romanNumeral(level) }, level));
  }

  static #removeRebirthStyle(_event, target) {
    const list = target.closest("[data-rebirth-styles]");
    const row = target.closest("[data-rebirth-style-row]");
    if (!list || !row) return;
    if (list.querySelectorAll("[data-rebirth-style-row]").length <= 1) return;
    row.remove();
    [...list.querySelectorAll("[data-rebirth-style-row]")].forEach((entry, index) => {
      const level = index + 1;
      entry.dataset.rebirthStyleLevel = String(level);
      const label = entry.querySelector(".buxa-rebirth-style-level");
      if (label) label.textContent = `R${level}`;
      const previewLevel = entry.querySelector(".buxa-rebirth-style-preview b");
      if (previewLevel) previewLevel.textContent = String(level);
    });
  }

  static #pickEntrySvg(_event, target) { openEntrySvgPicker(this, target); }

  static #pickSequencerAsset() { void openSequencerAssetPicker(this); }
  static #chooseGameIcons() { setGameIconsFolder(this); }
  static #chooseIconSource() { openIconSourcePicker(this); }

  static #organizeEquipmentLayout() {
    const config = getSheetConfig();
    if (!this._equipmentLayoutDraft) {
      this._equipmentLayoutDraft = foundry.utils.deepClone(config.inventory.equipmentLayout);
    }
    const editor = new BuxaEquipmentLayout({
      layout: this._equipmentLayoutDraft,
      onSave: async (layout) => {
        this._equipmentLayoutDraft = foundry.utils.deepClone(layout);
        const current = getSheetConfig();
        const saved = normalizeSheetConfig({
          ...current,
          inventory: { ...current.inventory, equipmentLayout: layout }
        });
        await setSheetConfig(saved);
        await reconcileConfiguredInventories(saved);
        refreshOpenBuxaSheets();
        const count = this.element?.querySelector?.("[data-equipment-slot-count]");
        if (count) count.textContent = String(layout.slots?.length ?? 0);
        notifySuccess("Equipment layout saved.");
      }
    });
    editor.render({ force: true });
  }

  static async #resetLayout() {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Reset Buxa configuration" },
      content: "<p>Reset the full Buxa module configuration, including Player Sheet, Inventory, Items and Addons settings?</p>",
      yes: { label: "Reset", icon: "fa-solid fa-rotate-left" },
      no: { label: "Cancel" },
      modal: true
    });
    if (!confirmed) return;
    const previous = getSheetConfig();
    await setSheetConfig({});
    const resetConfig = getSheetConfig();
    this._equipmentLayoutDraft = foundry.utils.deepClone(resetConfig.inventory.equipmentLayout);
    await synchronizeConfiguredResourceLabels(resetConfig);
    await reconcileConfiguredInventories(resetConfig);
    refreshOpenBuxaSheets();
    if (resetConfig.makeDefault !== previous.makeDefault
      || JSON.stringify(resetConfig.actorTypes) !== JSON.stringify(previous.actorTypes)) {
      notifyWarning("Reload the world to apply Actor sheet registration changes.");
    }
    this._configPresentationDirty = false;
    await this.render({ force: true });
  }

  static #previewWarning() {
    previewWarningSettings(this.element);
  }

  static async #onSubmit() {
    const current = getSheetConfig();
    const root = this.element;
    const config = normalizeSheetConfig({
      ...current,
      ui: { ...current.ui, warning: readWarningSettings(root), itemUi: { openFoldersLeft: checked(root, "[data-ui-item-folders-left]") } },
      basicTabLabel: value(root, "[data-basic-tab-label]", "BÁSICO"),
      numberDisplay: { mode: value(root, "[data-number-display-mode]", "truncate") },
      makeDefault: checked(root, "[data-make-default]"),
      actorTypes: [...root.querySelectorAll("[data-actor-type]:checked")].map((input) => input.value),
      fields: readFieldRows(root),
      resources: readResourceRows(root),
      level: {
        enabled: checked(root, "[data-level-enabled]"),
        label: value(root, "[data-level-label]", "NÍVEL"),
        startingLevel: numberValue(root, "[data-level-start]", 1),
        levelUpPermission: value(root, "[data-level-permission]", "gm")
      },
      rebirthStyles: readRebirthStyles(root),
      attributes: {
        allowCollapse: checked(root, "[data-attributes-allow-collapse]"),
        points: {
          enabled: checked(root, "[data-points-enabled]"),
          label: value(root, "[data-points-label]", "PONTOS"),
          startingPoints: numberValue(root, "[data-points-start]", 0),
          grantAmount: numberValue(root, "[data-points-grant]", 1),
          grantEveryLevels: numberValue(root, "[data-points-every]", 1),
          playersCanDecrease: checked(root, "[data-points-player-decrease]"),
          directValueEntry: checked(root, "[data-points-direct-entry]"),
          allowBelowZero: checked(root, "[data-points-below-zero]")
        },
        entries: readAttributeRows(root)
      },
      inventory: {
        mode: value(root, "[data-inventory-mode]", "simple"),
        complex: {
          columns: numberValue(root,"[data-inventory-complex-columns]",10),
          rows: numberValue(root,"[data-inventory-complex-rows]",5),
          autoSort: value(root,"[data-inventory-complex-sort]","off")==="on"
        },
        slots: numberValue(root, "[data-inventory-slots]", 50),
        weight: {
          enabled: checked(root, "[data-inventory-weight-enabled]"),
          capacity: numberValue(root, "[data-inventory-weight-capacity]", 100)
        },
        equipmentLayout: this._equipmentLayoutDraft ?? current.inventory.equipmentLayout
      },
      items: {
        background: readRarityBackground(root),
        rarities: readRarityRows(root)
      },
      proficiencies: {
        enabled: checked(root, "[data-proficiencies-enabled]"),
        label: value(root, "[data-proficiencies-label]", "PROFICIENCIES"),
        mode: value(root, "[data-proficiencies-mode]", "modifier"),
        points: {
          enabled: checked(root, "[data-proficiency-points-enabled]"),
          label: value(root, "[data-proficiency-points-label]", "PROF. POINTS"),
          startingPoints: numberValue(root, "[data-proficiency-points-start]", 0),
          grantAmount: numberValue(root, "[data-proficiency-points-grant]", 1),
          grantEveryLevels: numberValue(root, "[data-proficiency-points-every]", 1),
          playersCanDecrease: checked(root, "[data-proficiency-points-player-decrease]"),
          allowBelowZero: checked(root, "[data-proficiency-points-below-zero]")
        },
        entries: readProficiencyRows(root)
      },
      otherStats: {
        damageReduction: {
          enabled: checked(root, "[data-dr-enabled]"),
          resourceId: value(root, "[data-dr-resource]", "hp")
        },
        initiative: {
          enabled: checked(root, "[data-initiative-enabled]"),
          attributeId: value(root, "[data-initiative-attribute]", "")
        }
      },
      npc: { dropping: {
        defaultSlots:numberValue(root,"[data-npc-drop-default-slots]",current.npc.dropping.defaultSlots),
        resourceId:value(root,"[data-npc-drop-resource]",current.npc.dropping.resourceId)
      }},
      addons: {
        svgIcons: { enabled: checked(root, "[data-addon-svg-icons]") },
        iconSource: {
          source: value(root, "[data-addon-icon-source-source]", "data"),
          path: value(root, "[data-addon-icon-source-path]", "")
        },
        carouselTracker: { enabled: checked(root, "[data-addon-carousel-tracker]") },
        sequencer: {
          enabled: checked(root, "[data-addon-sequencer]"),
          effectFile: value(root, "[data-addon-sequencer-asset]", "")
        }
      }
    });

    const defaultChanged = config.makeDefault !== current.makeDefault
      || JSON.stringify(config.actorTypes) !== JSON.stringify(current.actorTypes);

    await setSheetConfig(config);
    const oldPhysical = normalizePhysicalSettings(game.settings.get(MODULE_ID, PHYSICAL_SETTINGS));
    const nextVisual = root.querySelector("[data-physical-item-visual]:checked")?.value ?? oldPhysical.visualMode;
    if (nextVisual !== oldPhysical.visualMode) await game.settings.set(MODULE_ID, PHYSICAL_SETTINGS, { ...oldPhysical, visualMode: nextVisual });
    await synchronizeConfiguredResourceLabels(config);
    await reconcileConfiguredInventories(config);

    refreshOpenBuxaSheets();
    notifySuccess("Module configuration saved.");

    if (defaultChanged) {
      notifyWarning("Reload the world to apply Actor sheet registration changes.");
    }
    if (this.rendered) await this.close();
  }
}
