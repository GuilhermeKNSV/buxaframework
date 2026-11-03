import { rechargeItem } from '../core/item-recharge.js';
import { getSheetConfig } from "../core/config.js";
import { getItemRules } from "../core/item-config.js";
import { itemUseState, useItemWithoutDice } from "../core/item-use-runtime.js";
import { resolveItemDice, rollItemDice } from "../core/item-dice.js";
import { isRevealed } from "../core/item-discovery.js";
import { getItemQuantity } from "../core/dnd5e.js";
import { getStackSplitAvailability, splitItemStack } from "../core/item-stacks.js";
import { notifyWarning, notifySuccess } from "../core/notifications.js";
import { getInventoryState, getFreeInventorySlotIndex, moveInventoryItem } from "../core/inventory.js";
import { findAutoEquipDestination, autoEquipInventoryItem } from "../core/equipment-auto-equip.js";
import { physicalQuantity, PHYSICAL_SETTINGS, normalizePhysicalSettings } from "../core/physical-items.js";
import { quickDropPoint } from "../core/physical-quick-drop.js";
import { setStorageOpen } from "../core/storage-open-state.js";
import { requestPhysicalAction } from "../integrations/physical-item-transfers.js";
import { promptUnstackAmount } from "./unstack-dialog.js";

const states = new WeakMap();

export function closeItemContextMenu(sheet) {
  const state = states.get(sheet);
  state?.cleanup?.();
  state?.menu?.remove?.();
  states.delete(sheet);
}

function actionButton(doc, { icon, title, details, role = "menuitem" }) {
  const button = doc.createElement("button");
  button.type = "button";
  button.setAttribute("role", role);
  const glyph = doc.createElement("i");
  glyph.className = icon;
  glyph.setAttribute("aria-hidden", "true");
  const text = doc.createElement("span");
  const label = doc.createElement("strong");
  label.textContent = title;
  text.append(label);
  if (details) {
    const small = doc.createElement("small");
    small.textContent = details;
    text.append(small);
  }
  button.append(glyph, text);
  return button;
}

export function createItemContextMenu(sheet, item, { hotbarRemove = null, hotbarContext = false, hotbarLocked = false } = {}) {
  const config = getSheetConfig();
  const rules = getItemRules(item, config);
  const rolls = rules.dice
    .filter((entry) => entry.chatRoll && isRevealed(entry))
    .map((entry) => ({ entry, resolved: resolveItemDice(item, entry, { actor: sheet.actor, config }) }));
  const useState = itemUseState(item,config);
  const canOfferSplit = rules.multiple.enabled && getItemQuantity(item) > 1;
  const split = canOfferSplit ? getStackSplitAvailability(sheet.actor, item, config) : null;
  const doc = sheet.element?.ownerDocument ?? document;
  const menu = doc.createElement("div");
  menu.className = "buxa-item-context-menu buxa-item-action-popover";
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", "Item actions");

  const actions = doc.createElement("div");
  actions.className = "buxa-item-context-actions";
  for (const { entry, resolved } of rolls) {
    const button = actionButton(doc, {
      icon: "fa-solid fa-dice-d20",
      title: entry.label || "ROLL",
      details: resolved.displayText
    });
    button.dataset.diceId = entry.id;
    if (useState.exhausted) { button.disabled=true; button.title="No charges remain"; }
    actions.append(button);
  }
  if ((rules.resourceEffects?.length || rules.limits?.enabled) && !rolls.length) {
    const button=actionButton(doc,{icon:"fa-solid fa-hand-sparkles",title:"USE ITEM",details:useState.exhausted?"No charges remain":"Use its effects"});
    button.dataset.action="use-item"; button.disabled=useState.exhausted; actions.append(button);
  }
  if (useState.limits.enabled && useState.limits.recharge.button.enabled) {
    const recharge=useState.limits.recharge.button;
    const label=recharge.resourceId ? config.resources?.find(r=>r.id===recharge.resourceId)?.label : null;
    const payment=!(Number(recharge.cost)>0) || !recharge.resourceId ? 'Free' : label
      ? (recharge.costType==='percent' ? `${recharge.cost}% of max ${label}` : `${Math.ceil(Number(recharge.cost)||0)} ${label}`)
      : 'Resource unavailable';
    const button=actionButton(doc,{icon:'fa-solid fa-arrows-rotate',title:'RECHARGE',
      details:`Restore ${recharge.charges} ${recharge.charges===1?'charge':'charges'} · ${payment}`});
    button.dataset.action='recharge';button.disabled=useState.usage.used===0;
    actions.append(button);
  }
  if (canOfferSplit) {
    const button = actionButton(doc, {
      icon: "fa-solid fa-layer-group",
      title: "UNSTACK",
      details: split.allowed ? `Split ×${getItemQuantity(item)} into two stacks` : "Inventory full"
    });
    button.dataset.action = "unstack";
    if (!split.allowed) {
      button.disabled = true;
      button.title = split.reason;
    }
    if (rolls.length) button.classList.add("buxa-item-context-divided");
    actions.append(button);
  }
  if (rules.storage?.slots?.external?.length) {
    const button=actionButton(doc,{icon:"fa-solid fa-box-open",title:"OPEN",details:"Open container without equipping"});
    button.dataset.action="open-storage";actions.append(button);
  }
  const placement = getInventoryState(sheet.actor, config).placements[item.id];
  if (!hotbarContext && placement?.area === "equipment") {
    const button = actionButton(doc, {
      icon: "fa-solid fa-arrow-down-to-bracket", title: "UNEQUIP", details: "Move to inventory"
    });
    button.dataset.action = "unequip";
    actions.append(button);
  }
  const alreadyInHotbar = hotbarContext || game.buxaframework?.hasItemOnHotbar?.(sheet.actor, item) === true;
  if (alreadyInHotbar) {
    const remove = actionButton(doc, { icon: 'fa-solid fa-xmark', title: 'REMOVE SHORTCUT',
      details: hotbarLocked ? 'Unlock the hotbar to edit shortcuts' : 'Keep the item in your inventory' });
    remove.dataset.action = 'remove-hotbar';
    remove.disabled = hotbarLocked;
    actions.append(remove);
  } else if (game.buxaframework?.addItemToHotbar) {
    const add = actionButton(doc, { icon: 'fa-solid fa-bolt', title: 'ADD TO HOTBAR', details: 'Create a quick-access shortcut' });
    add.dataset.action = 'add-hotbar';
    actions.append(add);
  }
  if (!hotbarContext && placement?.area !== "equipment" && rules.equip.enabled) {
    const available = findAutoEquipDestination(sheet.actor, item, config);
    const button = actionButton(doc, {
      icon: "fa-solid fa-shield-halved", title: "EQUIP",
      details: available ? "Equip in an available compatible slot" : "No free compatible equipment slot"
    });
    button.dataset.action = "equip";
    if (!available) button.disabled = true;
    actions.append(button);
  }
  if (!hotbarContext) {
    const dropButton = actionButton(doc, {
      icon: "fa-solid fa-arrow-right-from-bracket", title: "DROP",
      details: "Drop full stack on the board"
    });
    dropButton.dataset.action = "drop";
    dropButton.classList.add("buxa-item-context-danger");
    actions.append(dropButton);
  }
  if (!actions.childElementCount) {
    const empty = doc.createElement("p");
    empty.className = "buxa-item-context-empty";
    empty.textContent = "No actions";
    actions.append(empty);
  }
  menu.append(actions);
  return menu;
}

/** One-click DROP deliberately moves the complete stack, including packed
 * backpack contents. It cannot remove anything locally before the GM confirms
 * creation of the scene object. */
export async function instantDropInventoryItem(actor, item, { scene = globalThis.canvas?.scene,
  user = globalThis.game?.user, canvasView = globalThis.canvas } = {}) {
  if(!actor?.isOwner || !item?.id || !scene) throw Error("Open a scene to drop this item.");
  const tokens=scene.tokens?.contents ?? [...(scene.tokens ?? [])];
  const actors=game.actors?.contents ?? [...(game.actors ?? [])];
  const settings=normalizePhysicalSettings(game.settings.get('buxaframework',PHYSICAL_SETTINGS));
  const point=quickDropPoint({actor,scene,user,tokens,actors,settings,
    selected:canvasView?.tokens?.controlled ?? [],
    viewCenter:canvasView?.stage?.pivot});
  if(!point) throw Error("No valid drop spot near your character. Move its token onto the scene or drag the item manually.");
  const amount=physicalQuantity(item);
  if(amount<1) throw Error("This item has no quantity to drop.");
  return requestPhysicalAction({action:'drop',source:'actor',sceneId:scene.id,actorId:actor.id,
    ...(actor.isToken ? {sourceTokenId:actor.token?.id || actor.parent?.id} : {}),
    itemId:item.id,quantity:amount,point});
}

export function openItemContextMenu(sheet, item, event, { queueMutation = (task) => task(), hotbarRemove = null, hotbarContext = false, hotbarLocked = false } = {}) {
  closeItemContextMenu(sheet);
  if (!sheet.actor?.isOwner || !item) return;
  const doc = sheet.element?.ownerDocument ?? document;
  const menu = createItemContextMenu(sheet, item, { hotbarRemove, hotbarContext, hotbarLocked });
  doc.body.append(menu);
  const view = doc.defaultView ?? window;
  const margin = 8;
  const rect = menu.getBoundingClientRect();
  const left = Math.min(event.clientX, view.innerWidth - rect.width - margin);
  const top = Math.min(event.clientY, view.innerHeight - rect.height - margin);
  menu.style.left = `${Math.max(margin, left)}px`;
  menu.style.top = `${Math.max(margin, top)}px`;
  (view.requestAnimationFrame ?? requestAnimationFrame)(() => menu.classList.add("is-open"));

  const close = () => closeItemContextMenu(sheet);
  const outside = (outsideEvent) => { if (!menu.contains(outsideEvent.target)) close(); };
  const key = (keyEvent) => { if (keyEvent.key === "Escape") close(); };
  doc.addEventListener("pointerdown", outside, true);
  doc.addEventListener("keydown", key, true);
  const scroll = sheet.element?.querySelector(".buxa-sheet-scroll");
  scroll?.addEventListener("scroll", close, { passive: true });

  menu.querySelectorAll("[data-dice-id]").forEach((button) => {
    button.addEventListener("click", async (clickEvent) => {
      clickEvent.preventDefault();
      clickEvent.stopPropagation();
      const diceId = button.dataset.diceId;
      close();
      await rollItemDice(item, diceId, { actor: sheet.actor, config: getSheetConfig() });
    });
  });

  menu.querySelector("[data-action='add-hotbar']")?.addEventListener('click', async event => {
    event.preventDefault(); event.stopPropagation(); close();
    try { await game.buxaframework?.addItemToHotbar?.(sheet.actor, item); }
    catch(error) { notifyWarning(error?.message || 'Could not add item to hotbar.'); }
  });
  menu.querySelector("[data-action='remove-hotbar']")?.addEventListener('click', event => {
    event.preventDefault(); event.stopPropagation(); close();
    if (hotbarContext) hotbarRemove?.();
    else void game.buxaframework?.removeItemFromHotbar?.(sheet.actor, item)?.catch?.(error => notifyWarning(error?.message || 'Could not remove shortcut.'));
  });

  menu.querySelector("[data-action='use-item']")?.addEventListener("click", async (event) => {
    event.preventDefault(); event.stopPropagation(); close();
    void queueMutation(async()=>{try {await useItemWithoutDice(item,{actor:sheet.actor,config:getSheetConfig()});}catch(error){notifyWarning(error.message || "Item use failed.");}});
  });

  menu.querySelector("[data-action='recharge']")?.addEventListener('click',event=>{
    event.preventDefault();event.stopPropagation();close();
    void queueMutation(async()=>{
      try {const result=await rechargeItem(item,{actor:sheet.actor,config:getSheetConfig()});notifySuccess(`Restored ${result.added} ${result.added===1?'charge':'charges'}.`);}
      catch(error){notifyWarning(error.message||'Recharge failed.');}
    });
  });

  menu.querySelector("[data-action='unstack']")?.addEventListener("click", async (clickEvent) => {
    clickEvent.preventDefault();
    clickEvent.stopPropagation();
    // Capture the click location before removing the context menu. The new
    // non-modal quantity picker opens beside this action, not at screen center.
    const anchor = {
      x: clickEvent.clientX,
      y: clickEvent.clientY,
      rect: clickEvent.currentTarget?.getBoundingClientRect?.()
    };
    close();
    const amount = await promptUnstackAmount(item, { ownerDocument: doc, anchor });
    if (amount === null) return;
    void queueMutation(async () => {
      try {
        // Re-validate after the dialog: the user or another macro may have
        // changed quantity or capacity while the quantity selector was open.
        await splitItemStack(sheet.actor, item, amount, getSheetConfig());
        // Item/Actor updates already refresh open Foundry sheets.
      } catch (error) {
        console.warn("buxaframework | Unable to unstack item.", error);
        notifyWarning(error?.message || "Could not unstack this item.");
      }
    });
  });

  menu.querySelector("[data-action='open-storage']")?.addEventListener("click",event=>{
    event.preventDefault();event.stopPropagation();close();setStorageOpen(sheet.actor,item.id,true);sheet.render({force:true});
  });
  menu.querySelector("[data-action='unequip']")?.addEventListener("click", (clickEvent) => {
    clickEvent.preventDefault();clickEvent.stopPropagation();close();
    void queueMutation(async () => {
      try {
        const config=getSheetConfig();
        const index=getFreeInventorySlotIndex(sheet.actor,config,item.id);
        if(index===null) throw Error("There is no room to unequip this item.");
        const result=await moveInventoryItem(sheet.actor,item.id,{area:'inventory',index},config);
        if(!result) throw Error("Cannot unequip the item at this position.");
      } catch(error) {
        console.warn('buxaframework | Unequip failed',error);
        notifyWarning(error?.message || 'Could not unequip item.');
      }
    });
  });
  menu.querySelector("[data-action='equip']")?.addEventListener("click", (clickEvent) => {
    clickEvent.preventDefault();clickEvent.stopPropagation();close();
    void queueMutation(async () => {
      try {
        const result=await autoEquipInventoryItem(sheet.actor,item,getSheetConfig());
        if (!result) throw Error("No free compatible equipment slot is available.");
      } catch(error) {
        console.warn('buxaframework | Auto equip failed',error);
        notifyWarning(error?.message || 'Could not equip item.');
      }
    });
  });
  menu.querySelector("[data-action='drop']")?.addEventListener("click", (clickEvent) => {
    clickEvent.preventDefault();clickEvent.stopPropagation();close();
    void queueMutation(async () => {
      try {
        await instantDropInventoryItem(sheet.actor,item);
        notifySuccess('Item dropped on the board.');
      } catch(error) {
        console.warn('buxaframework | Quick drop failed',error);
        notifyWarning(error?.message || 'Could not drop the item.');
      }
    });
  });
  states.set(sheet, {
    menu,
    cleanup: () => {
      doc.removeEventListener("pointerdown", outside, true);
      doc.removeEventListener("keydown", key, true);
      scroll?.removeEventListener("scroll", close);
    }
  });
}
