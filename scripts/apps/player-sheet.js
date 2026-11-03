import { enableWindowResize } from "./window-resize.js";
import { createSheetClickSafety, installSheetClickSafety } from "../core/sheet-click-safety.js";
import { notifyError, notifyWarning } from "../core/notifications.js";
import { HOOKS, MODULE_ID, TEMPLATE_PATHS } from "../core/constants.js";
import { getSheetConfig } from "../core/config.js";
import {
  getActorUiState,
  patchActorUiState,
  saveActorUiState
} from "../core/ui-state.js";
import {
  setAttributeOrder,
  toggleAttributeCollapse,
  toggleAttributeLock
} from "../core/attribute-ui.js";
import { levelUpActor } from "../core/leveling.js";
import { updateResource } from "../core/resources.js";
import { setDamageReduction } from "../core/other-stats.js";
import { changeAttribute, rebirthAttribute, addAttributePoints } from "../core/attributes.js";
import { activateAttributeRebirth, attachRebirthBurst } from "./attribute-rebirth-transition.js";
import { BuxaActorConfig } from "./actor-config.js";
import { BuxaPlayerSettings } from "./player-settings.js";
import { BuxaNpcSettings } from "./npc-settings.js";
import { isNpcQuick } from "../core/npc-sheet.js";
import { getResourceHud, saveResourceHud } from "../core/resource-hud.js";
import { setStorageOpen } from "../core/storage-open-state.js";
import { BuxaAttributeSetter } from "./attribute-setter.js";
import { preparePlayerSheetContext } from "./player-sheet-context.js";
import { closeAttributeRollMenu, openAttributeRollMenu } from "./attribute-roll.js";
import { bindProficiencyControls } from "./proficiency-controls.js";
import { bindPortraitControls } from "./portrait-controls.js";
import { bindValueBreakdowns } from "./value-breakdown.js";
import { bindSourceItemNavigation } from "./source-item-navigation.js";
import { closeProficiencyRollMenu } from "./proficiency-roll.js";
import { bindInventoryControls, getInventoryDropDestination, getInventoryDropTargetItemId, placeDroppedInventoryItem } from "./inventory-controls.js";
import { closeItemHoverTooltip } from "./item-tooltip.js";
import { closeItemContextMenu } from "./item-context-menu.js";
import { canStackItems, snapshotEmbeddedItemFromSource, stackActorItems } from "../core/item-runtime.js";
import { importStackableToActor } from "../core/stack-native-import.js";
import { autoStackMovedItem } from "../core/stack-on-move.js";
import { getItemRules } from "../core/item-config.js";
import { getItemKind, getEffectRules } from '../core/effect-config.js';
import { applyEffectToActor, removeEffectFromActor, getActiveEffects } from '../core/effect-runtime.js';
import { IS_CONDITION_FLAG } from '../core/constants.js';
import { mountEffectHud, unmountEffectHud } from './effect-hud.js';
import { applyRarityVisual } from '../core/rarity-visuals.js';
import { getEffectRarity } from '../core/effect-config.js';
import { reconcileInventoryState, trackInventoryItem } from "../core/inventory.js";
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
function signed(value) {
  const number = Number(value) || 0;
  return number >= 0 ? `+${number}` : String(number);
}
function fxId() {
  return foundry.utils.randomID(8);
}
export class BuxaPlayerSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["buxa", "buxa-player-sheet", "themed", "theme-dark"],
    tag: "form",
    position: {
      width: 780,
      height: 600
    },
    window: {
      icon: "fa-solid fa-user",
      resizable: true
    },
    actions: {removeCondition: BuxaPlayerSheet.#removeCondition},
    form: {
      submitOnChange: true,
      closeOnSubmit: false
    }
  };
  static PARTS = {
    main: {
      template: TEMPLATE_PATHS.PLAYER_SHEET,
      scrollable: [".buxa-sheet-scroll"]
    }
  };
  constructor(options = {}) {
    super(options);
    this._scrollTop = null;
    this._restoredUiState = false;
    this._restoredPosition = null;
    this._recentFx = [];
    this._portraitMode = "fullbody";
    this._activeTab = "basic";
    this._activeEquipmentTab = null;
    this._mutationQueue = Promise.resolve();
    this._pendingMutations = 0;
    this._lastQueueNotice = 0;
    this._clickSafety = createSheetClickSafety();
    this._detachClickSafety = null;
    this._clickSafetyRoot = null;
  }
  get title() {
    return this.actor?.name || "Novo Player";
  }
  #queueMutation(task) {
    // A held mouse / autoclick macro must never build hundreds of outstanding
    // Actor mutations. Normal user actions are still serialized as before.
    if (this._pendingMutations >= 5) {
      const now = Date.now();
      if (now - this._lastQueueNotice > 1800) {
        this._lastQueueNotice = now;
        notifyWarning('Too many pending changes. Wait for your sheet to finish saving.');
      }
      return Promise.resolve(false);
    }
    this._pendingMutations++;
    const run = async () => {
      try { return await task(); }
      finally { this._pendingMutations--; }
    };
    const queued = this._mutationQueue.then(run, run);
    this._mutationQueue = queued.catch((error) => {
      console.error(`${MODULE_ID} | Player Sheet mutation failed.`, error);
      notifyError("That change could not be saved. Check the console for details.");
    });
    return queued;
  }
  activateInventoryTab() { this.#applySheetTab("inventory"); }
  #applySheetTab(tab = this._activeTab) {
    if (!this.element) return;
    this._activeTab = (tab === "drop" || tab === "inventory") ? "inventory" : ((tab === "stats" || tab === "otherStats") && !isNpcQuick(this.actor) ? "stats" : "basic");
    this.element.querySelectorAll("[data-sheet-tab]").forEach((button) => {
      const active = button.dataset.sheetTab === this._activeTab;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    this.element.querySelectorAll("[data-sheet-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.sheetPanel !== this._activeTab;
    });
  }
  #rememberFx(effect) {
    if (!effect) return;
    const now = Date.now();
    if (isNpcQuick(this.actor)) return;
    // Keep just the latest pulse for each target; autoclickers can otherwise
    // accumulate thousands of timers/descriptors before a sheet rerender.
    this._recentFx = this._recentFx.filter((entry) => entry.expires > now
      && !(entry.kind === effect.kind && entry.id === effect.id));
    this._recentFx.push({ ...effect, fxToken: fxId(), expires: now + (effect.kind === "rebirth" ? 2050 : 1050) });
    if (this._recentFx.length > 48) this._recentFx.splice(0, this._recentFx.length - 48);
    this.#applyRecentFx();
  }
  #fxTarget(effect) {
    if (!this.element) return null;
    switch (effect.kind) {
      case "level": return this.element.querySelector("[data-buxa-level]");
      case "points": return this.element.querySelector("[data-buxa-points]");
      case "resource": return this.element.querySelector(`[data-resource-card="${CSS.escape(effect.id)}"]`);
      case "attribute":
      case "rebirth": return this.element.querySelector(`[data-attribute-row="${CSS.escape(effect.id)}"]`);
      case "proficiency": return this.element.querySelector(`[data-proficiency-row="${CSS.escape(effect.id)}"]`);
      case "proficiencyPoints": return this.element.querySelector("[data-buxa-proficiency-points]");
      default: return null;
    }
  }
  #applyRecentFx() {
    if (!this.element || isNpcQuick(this.actor)) return;
    const now = Date.now();
    this._recentFx = this._recentFx.filter((entry) => entry.expires > now);
    for (const effect of this._recentFx) {
      const target = this.#fxTarget(effect);
      if (!target || target.dataset.buxaFxId === effect.fxToken) continue;
      target.dataset.buxaFxId = effect.fxToken;
      target.dataset.buxaFxText = effect.text || "";
      target.classList.remove("buxa-fx-gain", "buxa-fx-loss", "buxa-fx-level", "buxa-fx-rebirth", "buxa-fx-spend");
      target.classList.add(`buxa-fx-${effect.tone || "gain"}`);
      if (effect.kind === "rebirth") attachRebirthBurst(target);
      const view = target.ownerDocument?.defaultView ?? globalThis;
      // Repeated updates replace the prior cleanup timer for this target.
      // Do not let autoclickers accumulate hundreds of stale closures.
      if (target._buxaFxCleanupTimer !== undefined)
        view.clearTimeout?.(target._buxaFxCleanupTimer);
      target._buxaFxCleanupTimer = view.setTimeout(() => {
        if (target.dataset.buxaFxId !== effect.fxToken) return;
        delete target._buxaFxCleanupTimer;
        target.classList.remove("buxa-fx-gain", "buxa-fx-loss", "buxa-fx-level", "buxa-fx-rebirth", "buxa-fx-spend");
        delete target.dataset.buxaFxId;
        delete target.dataset.buxaFxText;
        if (effect.kind === "rebirth") target.querySelector(".buxa-rebirth-burst")?.remove();
      }, effect.kind === "rebirth" ? 1720 : 900);
    }
  }
  #restoreUiState() {
    if (this._restoredUiState) return;
    const state=getActorUiState(this.actor);
    this._restoredPosition=state?.position || null;
    if (state && this._scrollTop === null) this._scrollTop=Math.max(0,Number(state.scrollTop)||0);
    if (state?.portraitMode === 'token' || state?.portraitMode === 'fullbody') this._portraitMode=state.portraitMode;
    if (state?.activeTab === 'inventory' || state?.activeTab === 'drop') this._activeTab='inventory';
    else if ((state?.activeTab === 'stats' || state?.activeTab === 'otherStats') && !isNpcQuick(this.actor)) this._activeTab='stats';
    this._restoredUiState=true;
  }
  async _prepareContext(options) {
    this.#restoreUiState();
    const context = await super._prepareContext(options);
    const prepared = await preparePlayerSheetContext(this, context);
    // Render the correct panel in the initial HTML, never render Basic and
    // hide it in _onRender: Foundry swaps the DOM before _onRender finishes.
    prepared.isBasicTab=this._activeTab==='basic';
    prepared.isStatsTab=this._activeTab==='stats';
    prepared.isInventoryTab=this._activeTab==='inventory';
    return prepared;
  }
  async _onRender(context, options) {
    closeAttributeRollMenu(this);
    closeProficiencyRollMenu(this);
    await super._onRender(context, options);
    // ActorSheetV2 can swap its inner DOM on every write. The limiter lives on
    // this instance, not on its buttons, and catches clicks before any handler.
    if (this._clickSafetyRoot !== this.element) {
      this._detachClickSafety?.();
      this._clickSafetyRoot = this.element;
      this._detachClickSafety = installSheetClickSafety(this.element, this._clickSafety);
    }
    enableWindowResize(this);
    mountEffectHud(this);
    for(const pill of this.element.querySelectorAll('[data-bfx-condition-id]')){
      const item=this.actor.items?.get?.(pill.dataset.bfxConditionId);
      if(item)applyRarityVisual(pill,getEffectRarity(item,getSheetConfig()));
    }
    if(this._restoredPosition) {
      const position=this._restoredPosition;
      this._restoredPosition=null;
      this.setPosition(position);
    }
    this.#applySheetTab();
    this.element.querySelectorAll("[data-sheet-tab]").forEach((tab) => {
      const activateTab = (event) => {
        event.preventDefault();
        this.#applySheetTab(tab.dataset.sheetTab);
        void patchActorUiState(this.actor, { activeTab: this._activeTab })
          .catch(error => console.warn(`${MODULE_ID} | Could not save active sheet tab`, error));
      };
      tab.addEventListener("click", activateTab);
      tab.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        activateTab(event);
      });
    });
    const scroller = this.element.querySelector(".buxa-sheet-scroll");
    if (scroller) {
      if (this._scrollTop !== null) scroller.scrollTop = this._scrollTop;
      scroller.addEventListener("scroll", () => {
        this._scrollTop = scroller.scrollTop;
      }, { passive: true });
    }
    this.element.querySelectorAll("[data-close-storage]").forEach(button=>button.addEventListener("click",event=>{
      event.preventDefault();setStorageOpen(this.actor,button.dataset.closeStorage,false);this.render({force:true});
    }));
    bindPortraitControls(this);
    bindValueBreakdowns(this);
    bindSourceItemNavigation(this);
    this.element.querySelector("[data-action='openPlayerSettings']")?.addEventListener("click", event => {
      event.preventDefault();
      if (!this.actor.isOwner) return;
      const SettingsApp = this.actor?.type === "npc" ? BuxaNpcSettings : BuxaPlayerSettings;
      new SettingsApp({ actor: this.actor }).render({ force: true });
    });
    this.element.querySelectorAll("[data-resource-track-toggle]").forEach(button => {
      button.addEventListener("click", async event => {
        event.preventDefault();
        if (!this.actor.isOwner || button.disabled) return;
        const resourceId = button.dataset.resourceTrackToggle;
        const resource = getSheetConfig().resources.find(entry => entry.id === resourceId);
        if (!resource) return;
        button.disabled = true;
        try {
          const active = getResourceHud(this.actor, resource).enabled;
          await saveResourceHud(this.actor, resourceId, { enabled: !active }, resource);
          button.classList.toggle("is-active", !active);
          button.setAttribute("aria-pressed", String(!active));
          button.title = !active ? "Stop displaying on token" : "Track on token";
        } catch (error) {
          console.error(`${MODULE_ID} | Could not update resource tracking`, error);
          notifyError("Could not change token resource tracking.");
        } finally { button.disabled = false; }
      });
    });
    this.element.querySelector("[data-action='levelUp']")?.addEventListener("click", (event) => {
      event.preventDefault();
      void this.#queueMutation(async () => {
        try {
          await patchActorUiState(this.actor, {
            portraitMode: this._portraitMode,
            activeTab: this._activeTab
          });
        } catch (_error) {
          // UI-state persistence must never block the gameplay level-up action.
        }
        const result = await levelUpActor(this.actor);
        if (!result) return;
        this.#rememberFx({ kind: "level", tone: "level", text: `LEVEL ${result.newLevel}` });
        if (result.pointsGained > 0) {
          this.#rememberFx({ kind: "points", tone: "gain", text: `+${result.pointsGained}` });
        }
        if (result.proficiencyPointsGained > 0) {
          this.#rememberFx({ kind: "proficiencyPoints", tone: "gain", text: `+${result.proficiencyPointsGained}` });
        }
        for (const change of result.resourceChanges ?? []) {
          const currentDelta = Number(change.current) - Number(change.before?.current ?? 0);
          const maxDelta = Number(change.max) - Number(change.before?.max ?? 0);
          const chunks = [];
          if (currentDelta) chunks.push(signed(currentDelta));
          if (maxDelta) chunks.push(`MAX ${signed(maxDelta)}`);
          if (chunks.length) this.#rememberFx({ kind: "resource", id: change.id, tone: currentDelta < 0 ? "loss" : "gain", text: chunks.join(" · ") });
        }
      });
    });
    this.element.querySelectorAll("[data-resource-current]").forEach((input) => {
      input.addEventListener("change", () => {
        const resourceId = input.dataset.resourceCurrent;
        const nextValue = input.value;
        void this.#queueMutation(async () => {
          const result = await updateResource(this.actor, resourceId, { current: nextValue });
          if (!result || !result.currentDelta) return;
          this.#rememberFx({
            kind: "resource",
            id: resourceId,
            tone: result.currentDelta < 0 ? "loss" : "gain",
            text: signed(result.currentDelta)
          });
        });
      });
    });
    this.element.querySelectorAll("[data-resource-max]").forEach((input) => {
      input.addEventListener("change", () => {
        const resourceId = input.dataset.resourceMax;
        const nextValue = input.value;
        void this.#queueMutation(async () => {
          const result = await updateResource(this.actor, resourceId, { max: nextValue });
          if (!result) return;
          const chunks = [];
          if (result.currentDelta) chunks.push(signed(result.currentDelta));
          if (result.maxDelta) chunks.push(`MAX ${signed(result.maxDelta)}`);
          if (!chunks.length) return;
          this.#rememberFx({
            kind: "resource",
            id: resourceId,
            tone: (result.currentDelta < 0 || result.maxDelta < 0) ? "loss" : "gain",
            text: chunks.join(" · ")
          });
        });
      });
    });
    this.element.querySelector("[data-other-stat-dr]")?.addEventListener("change", (event) => {
      const input = event.currentTarget;
      const nextValue = input.value;
      void this.#queueMutation(async () => {
        const result = await setDamageReduction(this.actor, nextValue);
        if (!result) return;
        input.value = String(result.after);
      });
    });
    const applyAttributeResult = async (attributeId, result) => {
      if (!result) return;
      if (Object.hasOwn(result, "delta")) {
        if (!result.delta) return;
        this.#rememberFx({ kind: "attribute", id: attributeId, tone: result.delta < 0 ? "loss" : "gain" });
        const pointsDelta = Number(result.pointsAfter) - Number(result.pointsBefore);
        if (pointsDelta) this.#rememberFx({ kind: "points", tone: pointsDelta < 0 ? "loss" : "gain", text: signed(pointsDelta) });
      } else if (Object.hasOwn(result, "after")) {
        this.#rememberFx({ kind: "rebirth", id: attributeId, tone: "rebirth", text: `REBIRTH ${result.after}` });
      }
      const attribute = getSheetConfig().attributes.entries.find((entry) => entry.id === attributeId);
      if (attribute?.rebirth?.enabled && this.rendered) await this.render({ force: true });
    };
    this.element.querySelectorAll("[data-action='attributeIncrease']").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        const attributeId = button.dataset.attributeId;
        void this.#queueMutation(async () => {
          const result = await changeAttribute(this.actor, attributeId, 1);
          await applyAttributeResult(attributeId, result);
        });
      });
    });
    this.element.querySelectorAll("[data-action='attributeDecrease']").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        const attributeId = button.dataset.attributeId;
        void this.#queueMutation(async () => {
          const result = await changeAttribute(this.actor, attributeId, -1);
          await applyAttributeResult(attributeId, result);
        });
      });
    });
    this.element.querySelectorAll("[data-action='toggleAttributeCollapse']").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        if (getSheetConfig().attributes.allowCollapse === false) return;
        const attributeId = button.dataset.attributeId;
        void this.#queueMutation(async () => {
          const changed = await toggleAttributeCollapse(this.actor, attributeId);
          if (changed && this.rendered) await this.render({ force: true });
        });
      });
    });
    this.element.querySelectorAll("[data-action='toggleAttributeLock']").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        const attributeId = button.dataset.attributeId;
        void this.#queueMutation(async () => {
          const changed = await toggleAttributeLock(this.actor, attributeId);
          if (changed && this.rendered) await this.render({ force: true });
        });
      });
    });
    this.element.querySelectorAll("[data-attribute-number]").forEach((numberElement) => {
      numberElement.addEventListener("click", async (event) => {
        event.preventDefault();
        if (numberElement.dataset.directEdit !== "true") return;
        const attributeId = numberElement.dataset.attributeNumber;
        const attribute = getSheetConfig().attributes.entries.find((entry) => entry.id === attributeId);
        if (!attribute) return;
        const amount = await BuxaAttributeSetter.prompt({ actor: this.actor, attribute });
        if (amount === null || amount === undefined) return;
        void this.#queueMutation(async () => {
          const result = await addAttributePoints(this.actor, attributeId, amount);
          await applyAttributeResult(attributeId, result);
        });
      });
    });
    this.element.querySelectorAll("[data-action='attributeRoll']").forEach((emblem) => {
      const openRollMenu = (event) => {
        event.preventDefault();
        event.stopPropagation();
        openAttributeRollMenu(this, emblem);
      };
      // Primary interaction is a normal click. Right-click remains supported too.
      emblem.addEventListener("click", openRollMenu);
      emblem.addEventListener("contextmenu", openRollMenu);
      emblem.addEventListener("keydown", (event) => {
        const activate = event.key === "Enter" || event.key === " " || event.key === "ContextMenu" || (event.shiftKey && event.key === "F10");
        if (!activate) return;
        openRollMenu(event);
      });
    });
    this.element.querySelectorAll("[data-action='attributeRebirth']").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        // Reserve synchronously: a second click must not queue another claim.
        if (button.dataset.buxaRebirthQueued === "true") return;
        button.dataset.buxaRebirthQueued = "true";
        button.disabled = true;
        const attributeId = button.dataset.attributeId;
        const label = button.dataset.attributeLabel || "Attribute";
        void this.#queueMutation(async () => {
          try {
            await activateAttributeRebirth(button, {
              confirm: () => foundry.applications.api.DialogV2.confirm({
                window: { title: `Rebirth · ${label}` },
                content: `<p>Rebirth <strong>${foundry.utils.escapeHTML(label)}</strong>? Its displayed value will roll over. Item-assisted rebirth tiers remain active while their bonuses support the cap.</p>`,
                yes: { label: "Rebirth", icon: "fa-solid fa-lock-open" },
                no: { label: "Cancel" },
                modal: true
              }),
              commit: () => rebirthAttribute(this.actor, attributeId, { ask: false }),
              reveal: async (result) => {
                // The attribute result already re-renders once to reveal the new
                // rarity; a second render cancels the fresh burst animation.
                await applyAttributeResult(attributeId, result);
              }
            });
          } finally {
            // A successful claim must always release the button, even when
            // Foundry destroys the old row as part of rerendering.
          }
        }).catch(error => {
          console.error(`${MODULE_ID} | Rebirth action failed`, error);
          notifyError("Rebirth could not be completed. Try again after checking the sheet.");
        }).finally(() => {
          delete button.dataset.buxaRebirthQueued;
          button.disabled = false;
        });
      });
    });
    const cards = [...this.element.querySelectorAll("[data-attribute-card]")];
    let draggingId = null;
    for (const card of cards) {
      const locked = card.dataset.locked === "true";
      if (!locked && card.getAttribute("draggable") === "true") {
        card.addEventListener("dragstart", (event) => {
          draggingId = card.dataset.attributeCard;
          card.classList.add("is-dragging");
          event.dataTransfer?.setData("text/plain", draggingId);
          if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
        });
        card.addEventListener("dragend", () => {
          card.classList.remove("is-dragging");
          for (const other of cards) other.classList.remove("is-drop-target");
          draggingId = null;
        });
        card.addEventListener("dragover", (event) => {
          if (!draggingId || draggingId === card.dataset.attributeCard) return;
          event.preventDefault();
          if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
          for (const other of cards) other.classList.remove("is-drop-target");
          card.classList.add("is-drop-target");
          const board = card.closest("[data-attribute-board]");
          const draggingCard = board?.querySelector(`[data-attribute-card="${CSS.escape(draggingId)}"]`);
          if (!board || !draggingCard || draggingCard === card) return;
          const cardRect = card.getBoundingClientRect();
          const before = event.clientY < (cardRect.top + cardRect.height / 2)
            || (Math.abs(event.clientY - (cardRect.top + cardRect.height / 2)) < cardRect.height * .2
              && event.clientX < cardRect.left + cardRect.width / 2);
          board.insertBefore(draggingCard, before ? card : card.nextSibling);
        });
        card.addEventListener("dragleave", () => card.classList.remove("is-drop-target"));
        card.addEventListener("drop", (event) => {
          event.preventDefault();
          for (const other of cards) other.classList.remove("is-drop-target");
          const board = card.closest("[data-attribute-board]");
          if (!board) return;
          const ordered = [...board.querySelectorAll("[data-attribute-card]")].map((entry) => entry.dataset.attributeCard);
          void this.#queueMutation(() => setAttributeOrder(this.actor, ordered));
        });
      }
    }
    bindProficiencyControls(this, {
      queueMutation: (task) => this.#queueMutation(task),
      rememberFx: (effect) => this.#rememberFx(effect)
    });
    // A stable live drop target for Pixi pointer drags and native Item drags.
    // The actual hovered sheet determines the destination Actor.
    this.element.dataset.buxaDropActorId=this.actor.id;
    if (this.actor.isToken) this.element.dataset.buxaDropTokenId=this.actor.token?.id || this.actor.parent?.id;
    else delete this.element.dataset.buxaDropTokenId;
    bindInventoryControls(this, {
      queueMutation: (task) => this.#queueMutation(task)
    });
    this.#applyRecentFx();
    Hooks.callAll(HOOKS.RENDER_SHEET, this, this.element, context, options);
  }
  static async #removeCondition(event,button) {
    event?.preventDefault?.();
    if(!game.user?.isGM)return;
    const id=button?.dataset?.conditionId || event?.target?.closest?.('[data-condition-id]')?.dataset.conditionId;
    const item=this.actor?.items?.get?.(id);
    if(!item || item.getFlag?.(MODULE_ID,IS_CONDITION_FLAG)!==true)return;
    await removeEffectFromActor(this.actor,null,{effectItemId:id});
    await this.actor.deleteEmbeddedDocuments('Item',[id]);
    await this.render({force:true});
  }
  async _onDropItem(event, item) {
    if(getItemKind(item)==='effect' && getEffectRules(item,getSheetConfig()).behavior==='passive'){
      if(!this.actor?.isOwner)return null;
      let embedded=item?.parent?.id===this.actor.id ? item : null;
      const wasEmbedded=Boolean(embedded);
      const alreadyCondition=embedded?.getFlag?.(MODULE_ID,IS_CONDITION_FLAG)===true;
      if(!embedded){
        const raw=item.toObject();delete raw._id;delete raw.folder;delete raw.sort;
        raw.flags ??={};raw.flags[MODULE_ID] ??={};
        raw.flags[MODULE_ID][IS_CONDITION_FLAG]=true;
        const made=await this.actor.createEmbeddedDocuments('Item',[raw]);embedded=made?.[0];
      }else if(embedded.getFlag(MODULE_ID,IS_CONDITION_FLAG)!==true){
        await embedded.setFlag(MODULE_ID,IS_CONDITION_FLAG,true);
      }
      if(!embedded)return null;
      // The primary GM observes Item creation/condition flags through
      // Foundry's document hooks; do not apply again from the source client.
      // Updating a new condition flag already triggers primary-GM hook
      // application. Only re-apply an existing condition for intentional stacks.
      if(wasEmbedded && alreadyCondition && game.user?.isGM)await applyEffectToActor(this.actor,embedded);
      await this.render({force:true});
      return embedded;
    }
    const destination = getInventoryDropDestination(event);
    if (!destination) return super._onDropItem(event, item);
    const config = getSheetConfig();
    const targetId = getInventoryDropTargetItemId(event);
    const targetItem = targetId ? this.actor?.items?.get?.(targetId) : null;
    if (item?.parent?.id !== this.actor?.id && getItemRules(item,config).multiple.enabled) {
      // Actor, World and Compendium incoming stacks all use the same
      // capacity/placement transaction. No duplication on a failed fit.
      const receipt=await importStackableToActor(this.actor,item,destination,config);
      return receipt.item;
    }
    if (targetItem && item?.id !== targetItem.id && canStackItems(item, targetItem, config)) {
      await stackActorItems(this.actor, item, targetItem, {deleteSource:true,config});
      await reconcileInventoryState(this.actor, config);
      return targetItem;
    }
    if (item?.parent?.id === this.actor?.id) {
      const moved=await placeDroppedInventoryItem(this, item, destination);
      if(moved && ['inventory','storage'].includes(destination.area))
        await autoStackMovedItem(this.actor,item.id,config);
      return item;
    }
    const result = await super._onDropItem(event, item);
    const candidates = Array.isArray(result) ? result : [result];
    const embedded = candidates.find((entry) => entry?.parent?.id === this.actor?.id) ?? null;
    if (embedded) {
      await snapshotEmbeddedItemFromSource(item, embedded, { config, force: true });
      const moved = await placeDroppedInventoryItem(this, embedded, destination);
      if (!moved) await trackInventoryItem(this.actor, embedded.id, config);
      // The new Item and inventory flag updates trigger the sheet redraw.
    }
    return result;
  }
  async _preClose(options) {
    unmountEffectHud(this);
    this._detachClickSafety?.();
    this._detachClickSafety = null;
    this._clickSafetyRoot = null;
    this._clickSafety.reset();
    closeAttributeRollMenu(this);
    closeProficiencyRollMenu(this);
    closeItemHoverTooltip(this);
    closeItemContextMenu(this);
    const scroll = this.element?.querySelector?.(".buxa-sheet-scroll");
    if (scroll) this._scrollTop = scroll.scrollTop;
    try {
      await this._mutationQueue;
      await saveActorUiState(this.actor, {
        position: this.position,
        scrollTop: this._scrollTop,
        portraitMode: this._portraitMode,
        activeTab: this._activeTab
      });
    } catch (error) {
      console.warn(`${MODULE_ID} | Could not save Player Sheet UI state.`, error);
    }
    return super._preClose(options);
  }
}
