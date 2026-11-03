import { installBuxaCombatEncounters } from './apps/combat-encounters.js';
import { registerSidebarButtonSettings, installSidebarButtonEditor } from './apps/sidebar-edit-buttons.js';
import { registerCombatItemRecharge } from './integrations/combat-item-recharge.js';
import { installCombatLifecycleTracking, getCombatLifecycleSnapshot, getCombatLifecycleHistory, onCombatLifecycle, COMBAT_LIFECYCLE_HOOK } from './integrations/combat-lifecycle.js';
import { notifyError, syncNotificationPlacement } from "./core/notifications.js";
import { DEFAULT_SHEET_CONFIG, HOOKS, MODULE_ID, MODULE_TITLE, SETTINGS } from "./core/constants.js";
import { getSheetConfig, invalidateSheetConfigCache } from "./core/config.js";
import { syncActorNameToTokens } from "./core/sync.js";
import { pruneActorUiState } from "./core/ui-state.js";
import { ensureActorState } from "./core/actor-state.js";
import { levelUpActor } from "./core/leveling.js";
import { setLinkedUsers } from "./core/permissions.js";
import { updateResource } from "./core/resources.js";
import { getDamageReduction, getInitiativeModifier, setDamageReduction } from "./core/other-stats.js";
import { changeProficiency, getProficiencyModifier, getProficiencyPoints, getProficiencyValue } from "./core/proficiencies.js";
import { cycleEquipmentSlot, getInventoryState, moveInventoryItem, reconcileInventoryState, setEquipmentActivePosition, setInventoryAutoSort, setInventorySortMode } from "./core/inventory.js";
import { BuxaActorConfig } from "./apps/actor-config.js";
import { BuxaLayoutConfig } from "./apps/layout-config.js";
import { registerBuxaActorSheets } from "./apps/actor-sheet-registration.js";
import { BuxaNpcSettings } from "./apps/npc-settings.js";
import { installSceneProgressionFx } from "./apps/scene-progression-fx.js";
import { BuxaImagePicker } from "./apps/image-picker.js";
import { BuxaAssetBrowser } from "./apps/asset-browser.js";
import { BuxaItemConfig } from "./apps/item-config.js";
import { BuxaItemSheet, openBuxaItemSheet } from "./apps/item-sheet.js";
import { BuxaEffectSheet } from './apps/effect-sheet.js';
import { BuxaEffectConfig } from './apps/effect-config.js';
import { getItemKind } from './core/effect-config.js';
import { applyEffectToActor, removeEffectFromActor, getActiveEffects, tickActorEffects } from './core/effect-runtime.js';
import { installEffectIntegration } from './integrations/effect-integration.js';
import { getItemRules, getItemRarity } from "./core/item-config.js";
import { rollItemDice } from "./core/item-dice.js";
import { hydrateActorItemSnapshots, itemTotalWeight } from "./core/item-runtime.js";
import { registerCombatTrackerDockIntegration, refreshCombatDockPortraits } from "./integrations/combat-tracker-dock.js";
import { registerOtherStatsIntegration } from "./integrations/other-stats.js";
import { installWorldDirectories } from "./apps/world-directory-generic.js";
import { installActorTokenGhost, endActorTokenDrag } from "./apps/actor-token-ghost.js";
import { installTokenResourceHud } from "./integrations/token-resource-hud.js";
import { BuxaPlayerSettings } from "./apps/player-settings.js";
import { installMainFolderHooks } from "./apps/directory-main-folder.js";
import { installItemDirectoryUI } from "./apps/item-directory-ui.js";
import { installPhysicalItemTransfers } from "./integrations/physical-item-transfers.js";
import { inspectPhysicalTransactions, acknowledgePhysicalTransaction } from "./core/physical-transaction-ledger.js";
import { diagnosePhysicalSceneItems } from "./core/physical-items.js";
import { migratePhysicalScenes } from "./core/physical-scene-migration.js";
import { registerAssetBrowserSettings } from "./core/asset-browser-settings.js";
import { installPhysicalItemCanvas } from "./integrations/physical-item-canvas.js";
import { installGmPhysicalPanel } from "./apps/gm-physical-panel.js";
import { registerPhysicalItemSettings } from "./integrations/physical-item-settings.js";
import { installGroundContainerWindow } from "./apps/ground-container-window.js";
import { installNpcDeath } from "./integrations/npc-death.js";
import { installRarityPickupFlash } from "./apps/rarity-pickup-flash.js";
import { registerHotbarSettings, installBuxaHotbar, addItemToHotbar, hasItemOnHotbar, removeItemFromHotbar } from "./apps/hotbar.js";
Hooks.once("init", () => {
  installMainFolderHooks(); installTokenResourceHud();
  registerPhysicalItemSettings();
  game.settings.register(MODULE_ID, SETTINGS.SHEET_CONFIG, {
    name: "Buxa Player Sheet Configuration",
    scope: "world",
    config: false,
    type: Object,
    default: foundry.utils.deepClone(DEFAULT_SHEET_CONFIG),
    onChange: () => { invalidateSheetConfigCache(); syncNotificationPlacement(); Hooks.callAll('buxaSheetConfigUpdated'); }
  });
  game.settings.register(MODULE_ID, SETTINGS.SHEET_UI_STATE, {
    name: "Buxa Player Sheet UI State",
    scope: "client",
    config: false,
    type: Object,
    default: {}
  });
  registerAssetBrowserSettings(); registerSidebarButtonSettings();
  registerHotbarSettings();
  game.settings.registerMenu(MODULE_ID, "playerSheetLayout", {
    name: "Module Configuration",
    label: "Open Module Configuration",
    hint: "Open the Buxa Framework configuration.",
    icon: "fa-solid fa-table-columns",
    type: BuxaLayoutConfig,
    restricted: true
  });
  registerBuxaActorSheets(getSheetConfig());
  // Keep ordinary Items as the default sheet and Effects as a second option.
  foundry.applications.apps.DocumentSheetConfig.registerSheet(Item,MODULE_ID,BuxaItemSheet,{label:'Buxa Item Sheet',makeDefault:true});
  foundry.applications.apps.DocumentSheetConfig.registerSheet(Item,MODULE_ID,BuxaEffectSheet,{label:'Buxa Effect Sheet',makeDefault:false});
  game.buxaframework = {
    id: MODULE_ID,
    version: game.modules.get(MODULE_ID)?.version,
    getConfig: getSheetConfig,
    inspectPhysicalTransactions, acknowledgePhysicalTransaction,
    diagnosePhysicalSceneItems, migratePhysicalScenes,
    ensureActorState,
    levelUpActor,
    updateResource,
    getDamageReduction,
    setDamageReduction,
    getInitiativeModifier,
    getProficiencyPoints,
    getProficiencyValue,
    getProficiencyModifier,
    changeProficiency,
    getInventoryState,
    moveInventoryItem,
    setInventoryAutoSort,
    setInventorySortMode,
    setEquipmentActivePosition,
    cycleEquipmentSlot,
    reconcileInventoryState,
    getItemRules,
    getItemRarity,
    rollItemDice,
    addItemToHotbar,
    hasItemOnHotbar,
    removeItemFromHotbar,
    itemTotalWeight,
    setLinkedUsers,
    openActorConfig(actor) {
      if (!game.user.isGM) return null;
      return new BuxaActorConfig({ actor }).render({ force: true });
    },
    openPlayerSettings(actor) {
      if (!actor?.isOwner) return null;
      const SettingsApp = actor.type === "npc" ? BuxaNpcSettings : BuxaPlayerSettings;
      return new SettingsApp({ actor }).render({ force: true });
    },
    openNpcSettings(actor) {
      if (actor?.type !== "npc" || !game.user?.isGM || !actor.isOwner) return null;
      return new BuxaNpcSettings({ actor }).render({ force: true });
    },
    openImagePicker(actor) {
      return new BuxaImagePicker({ actor }).render({ force: true });
    },
    openAssetBrowser(options = {}) {
      return new BuxaAssetBrowser(options).render({ force: true });
    },
    openItemSheet(item) { return openBuxaItemSheet(item); },
    openItemConfig(item) {
      if (!game.user.isGM) return null;
      const Config = getItemKind(item) === 'effect' ? BuxaEffectConfig : BuxaItemConfig;
      return new Config({ item }).render({ force: true });
    },
    effects: {getActiveEffects,applyEffectToActor,removeEffectFromActor,tickActorEffects},
    refreshCombatDockPortraits,
    combatLifecycle: { getSnapshot: getCombatLifecycleSnapshot, getHistory: getCombatLifecycleHistory, on: onCombatLifecycle, hook: COMBAT_LIFECYCLE_HOOK },
    hooks: { ...HOOKS, COMBAT_LIFECYCLE: COMBAT_LIFECYCLE_HOOK }
  };
  registerCombatTrackerDockIntegration();
  registerOtherStatsIntegration();
  console.log(`${MODULE_TITLE} | Initialized.`);
});
Hooks.once("ready", async () => {
  // Don't register combat, loot and inventory mutation hooks on unsupported systems.
  if (game.system?.id !== "dnd5e") {
    notifyError(`${MODULE_TITLE} requires the D&D 5e system for Resources, Attributes, Proficiencies and Initiative.`);
    return;
  }
  installSidebarButtonEditor(); installCombatLifecycleTracking(); registerCombatItemRecharge(); installSceneProgressionFx();
  installEffectIntegration();
  installItemDirectoryUI(); installWorldDirectories();
  installActorTokenGhost(); installBuxaCombatEncounters();
  installBuxaHotbar(); installRarityPickupFlash(); installNpcDeath();
  installPhysicalItemTransfers(); installPhysicalItemCanvas(); installGmPhysicalPanel(); installGroundContainerWindow();
  if (game.user.isActiveGM) {
    const actors = [...(game.actors ?? [])];
    let cursor = 0;
    const processNext = async () => {
      while (cursor < actors.length) {
        const actor = actors[cursor++];
        try {
          await ensureActorState(actor);
          await hydrateActorItemSnapshots(actor, getSheetConfig());
          await reconcileInventoryState(actor, getSheetConfig());
        } catch (error) {
          console.warn(`${MODULE_TITLE} | Could not initialize ${actor.name}.`, error);
        }
      }
    };
    await Promise.all(Array.from({length:Math.min(4,actors.length)}, processNext));
  }
});
Hooks.on("createActor", async (actor, _options, _userId) => {
  if (!game.user.isActiveGM) return;
  try {
    await ensureActorState(actor, { isNew: true });
  } catch (error) {
    console.warn(`${MODULE_TITLE} | Could not initialize new Actor ${actor.name}.`, error);
  }
});
Hooks.on("createItem", async (item, options = {}) => {
  if (options?.[`${MODULE_ID}.splitting`] || options?.[`${MODULE_ID}.physicalTransfer`]) return;
  if (!game.user.isActiveGM || item?.parent?.documentName !== "Actor") return;
  try {
    await hydrateActorItemSnapshots(item.parent, getSheetConfig());
    await reconcileInventoryState(item.parent, getSheetConfig());
  } catch (error) {
    console.warn(`${MODULE_TITLE} | Could not snapshot new embedded Item ${item.name}.`, error);
  }
});
// Changes made outside Buxa's configuration window (e.g. changing the D&D
// item quantity or updating an embedded item through a macro) must also
// remove expired passive bonuses and clamp affected resource current values.
Hooks.on("updateItem", async (item, changed, options, userId) => {
  if (options?.[`${MODULE_ID}.splitting`] || options?.[`${MODULE_ID}.physicalTransfer`] || options?.[`${MODULE_ID}.itemSnapshot`]) return;
  const actor = item?.parent;
  if (actor?.documentName !== "Actor" || !actor.isOwner) return;
  if (userId && userId !== game.user.id) return;
  if (!userId && !game.user.isActiveGM) return;
  const relevant = ["system.quantity", `flags.${MODULE_ID}.item`].some((path) =>
    Object.hasOwn(changed, path) || foundry.utils.hasProperty(changed, path));
  if (!relevant) return;
  try {
    await reconcileInventoryState(actor, getSheetConfig());
  } catch (error) {
    console.warn(`${MODULE_TITLE} | Could not reconcile item change on ${actor.name}.`, error);
  }
});
Hooks.on("deleteItem", async (item, options, userId) => {
  if (options?.[`${MODULE_ID}.physicalTransfer`]) return;
  const actor = item?.parent;
  if (!actor || (actor.documentName !== "Actor" && actor.constructor?.name !== "Actor")) return;
  if (userId && userId !== game.user.id) return;
  if (!actor.isOwner) return;
  try {
    await reconcileInventoryState(actor, getSheetConfig());
  } catch (error) {
    console.warn(`${MODULE_TITLE} | Could not reconcile inventory after deleting ${item.name}.`, error);
  }
});
Hooks.on("updateActor", async (actor, changed, options, userId) => {
  if (options?.[`${MODULE_ID}.syncing`]) return;
  // updateActor is broadcast to all clients. Only the client which initiated
  // the name change should write the corresponding token updates, otherwise
  // every owner/GM can attempt the same write at once.
  if (userId && userId !== game.user.id) return;
  if (!userId && !game.user.isActiveGM) return;
  await syncActorNameToTokens(actor, changed);
});
Hooks.on("deleteActor", async (actor) => {
  try {
    await pruneActorUiState(actor);
  } catch (error) {
    console.warn(`${MODULE_TITLE} | Could not prune deleted Actor UI state.`, error);
  }
});
Hooks.on("canvasTearDown", () => endActorTokenDrag());
