export const MODULE_ID = "buxaframework";
export const MODULE_TITLE = "Buxa Framework";
export const ITEM_KINDS = Object.freeze({ ITEM: "item", MAGIC: "magic", EFFECT: "effect" });
export const EFFECT_FLAG = "effect";
export const ACTIVE_EFFECTS_FLAG = "activeEffects";
export const IS_CONDITION_FLAG = "isCondition";

export const SETTINGS = Object.freeze({
  SHEET_CONFIG: "sheetConfig",
  SHEET_UI_STATE: "sheetUiState",
  ASSET_FAVORITES: "assetFavorites"
});

export const DEFAULT_WARNING_SETTINGS = Object.freeze({
  durationSeconds: 5,
  position: "right"
});

export const RESOURCE_LINKS = Object.freeze({
  BUXA: "buxa",
  HP: "hp",
  PRIMARY: "primary",
  SECONDARY: "secondary",
  TERTIARY: "tertiary"
});


export const DEFAULT_REBIRTH_STYLES = Object.freeze([
  { color: "#8b93a1", decoration: "I" },
  { color: "#55b86a", decoration: "II" },
  { color: "#4d8fe6", decoration: "III" },
  { color: "#9b6de3", decoration: "IV" },
  { color: "#d6a832", decoration: "V" },
  { color: "#e58638", decoration: "VI" },
  { color: "#df5b67", decoration: "VII" },
  { color: "#e85aa5", decoration: "VIII" },
  { color: "#50c8ce", decoration: "IX" },
  { color: "#50c8ce", decoration: "X" },
  { color: "#69d7ff", decoration: "XI" },
  { color: "#7e7dff", decoration: "XII" },
  { color: "#b46bff", decoration: "XIII" },
  { color: "#ff66d1", decoration: "XIV" },
  { color: "#ff6b7a", decoration: "XV" },
  { color: "#ff9350", decoration: "XVI" },
  { color: "#ffd95a", decoration: "XVII" },
  { color: "#c7ff67", decoration: "XVIII" },
  { color: "#78f0b8", decoration: "XIX" },
  { color: "#f1f4ff", decoration: "XX" }
]);

export const DEFAULT_RESOURCE_LEVEL_UP = Object.freeze({
  maxGain: 0,
  maxEveryLevels: 1,
  restoreMode: "none",
  restoreAmount: 0,
  restoreEveryLevels: 1
});

export const DEFAULT_SHEET_CONFIG = Object.freeze({
  version: 18,
  ui: { warning: { ...DEFAULT_WARNING_SETTINGS }, itemUi: { openFoldersLeft: false } },
  basicTabLabel: "BÁSICO",
  numberDisplay: { mode: "truncate" },
  makeDefault: true,
  actorTypes: [],
  fields: [
    {
      id: "name",
      label: "NOME",
      width: 12,
      binding: "name",
      locked: true
    }
  ],
  resources: [
    {
      id: "hp",
      label: "HP",
      color: "#b84d5b",
      startMax: 0,
      syncCurrentOnMax: true,
      link: "hp",
      locked: true,
      icon: { enabled: false, path: "" },
      levelUp: { ...DEFAULT_RESOURCE_LEVEL_UP }
    },
    {
      id: "mp",
      label: "MP",
      color: "#4f7fdb",
      startMax: 0,
      syncCurrentOnMax: true,
      link: "primary",
      locked: true,
      icon: { enabled: false, path: "" },
      levelUp: { ...DEFAULT_RESOURCE_LEVEL_UP }
    }
  ],
  level: {
    enabled: false,
    label: "NÍVEL",
    startingLevel: 1,
    levelUpPermission: "gm"
  },
  rebirthStyles: DEFAULT_REBIRTH_STYLES.map((style) => ({ ...style })),
  attributes: {
    allowCollapse: true,
    points: {
      enabled: false,
      label: "PONTOS",
      startingPoints: 0,
      grantAmount: 1,
      grantEveryLevels: 1,
      playersCanDecrease: false,
      directValueEntry: true,
      allowBelowZero: false
    },
    entries: []
  },
  otherStats: {
    damageReduction: {
      enabled: false,
      resourceId: "hp"
    },
    initiative: {
      enabled: false,
      attributeId: ""
    }
  },
  addons: {
    svgIcons: {
      enabled: false
    },
    iconSource: {
      source: "data",
      path: ""
    },
    carouselTracker: {
      enabled: true
    },
    sequencer: { enabled: false, effectFile: "" }
  },
  inventory: {
    slots: 50,
    weight: { enabled: false, capacity: 100 },
    equipmentLayout: {
      columns: 12,
      rows: 7,
      snapToGrid: true,
      slots: [
        { id: "weapon-1", type: "weapon", label: "WEAPON", size: "long", capacity: 2, x: 1, y: 1, color: "#344052", background: "" },
        { id: "offhand-1", type: "offhand", label: "OFFHAND", size: "long", capacity: 2, x: 10, y: 1, color: "#344052", background: "" },
        { id: "helmet-1", type: "helmet", label: "HELMET", size: "wide", capacity: 1, x: 5, y: 0, color: "#344052", background: "" },
        { id: "chestplate-1", type: "chestplate", label: "CHESTPLATE", size: "large", capacity: 1, x: 5, y: 1, color: "#344052", background: "" },
        { id: "gloves-1", type: "gloves", label: "GLOVES", size: "small", capacity: 1, x: 3, y: 2, color: "#344052", background: "" },
        { id: "belt-1", type: "belt", label: "BELT", size: "wide", capacity: 1, x: 5, y: 3, color: "#344052", background: "" },
        { id: "pants-1", type: "pants", label: "PANTS", size: "wide", capacity: 1, x: 5, y: 4, color: "#344052", background: "" },
        { id: "boots-1", type: "boots", label: "BOOTS", size: "wide", capacity: 1, x: 7, y: 4, color: "#344052", background: "" }
      ]
    }
  },
  items: {
    background: { opacity: 100, brightness: 100 },
    rarities: []
  },
  proficiencies: {
    enabled: false,
    label: "PROFICIENCIES",
    mode: "modifier",
    points: {
      enabled: true,
      label: "PROF. POINTS",
      startingPoints: 0,
      grantAmount: 1,
      grantEveryLevels: 1,
      playersCanDecrease: false,
      allowBelowZero: false
    },
    entries: []
  }
});

export const TEMPLATE_PATHS = Object.freeze({
  PLAYER_SHEET: `modules/${MODULE_ID}/templates/player-sheet.hbs`,
  IMAGE_PICKER: `modules/${MODULE_ID}/templates/image-picker.hbs`,
  LAYOUT_CONFIG: `modules/${MODULE_ID}/templates/layout-config.hbs`,
  ACTOR_CONFIG: `modules/${MODULE_ID}/templates/actor-config.hbs`,
  ATTRIBUTE_SETTER: `modules/${MODULE_ID}/templates/attribute-setter.hbs`,
  EQUIPMENT_LAYOUT: `modules/${MODULE_ID}/templates/equipment-layout.hbs`,
  SVG_PICKER: `modules/${MODULE_ID}/templates/svg-picker.hbs`,
  ITEM_SHEET: `modules/${MODULE_ID}/templates/item-sheet.hbs`,
  EFFECT_SHEET: `modules/${MODULE_ID}/templates/effect-sheet.hbs`,
  EFFECT_CONFIG: `modules/${MODULE_ID}/templates/effect-config.hbs`,
  ITEM_CONFIG: `modules/${MODULE_ID}/templates/item-config.hbs`,
  ITEM_CONFIG_FOOTER: `modules/${MODULE_ID}/templates/item-config-footer.hbs`,
  ASSET_BROWSER: `modules/${MODULE_ID}/templates/asset-browser.hbs`
});

export const HOOKS = Object.freeze({
  PREPARE_SHEET_CONTEXT: "buxaframeworkPrepareSheetContext",
  RENDER_SHEET: "buxaframeworkRenderSheet",
  FULLBODY_UPDATED: "buxaframeworkFullbodyUpdated",
  TOKEN_IMAGE_UPDATED: "buxaframeworkTokenImageUpdated",
  LEVEL_UP: "buxaframeworkLevelUp",
  RESOURCE_UPDATED: "buxaframeworkResourceUpdated",
  ATTRIBUTE_UPDATED: "buxaframeworkAttributeUpdated",
  ATTRIBUTE_REBIRTH: "buxaframeworkAttributeRebirth",
  LINKED_USERS_UPDATED: "buxaframeworkLinkedUsersUpdated",
  OTHER_STATS_UPDATED: "buxaframeworkOtherStatsUpdated",
  PROFICIENCY_UPDATED: "buxaframeworkProficiencyUpdated",
  INVENTORY_UPDATED: "buxaframeworkInventoryUpdated",
  ITEM_UPDATED: "buxaframeworkItemUpdated",
  EFFECT_APPLIED: "buxaframeworkEffectApplied",
  EFFECT_REMOVED: "buxaframeworkEffectRemoved",
  EFFECT_TICK: "buxaframeworkEffectTick",
  CONFIG_UPDATED: "buxaframeworkConfigUpdated"
});
