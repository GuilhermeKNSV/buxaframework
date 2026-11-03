/** Client-side Buxa hotbar. Item references are read from the active Actor;
 * shortcuts never duplicate, unequip or remove documents. */
import { MODULE_ID } from '../core/constants.js';
import { HOTBAR_SETTING, defaultHotbarState, normalizeHotbarState, assignHotbarSlot, nextHotbarSlot, hotbarSlots, hotbarItemLocations, removeHotbarItem, mergeHotbarConfiguration } from '../core/hotbar-state.js';
import { resolveHotbarActor } from './hotbar-actor.js';
import { beginHotbarTokenSelection } from './hotbar-token-selection.js';
import { buildHotbarView, setHotbarAttributeDrawerState } from './hotbar-view.js';
import { openHotbarConfigDialog } from './hotbar-config-dialog.js';
import { activateHotbarItem, openHotbarItemMenu } from './hotbar-item-actions.js';
import { notifyWarning } from '../core/notifications.js';
import { bindHotbarAttributeTray, closeHotbarAttributeMenu } from './hotbar-attributes.js';

const SLOT_MIME = 'application/x-buxa-hotbar';
let controller = null;
let pendingState = null;
let hotbarSaveInFlight = false;
let hotbarQueuedSave = null;
async function flushHotbarSaves() {
  if (hotbarSaveInFlight) return;
  hotbarSaveInFlight = true;
  try {
    while (hotbarQueuedSave) {
      const batch = hotbarQueuedSave;
      hotbarQueuedSave = null;
      try {
        await game.settings.set(MODULE_ID, HOTBAR_SETTING, batch.state);
        for (const waiter of batch.waiters) waiter.resolve(batch.state);
      } catch (error) {
        for (const waiter of batch.waiters) waiter.reject(error);
      } finally {
        if (pendingState === batch.state) pendingState = null;
        controller?.requestRender();
      }
    }
  } finally { hotbarSaveInFlight = false; }
}
export function registerHotbarSettings() {
  game.settings.register(MODULE_ID, HOTBAR_SETTING, {
    name: 'Buxa Custom Hotbar', scope: 'client', config: false, type: Object,
    default: defaultHotbarState(),
    onChange: () => controller?.requestRender()
  });
}
export function getHotbarState() {
  // Read pending changes too; Foundry settings commits are asynchronous.
  return normalizeHotbarState(pendingState ?? game.settings.get(MODULE_ID, HOTBAR_SETTING));
}
export function saveHotbarState(next) {
  const state = normalizeHotbarState(next);
  pendingState = state;
  controller?.requestRender();
  return new Promise((resolve, reject) => {
    if (hotbarQueuedSave) {
      // All UI actions derive from pendingState, so the latest snapshot includes
      // the previous queued changes. Intermediate settings writes add no value.
      hotbarQueuedSave.state = state;
      hotbarQueuedSave.waiters.push({resolve, reject});
    } else hotbarQueuedSave = {state, waiters:[{resolve, reject}]};
    void flushHotbarSaves();
  });
}
export function saveHotbarAppearance(submitted, baseline = null) {
  return saveHotbarState(mergeHotbarConfiguration(getHotbarState(), submitted, baseline));
}

/** Called by the inventory pointer-drop controller before it commits any move. */
export function assignInventoryHotbarDrop(actor, item, x, y, doc = globalThis.document) {
  if (!controller || !item || !actor?.isOwner || item.parent !== actor) return false;
  return controller.assignDrop(actor, item, x, y, doc);
}
export function hasItemOnHotbar(actor, item) {
  if (!actor || !item?.id) return false;
  return hotbarItemLocations(getHotbarState(), actor.uuid || actor.id, item.id).length > 0;
}
export async function removeItemFromHotbar(actor, item) {
  if (!actor?.isOwner || !item?.id) return false;
  const next = removeHotbarItem(getHotbarState(), actor.uuid || actor.id, item.id);
  if (!next) return false;
  await saveHotbarState(next);
  return true;
}

export async function addItemToHotbar(actor, item) {
  if (!actor?.isOwner || !item || item.parent !== actor || actor.items?.get?.(item.id) !== item) return false;
  const state = getHotbarState();
  if (state.locked) { notifyWarning('Unlock your Buxa hotbar before adding items.'); return false; }
  if (hotbarItemLocations(state, actor.uuid || actor.id, item.id).length) return true;
  if (!globalThis.game?.user?.isGM && resolveHotbarActor(state)?.uuid !== actor.uuid) {
    notifyWarning('Your hotbar is linked to your assigned character.'); return false;
  }
  const actorId = actor.uuid || actor.id;
  const index = nextHotbarSlot(state, actorId, item.id);
  if (index < 0 || index == null) { notifyWarning('This tab is full. Add a row or switch tabs.'); return false; }
  const next = assignHotbarSlot(state, actorId, state.activeTab, index, item.id);
  if (!next) return false;
  next.enabled = true;
  // A shortcut action must not silently switch the GM's selected Actor.
  if (globalThis.game?.user?.isGM && !resolveHotbarActor(next)) next.activeActorId = actor.id;
  await saveHotbarState(next);
  return true;
}

export class BuxaHotbar {
  constructor(doc = globalThis.document) {
    this.doc = doc;
    this.root = null;
    this.switch = null;
    this.raf = 0;
    this.dragging = false;
    this.stopSelection = null;
    this.selecting = false;
    this.suppressClickUntil = 0;
    this.attributesOpen = false;
    this.tabSwitching = false;
    this.activatingItems = new Set();
    this.tabEntranceTarget = '';
    this.tabEntranceDirection = 0;
    this.onResize = () => this.positionSwitch();
  }
  get state() { return getHotbarState(); }
  get actor() { return resolveHotbarActor(this.state); }
  install() {
    const toggle = this.doc.createElement('button');
    toggle.type = 'button'; toggle.className = 'buxa-hb-native-toggle';
    toggle.setAttribute('aria-label', 'Switch to Buxa custom hotbar');
    toggle.title = 'Use Buxa Hotbar';
    const glyph = this.doc.createElement('i'); glyph.className = 'fa-solid fa-wand-magic-sparkles';
    toggle.append(glyph);
    toggle.addEventListener('click', () => void this.toggle().catch(error => notifyWarning(error?.message || 'Hotbar toggle failed.')));
    this.doc.body.append(toggle); this.switch = toggle;
    this.doc.defaultView?.addEventListener('resize', this.onResize, { passive: true });
    this.render();
  }
  positionSwitch() {
    if (!this.switch) return;
    const native = this.doc.querySelector('#hotbar');
    const box = native?.getBoundingClientRect?.();
    if (box?.width > 40 && box?.height > 20) {
      this.switch.style.left = `${Math.max(5, box.left - 35)}px`;
      this.switch.style.top = `${Math.max(5, box.top + Math.min(22, box.height * .35))}px`;
      this.switch.classList.add('has-native-anchor');
    } else {
      this.switch.style.removeProperty('left');
      this.switch.style.removeProperty('top');
      this.switch.classList.remove('has-native-anchor');
    }
  }
  async toggle() {
    this.cancelSelection();
    const next = this.state; next.enabled = !next.enabled;
    await saveHotbarState(next);
  }
  requestRender() {
    if (this.raf) return;
    const view = this.doc.defaultView;
    const run = () => { this.raf = 0; this.render(); };
    if (typeof view?.requestAnimationFrame === 'function') this.raf = view.requestAnimationFrame(run);
    else if (typeof globalThis.requestAnimationFrame === 'function') this.raf = globalThis.requestAnimationFrame(run);
    else this.render();
  }
  render() {
    if (!this.doc?.body) return;
    const state = this.state;
    this.doc.body.classList.toggle('buxa-hotbar-active', state.enabled);
    this.switch?.toggleAttribute('hidden', state.enabled);
    if (!state.enabled) {
      closeHotbarAttributeMenu();
      this.root?.remove(); this.root = null;
      this.positionSwitch(); return;
    }
    // Never detach the active drag element while a slot is being moved.
    if (this.dragging) return;
    const actor = resolveHotbarActor(state);
    const root = buildHotbarView(this.doc, state, actor, { selecting: this.selecting, attributesOpen: this.attributesOpen });
    if (!this.root?.isConnected) root.classList.add('is-entering');
    if (this.tabEntranceTarget && this.tabEntranceTarget === state.activeTab) {
      root.classList.add(this.tabEntranceDirection > 0 ? 'is-tab-next' : 'is-tab-previous');
      this.tabEntranceTarget = '';
    }
    this.bind(root, state, actor);
    if (this.root?.isConnected) this.root.replaceWith(root);
    else this.doc.body.append(root);
    this.root = root;
  }
  async update(patch) { await saveHotbarState({ ...this.state, ...patch }); }
  /** Move the visible shortcuts sideways before revealing the requested page.
   * The saved tab still goes through the existing serialized settings writer. */
  async changeTab(targetId) {
    const current = this.state;
    const from = current.tabs.findIndex(tab => tab.id === current.activeTab);
    const to = current.tabs.findIndex(tab => tab.id === targetId);
    if (this.tabSwitching || from < 0 || to < 0 || to === from) return false;
    this.tabSwitching = true;
    const direction = to > from ? 1 : -1;
    try {
      const board = this.root?.querySelector?.('.buxa-hb-board');
      const reducedMotion = this.doc?.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
      if (typeof board?.animate === 'function' && !reducedMotion) {
        const exit = board.animate([
          { opacity: 1, transform: 'translateX(0)' },
          { opacity: 0, transform: `translateX(${direction * -26}px)` }
        ], { duration: 155, easing: 'cubic-bezier(.45,0,1,1)', fill: 'forwards' });
        try { await exit.finished; } catch { /* switching sheets cancels animations */ }
      }
      this.tabEntranceTarget = targetId;
      this.tabEntranceDirection = direction;
      await this.update({ activeTab: targetId });
      return true;
    } catch (error) {
      this.tabEntranceTarget = '';
      this.requestRender();
      throw error;
    } finally {
      this.tabSwitching = false;
    }
  }
  cancelSelection() {
    this.stopSelection?.();
    this.stopSelection = null;
    this.selecting = false;
    this.requestRender();
  }
  selectActor() {
    if (!globalThis.game?.user?.isGM) return;
    if (this.selecting) { this.cancelSelection(); return; }
    const stop = beginHotbarTokenSelection({
      canvasRef: globalThis.canvas, documentRef: this.doc,
      onSelect: token => {
        this.stopSelection = null;
        this.selecting = false;
        void this.update({
          activeActorId: token.actor.id,
          activeTokenId: token.document.id,
          activeSceneId: globalThis.canvas?.scene?.id || ''
        }).catch(error => notifyWarning(error?.message || 'Could not select Actor.'));
      },
      onCancel: () => { this.stopSelection = null; this.selecting = false; this.requestRender(); }
    });
    if (!stop) { notifyWarning('Open a scene to select an Actor.'); return; }
    this.stopSelection = stop;
    this.selecting = true;
    this.requestRender();
  }
  assignDrop(actor, item, x, y, doc = this.doc) {
    if (!this.state.enabled || this.state.locked || !this.root?.isConnected) return false;
    if (this.actor?.uuid !== actor?.uuid && this.actor !== actor) return false;
    const target = doc.elementFromPoint?.(x, y)?.closest?.('[data-hb-slot]');
    if (!target || !this.root.contains(target)) return false;
    const state = this.state;
    const next = assignHotbarSlot(state, actor.uuid || actor.id, state.activeTab,
      Number(target.dataset.hbSlot), item.id);
    if (!next) return false;
    void saveHotbarState(next).catch(error => notifyWarning(error?.message || 'Could not save shortcut.'));
    return true;
  }
  bind(root, state, actor) {
    root.querySelector('[data-hb-action="toggle"]')?.addEventListener('click', () => void this.toggle().catch(error => notifyWarning(error?.message || 'Hotbar toggle failed.')));
    root.querySelector('[data-hb-action="lock"]')?.addEventListener('click', () => void this.update({ locked: !this.state.locked }).catch(error => notifyWarning(error?.message || 'Hotbar lock failed.')));
    root.querySelector('[data-hb-action="config"]')?.addEventListener('click', () => openHotbarConfigDialog({
      state: this.state, onSave: saveHotbarAppearance, documentRef: this.doc
    }));
    root.querySelector('[data-hb-action="select"]')?.addEventListener('click', () => this.selectActor());
    root.querySelector('[data-hb-action="attributes"]')?.addEventListener('click', () => {
      this.attributesOpen = !this.attributesOpen;
      closeHotbarAttributeMenu();
      setHotbarAttributeDrawerState(root, this.attributesOpen);
    });
    bindHotbarAttributeTray(root, actor, this.doc);
    root.querySelectorAll('[data-hb-tab]').forEach(tab => tab.addEventListener('click', () => void this.changeTab(tab.dataset.hbTab).catch(error => notifyWarning(error?.message || 'Hotbar tab failed.'))));
    const actorId = actor?.uuid || actor?.id;
    const slots = hotbarSlots(state, actorId || '');
    for (const slot of root.querySelectorAll('[data-hb-slot]')) {
      const index = Number(slot.dataset.hbSlot);
      const itemId = slots[index];
      const item = itemId ? actor?.items?.get?.(itemId) : null;
      const activationKey = `${actorId || ''}:${itemId || ''}`;
      if (this.activatingItems.has(activationKey)) slot.classList.add('is-activating');
      slot.addEventListener('click', () => {
        if (Date.now() < this.suppressClickUntil || this.dragging || !item || this.activatingItems.has(activationKey)) return;
        this.activatingItems.add(activationKey);
        slot.classList.add('is-activating');
        void Promise.resolve().then(() => activateHotbarItem(actor, item))
          .catch(error => notifyWarning(error?.message || 'Item action failed.'))
          .finally(() => {
            this.activatingItems.delete(activationKey);
            this.root?.querySelectorAll?.('[data-hb-slot]')?.forEach(other => {
              if (hotbarSlots(this.state, actorId || '')[Number(other.dataset.hbSlot)] === itemId)
                other.classList.remove('is-activating');
            });
          });
      });
      slot.addEventListener('contextmenu', event => {
        event.preventDefault(); event.stopPropagation();
        if (!item && itemId && !state.locked) {
          const next = assignHotbarSlot(this.state, actorId, state.activeTab, index, null);
          if (next) void saveHotbarState(next).catch(error => notifyWarning(error?.message || 'Shortcut save failed.'));
          return;
        }
        if (!item) return;
        const remove = () => {
          const next = assignHotbarSlot(this.state, actorId, state.activeTab, index, null);
          if (next) void saveHotbarState(next).catch(error => notifyWarning(error?.message || 'Shortcut save failed.'));
        };
        openHotbarItemMenu(actor, item, event, root, remove, state.locked);
      });
      slot.draggable = Boolean(item && !state.locked);
      slot.addEventListener('dragstart', event => {
        if (!item || this.state.locked) { event.preventDefault(); return; }
        this.dragging = true;
        event.dataTransfer?.setData(SLOT_MIME, JSON.stringify({ actorId, tabId: state.activeTab, index, itemId }));
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
        slot.classList.add('is-dragging');
      });
      slot.addEventListener('dragend', () => {
        this.dragging = false; this.suppressClickUntil = Date.now() + 300; this.requestRender();
      });
      slot.addEventListener('dragover', event => {
        if (this.state.locked) return;
        if ([SLOT_MIME, 'application/x-buxa-item', 'text/plain'].some(type => event.dataTransfer?.types?.includes?.(type))) {
          event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
          slot.classList.add('is-drop-target');
        }
      });
      slot.addEventListener('dragleave', () => slot.classList.remove('is-drop-target'));
      slot.addEventListener('drop', event => {
        slot.classList.remove('is-drop-target');
        if (this.state.locked || !actor) return;
        const raw = event.dataTransfer?.getData(SLOT_MIME);
        let source = null, droppedId = '';
        if (raw) {
          try { source = JSON.parse(raw); droppedId = source.itemId; } catch { return; }
        } else {
          droppedId = event.dataTransfer?.getData('application/x-buxa-item') || '';
          if (!droppedId) {
            try {
              const payload = JSON.parse(event.dataTransfer?.getData('text/plain') || '{}');
              // Strictly actor-owned Item references; never import World Items.
              droppedId = payload.type === 'Item' && payload.uuid?.startsWith(`${actor.uuid}.Item.`)
                ? payload.uuid.split('.').at(-1) : '';
            } catch { /* unsupported native drag */ }
          }
        }
        if (!droppedId || !actor.items?.get?.(droppedId)) return;
        if (source && (source.actorId !== actorId || source.tabId !== state.activeTab)) {
          // Moving across tabs is supported; any cross-actor attempt is not.
          if (source.actorId !== actorId) return;
        }
        event.preventDefault(); event.stopPropagation();
        const next = assignHotbarSlot(this.state, actorId, state.activeTab, index, droppedId, source);
        if (next) void saveHotbarState(next).catch(error => notifyWarning(error?.message || 'Shortcut save failed.'));
      });
    }
  }
}

export function installBuxaHotbar() {
  if (controller) return controller;
  controller = new BuxaHotbar(); controller.install();
  const refresh = () => controller?.requestRender();
  for (const name of ['canvasReady', 'updateActor', 'createItem', 'updateItem', 'deleteItem', 'deleteActor']) Hooks.on(name, refresh);
  Hooks.on('canvasTearDown', () => { controller?.cancelSelection(); refresh(); });
  return controller;
}
