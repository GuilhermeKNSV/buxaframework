import { actorRarityContext, rebirthRarityContext } from '../core/rarity-context.js';
import { rarityVisualPresentation } from '../core/rarity-visuals.js';
import { npcDropCapacity, npcDropTable } from "../core/npc-dropping.js";
import { getResourceHud } from "../core/resource-hud.js";
import { isBuxaNpc, isNpcQuick } from "../core/npc-sheet.js";
import { HOOKS, MODULE_ID } from "../core/constants.js";
import { getSheetConfig } from "../core/config.js";
import { getEffectiveResourceState } from "../core/resources.js";
import { getAttributeUiConfig, migrateLegacyAttributeUi } from "../core/attribute-ui.js";
import { getTokenImage } from "../core/sync.js";
import { getUiSvgIcon } from "../core/icons.js";
import { ensureActorState } from "../core/actor-state.js";
import { getDamageReduction, getInitiativeAttribute, getInitiativeModifier } from "../core/other-stats.js";
import {
  canDecreaseProficiency,
  getLinkedProficiencyAttribute,
  getLinkedProficiencyModifier,
  getProficiencyBaseValue,
  getProficiencyBaseModifier,
  getProficiencyModifier,
  getProficiencyPoints,
  getProficiencyValue
} from "../core/proficiencies.js";
import { canLevelUp, getActorLevel } from "../core/leveling.js";
import { numberInputStep } from "../core/number-display.js";
import { buildAttributeSources, buildProficiencySources, buildResourceSources } from "../core/value-sources.js";
import { prepareInventoryContext } from "./inventory-context.js";
import { beginItemIncreaseBatch } from "../core/item-effects.js";
import { IS_CONDITION_FLAG } from '../core/constants.js';
import { getEffectRules, getEffectRarity } from '../core/effect-config.js';
import { rarityPresentation } from '../core/item-config.js';
import {
  canDecreaseAttribute,
  getAttributeBaseValue,
  getAttributeDice,
  getAttributeModifier,
  getAttributePoints,
  getAttributeRebirthState,
  getAttributeValue,
  getAttributeVisual
} from "../core/attributes.js";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function signed(value) {
  const number = Number(value) || 0;
  return number >= 0 ? `+${number}` : String(number);
}

export async function preparePlayerSheetContext(sheet, baseContext) {
  await ensureActorState(sheet.actor);
  await migrateLegacyAttributeUi(sheet.actor);

  const config = getSheetConfig();
  const endIncreaseBatch = beginItemIncreaseBatch(sheet.actor, config);
  try {
  const profileFlag = sheet.actor.getFlag(MODULE_ID, "profile");
  const stored = profileFlag && typeof profileFlag === "object" && !Array.isArray(profileFlag) ? profileFlag : {};
  const editable = Boolean(sheet.isEditable && sheet.actor.isOwner);

  const fields = config.fields.map((field) => ({
    ...field,
    value: field.binding === "name" ? sheet.actor.name : (stored[field.id] ?? ""),
    inputName: field.binding === "name" ? "name" : `flags.${MODULE_ID}.profile.${field.id}`,
    style: `--buxa-field-span:${field.width}`
  }));

  const resources = config.resources.map((resource) => {
    const state = getEffectiveResourceState(sheet.actor, resource, config);
    const current = Number(state.current) || 0;
    const max = Math.max(0, Number(state.max) || 0);
    const percent = max > 0 ? clamp((current / max) * 100, 0, 100) : 0;
    return {
      ...resource,
      hudTracked: getResourceHud(sheet.actor, resource).enabled,
      current,
      max,
      showIcon: Boolean(config.addons.svgIcons.enabled && resource.icon?.enabled && resource.icon?.path),
      iconPath: resource.icon?.path || "",
      inputStep: numberInputStep(config.numberDisplay),
      breakdown: buildResourceSources(sheet.actor, resource, config),
      style: `--buxa-resource-color:${resource.color};--buxa-resource-pct:${percent}%`
    };
  });

  const pointConfig = config.attributes.points;
  const points = {
    enabled: pointConfig.enabled || isNpcQuick(sheet.actor),
    label: pointConfig.label,
    value: getAttributePoints(sheet.actor, config)
  };

  const attributeUi = getAttributeUiConfig(sheet.actor);
  const canDecrease = canDecreaseAttribute(sheet.actor, config);
  const attributes = config.attributes.entries
    .map((attribute, index) => {
      const baseValue = getAttributeBaseValue(sheet.actor, attribute);
      const value = getAttributeValue(sheet.actor, attribute, config);
      const rebirthState = getAttributeRebirthState(sheet.actor, attribute, config);
      const rebirths = rebirthState.activeRebirths;
      const modifier = getAttributeModifier(attribute, value, rebirths, sheet.actor, config);
      const dice = getAttributeDice(attribute, rebirths, sheet.actor, config);
      const visual = getAttributeVisual(attribute, rebirths, config);
      const theme = rarityVisualPresentation(rebirthRarityContext(attribute, rebirths + 1, config,
        getAttributeVisual(attribute, rebirths + 1, config).color));
      const atCap = Boolean(attribute.rebirth.enabled && rebirthState.readyToRebirth);
      const ui = attributeUi[attribute.id] || {};

      return {
        ...attribute,
        value,
        showIcon: Boolean(config.addons.svgIcons.enabled && attribute.icon?.enabled && attribute.icon?.path),
        iconPath: attribute.icon?.path || "",
        modifier,
        modifierEnabled: modifier !== null || isNpcQuick(sheet.actor),
        modifierText: modifier === null ? (isNpcQuick(sheet.actor) ? "+0" : "") : signed(modifier),
        rollTitle: `${dice} ${dice === 1 ? "die" : "dice"} · ${signed(modifier ?? 0)} modifier`,
        rebirths,
        nextRebirths: rebirths + 1,
        rebirthThemeClass: theme.className, rebirthThemeStyle: theme.style,
        rebirthDecoration: rebirths > 0 ? visual.decoration : "",
        isReborn: rebirths > 0,
        claimedRebirths: rebirthState.claimedRebirths,
        inactiveRebirths: rebirthState.inactiveRebirths,
        dice,
        atCap,
        canIncrease: editable && pointConfig.enabled && points.value > 0 && !atCap,
        canDecrease: editable && pointConfig.enabled && canDecrease
          && (attribute.rebirth.enabled
            ? rebirthState.baseProgress > Math.max(0, rebirthState.claimedRebirths * attribute.rebirth.maxPoints)
            : (pointConfig.allowBelowZero || baseValue > 0)),
        canDirectEdit: editable && pointConfig.enabled && pointConfig.directValueEntry,
        showRebirth: attribute.rebirth.enabled,
        rebirthTitle: rebirthState.inactiveRebirths > 0
          ? `${rebirthState.inactiveRebirths} rebirth${rebirthState.inactiveRebirths === 1 ? "" : "s"} inactive until the required progress returns`
          : (atCap ? "Ready to rebirth" : `Rebirth at ${attribute.rebirth.maxPoints}`),
        style: `--buxa-attribute-color:${visual.color};--buxa-next-rebirth-color:${getAttributeVisual(attribute, rebirths + 1, config).color}`,
        order: Number.isFinite(Number(ui.order)) ? Number(ui.order) : index,
        collapsed: config.attributes.allowCollapse !== false && ui.collapsed === true,
        showCollapseToggle: config.attributes.allowCollapse !== false,
        locked: ui.locked === true,
        draggable: editable && ui.locked !== true,
        breakdown: buildAttributeSources(sheet.actor, attribute, config)
      };
    })
    .sort((a, b) => (a.order - b.order) || a.label.localeCompare(b.label));

  const damageRule = config.otherStats.damageReduction;
  const damageResource = config.resources.find((resource) => resource.id === damageRule.resourceId) ?? null;
  const initiativeRule = config.otherStats.initiative;
  const initiativeAttribute = getInitiativeAttribute(sheet.actor, config);
  const initiativeModifier = getInitiativeModifier(sheet.actor, config);

  const proficiencyConfig = config.proficiencies;
  const proficiencyPointConfig = proficiencyConfig.points;
  const proficiencyPoints = {
    enabled: proficiencyConfig.enabled && proficiencyPointConfig.enabled,
    label: proficiencyPointConfig.label,
    value: getProficiencyPoints(sheet.actor, config)
  };
  const canDecreaseProficiencies = canDecreaseProficiency(sheet.actor, config);
  const proficiencies = proficiencyConfig.entries
    .filter((proficiency) => proficiency.enabled)
    .map((proficiency) => {
      const baseValue = getProficiencyBaseValue(sheet.actor, proficiency);
      const value = getProficiencyValue(sheet.actor, proficiency, config);
      const baseModifier = getProficiencyBaseModifier(sheet.actor, proficiency, config);
      const linkedModifier = getLinkedProficiencyModifier(sheet.actor, proficiency, config);
      const totalModifier = getProficiencyModifier(sheet.actor, proficiency, config);
      const linkedAttribute = getLinkedProficiencyAttribute(proficiency, config);
      const attributeMode = proficiencyConfig.mode === "attribute";
      return {
        ...proficiency,
        value,
        showIcon: Boolean(config.addons.svgIcons.enabled && proficiency.icon?.enabled && proficiency.icon?.path),
        iconPath: proficiency.icon?.path || "",
        baseModifier,
        linkedModifier,
        totalModifier,
        modifierText: signed(totalModifier),
        linkedAttributeLabel: linkedAttribute?.label || "",
        attributeMode,
        rollEnabled: attributeMode && proficiency.features.dice,
        showNumber: attributeMode && proficiency.features.number,
        showModifier: !attributeMode || proficiency.features.modifier,
        pointsEnabled: proficiencyPointConfig.enabled,
        canIncrease: editable && proficiencyPointConfig.enabled && proficiencyPoints.value > 0,
        canDecrease: editable && proficiencyPointConfig.enabled && canDecreaseProficiencies
          && (proficiencyPointConfig.allowBelowZero || baseValue > 0),
        breakdown: buildProficiencySources(sheet.actor, proficiency, config)
      };
    });

  const inventory = prepareInventoryContext(sheet.actor, config, editable);
  const equipmentTabs = inventory.equipmentTabs;
  const currentEquipmentTab = equipmentTabs.some(tab => tab.id === sheet._activeEquipmentTab)
    ? sheet._activeEquipmentTab : equipmentTabs[0]?.id;
  sheet._activeEquipmentTab = currentEquipmentTab ?? null;
  for (const tab of equipmentTabs) tab.selected = tab.id === currentEquipmentTab;

  const stats = {
    damageReduction: {
      value: getDamageReduction(sheet.actor),
      enabled: damageRule.enabled,
      resourceLabel: damageResource?.label || ""
    },
    initiative: {
      value: initiativeModifier,
      valueText: signed(initiativeModifier),
      enabled: initiativeRule.enabled,
      attributeLabel: initiativeAttribute?.label || ""
    },
    proficiencies: {
      enabled: proficiencyConfig.enabled,
      label: proficiencyConfig.label,
      attributeMode: proficiencyConfig.mode === "attribute",
      points: proficiencyPoints,
      entries: proficiencies,
      hasEntries: proficiencies.length > 0
    }
  };

  const context = {
    ...baseContext,
    isNpc: isBuxaNpc(sheet.actor),
    npcQuick: isNpcQuick(sheet.actor),
    npcVisual: isBuxaNpc(sheet.actor) && !isNpcQuick(sheet.actor),
    actor: sheet.actor,
    editable,
    isGM: game.user.isGM,
    showSheetSettings: editable && (!isBuxaNpc(sheet.actor) || game.user.isGM),
    basicTabLabel: config.basicTabLabel,
    fullbody: sheet.actor.img || "icons/svg/mystery-man.svg",
    token: getTokenImage(sheet.actor),
    svgIconsEnabled: config.addons.svgIcons.enabled,
    portraitIcons: {
      fullbody: getUiSvgIcon("fullbody"),
      token: getUiSvgIcon("token")
    },
    fields,
    resources,
    level: {
      enabled: config.level.enabled || isNpcQuick(sheet.actor),
      label: config.level.label,
      value: getActorLevel(sheet.actor, config),
      canLevelUp: canLevelUp(sheet.actor, config),
      theme: rarityVisualPresentation(actorRarityContext(sheet.actor, config))
    },
    points,
    showProgression: config.level.enabled || points.enabled || isNpcQuick(sheet.actor),
    attributes,
    showAttributes: attributes.length > 0,
    stats,
    inventory,
    conditions: [...(sheet.actor?.items ?? [])].filter(item=>item?.getFlag?.(MODULE_ID,IS_CONDITION_FLAG)===true)
      .filter(item=>game.user?.isGM || getEffectRules(item,config).visibility==='revealed')
      .map(item=>{const rarity=getEffectRarity(item,config),visual=rarityPresentation(rarity,config.items);
        return {id:item.id,name:item.name,img:item.img||'icons/svg/aura.svg',rarityClass:visual.className,rarityStyle:visual.style};}),
    npcDropCapacity:npcDropCapacity(sheet.actor,config),
    npcDropUsed:npcDropTable(sheet.actor).length,
    npcDropSlots:sheet.actor?.type==='npc' && game.user?.isGM
      ? (()=>{const drops=npcDropTable(sheet.actor);
          return Array.from({length:Math.max(npcDropCapacity(sheet.actor,config),drops.length)},(_,index)=>{
            const entry=drops[index];
            return {index,entry:entry?{id:entry.id,name:entry.data.name,img:entry.data.img||'icons/svg/item-bag.svg',chance:entry.chance}:null};
          });})():[]
  };

  Hooks.callAll(HOOKS.PREPARE_SHEET_CONTEXT, sheet, context);
  return context;
  } finally {
    endIncreaseBatch();
  }
}
