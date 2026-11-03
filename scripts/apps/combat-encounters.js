/** Custom GM combat page. Encounter staging is saved on native Combat documents;
 * starting uses Foundry Combatants, never a parallel turn-tracker. */
import { MODULE_ID, RESOURCE_LINKS } from '../core/constants.js';
import {notifyWarning, notifyError} from '../core/notifications.js';
import {archiveEncounterDeaths, isEncounterDeathAuthority, isCombatantDefeated} from '../core/combat-encounter-death.js';
import { getSheetConfig } from '../core/config.js';
import { getEffectiveResourceState } from '../core/resources.js';
import { getHotbarState } from './hotbar.js';
import { hotbarSlots } from '../core/hotbar-state.js';
import { buildHotbarAttributeTray, bindHotbarAttributeTray } from './hotbar-attributes.js';
import { activateHotbarItem } from './hotbar-item-actions.js';
import { toggleEncounterActorPicker } from './combat-encounter-picker.js';
import { createEncounterNpcTokens, createdEncounterTokenMap } from '../core/combat-npc-staging.js';
import {
  addEncounterActor,
  normalizeEncounterRoster,
  bindRosterTokens,
  encounterPlacements,
  initiativeAfterMove, initiativeReorderUpdates,
  actorIsNPC,
  normalizeEncounterDead,
  mergeEncounterDead
} from '../core/combat-encounter-model.js';

const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rosterOf = combat => normalizeEncounterRoster(combat?.getFlag?.(MODULE_ID, 'encounterRoster'));
const deadOf = combat => normalizeEncounterDead(combat?.getFlag?.(MODULE_ID, 'encounterDead'));
const currentScene = () => globalThis.canvas?.scene;
const encounterScene = combat => {
  const id = identifier(combat);
  return id ? globalThis.game?.scenes?.get?.(id) || null : currentScene();
};
const sceneTokens = (combat = null) => (combat ? encounterScene(combat) : currentScene())?.tokens?.contents || [];
const byId = id => globalThis.game?.actors?.get?.(id);
const identifier = combat => String(combat?.scene?.id || combat?.scene || '');
const icon = actor => actor?.img || 'icons/svg/mystery-man.svg';
const errorText = error => error?.message || 'Encounter operation failed.';
const warn = message => notifyWarning(message);
const combatList = () => [...(game.combats?.contents || [])];
const activeCombat = id => game.combats?.get?.(id) || null;
const activeTokenByCombatant = combatant => {
  const sceneId = combatant?.sceneId || combatant?.parent?.scene || combatant?.combat?.scene?.id || combatant?.combat?.scene;
  const tokenId = combatant?.tokenId || combatant?.token?.id;
  const scene = sceneId ? game.scenes?.get?.(sceneId) : currentScene();
  return scene?.tokens?.get?.(tokenId) || currentScene()?.tokens?.get?.(tokenId) || null;
};
const tokenFor = (entry, combat = null) => entry?.tokenId && (combat ? encounterScene(combat) : currentScene())?.tokens?.get?.(entry.tokenId);
const actorFor = (entry, combat = null) => tokenFor(entry, combat)?.actor || byId(entry?.actorId);
const currentActor = combatant => combatant?.token?.actor || activeTokenByCombatant(combatant)?.actor || combatant?.actor;
const isGM = () => game.user?.isGM === true;
function clientToWorld(clientX, clientY) { return canvas.canvasCoordinatesFromClient?.({x:clientX, y:clientY}) || null; }
function combatantSummary(actor) {
  if (!actor) return 'Missing actor';
  const hp = actor.system?.attributes?.hp;
  const level = actor.system?.details?.level;
  const cr = actor.system?.details?.cr;
  return [actorIsNPC(actor) ? 'NPC' : 'PLAYER', hp?.value != null ? `HP ${hp.value}/${hp.max ?? '?'}` : '', (level ?? cr) != null ? `${actorIsNPC(actor) ? 'CR' : 'Lv'} ${level ?? cr}` : ''].filter(Boolean).join(' · ');
}
function sidebarElement(element) {
  const root = element?.[0] || element;
  return root instanceof HTMLElement ? root : null;
}
function hpLinkedResource(actor) {
  try {
    const config = getSheetConfig();
    const resource = (config.resources || []).find(entry => entry?.link === RESOURCE_LINKS.HP) || null;
    return resource ? getEffectiveResourceState(actor, resource, config) : null;
  } catch {
    return null;
  }
}
function actorIsDead(actor) {
  if (!actor) return false;
  const linked = hpLinkedResource(actor);
  return isCombatantDefeated(actor?.system?.attributes?.hp?.value, linked?.current);
}

class EncounterController {
  constructor() {
    this.root = null;
    this.pane = null;
    this.combatId = '';
    this.expanded = '';
    this.expandedAllItems = '';
    this.deadExpanded = false;
    this.picker = null;
    this.placing = false;
    this.preview = null;
    this.pending = false;
    this.actionLocks = new Set();
    this.clickTimer = null;
    this.pendingSweeps = new Set();
    this.reorderDrag = null;
    this.saving = Promise.resolve();
    this.deadSaving = Promise.resolve();
    this.sweepQueue = Promise.resolve();
    this.queued = false;
  }
  mount(root) {
    if (!isGM() || !root || root.querySelector(':scope > .buxa-combat-pane') && this.root === root) return;
    this.root?.classList.remove('buxa-combat-integrated');
    this.reorderDrag = null;
    this.disposePickerPosition?.(); this.picker?.remove(); this.picker = null;
    this.root = root;
    this.combatId ||= game.combat?.id || '';
    this.pane = document.createElement('section');
    this.pane.className = 'buxa-combat-pane';
    this.pane.setAttribute('aria-label', 'Buxa encounter manager');
    root.append(this.pane);
    root.classList.add('buxa-combat-integrated');
    this.bind();
    this.paint();
  }
  bind() {
    const pane = this.pane;
    pane.addEventListener('click', event => {
      const button = event.target.closest('[data-enc-action]');
      if (button) {
        void this.action(button.dataset.encAction, button.dataset.id || '', button).catch(e => notifyError(errorText(e)));
        return;
      }
      const row = event.target.closest('[data-enc-row]');
      if (row) {
        if (this.clickTimer !== null) clearTimeout(this.clickTimer);
        const id = row.dataset.encRow;
        this.clickTimer = setTimeout(() => {
          this.clickTimer = null;
          if (!this.pane?.isConnected) return;
          this.expanded = this.expanded === id ? '' : id;
          this.paint();
        }, 230);
      }
    });
    pane.addEventListener('dblclick', event => {
      const row = event.target.closest('[data-enc-row]');
      if (!row) return;
      event.preventDefault();
      if (this.clickTimer !== null) clearTimeout(this.clickTimer);
      this.clickTimer = null;
      void this.action('sheet', row.dataset.encRow || '').catch(e => warn(errorText(e)));
    });
    pane.addEventListener('dragover', event => {
      if (event.target.closest('[data-enc-drop]')) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      }
      if (event.target.closest('[data-enc-reorder]')) event.preventDefault();
    });
    pane.addEventListener('drop', event => {
      const zone = event.target.closest('[data-enc-drop]');
      if (!zone) return;
      event.preventDefault();
      void this.receiveDrop(event).catch(error => warn(errorText(error)));
    });
    pane.addEventListener('dragstart', event => {
      const row = event.target.closest('[data-enc-reorder]');
      const combat = this.selected();
      if (!isGM() || !combat?.started || !row || !event.dataTransfer) return;
      const id = row.dataset.encReorder;
      if (!combat.combatants?.get?.(id)) return;
      this.reorderDrag = { id, combatId: combat.id };
      event.dataTransfer.setData('application/x-buxa-combat-reorder', id);
      event.dataTransfer.effectAllowed = 'move';
    });
    pane.addEventListener('dragend', () => { this.reorderDrag = null; });
    pane.addEventListener('drop', event => {
      const target = event.target.closest('[data-enc-reorder]');
      if (!target) return;
      const id = event.dataTransfer?.getData('application/x-buxa-combat-reorder');
      const drag = this.reorderDrag;
      this.reorderDrag = null;
      if (!id || drag?.id !== id || drag.combatId !== this.selected()?.id || !isGM()) return;
      const combat = this.selected();
      if (!combat?.started || !combat.combatants?.get?.(id) || !combat.combatants?.get?.(target.dataset.encReorder)) return;
      event.preventDefault(); event.stopPropagation();
      void this.reorder(id, target.dataset.encReorder).catch(error => warn(errorText(error)));
    }, true);
  }
  selected() { return activeCombat(this.combatId); }
  async select(combat) {
    this.reorderDrag = null;
    this.combatId = combat?.id || '';
    this.expanded = '';
    this.deadExpanded = false;
    this.disposePickerPosition?.(); this.picker?.remove(); this.picker = null;
    this.endPlacement();
    if (combat && !combat.active && isGM()) await combat.update({active:true});
    this.paint();
  }
  async saveRoster(combat, update) {
    if (!combat || !isGM()) return;
    this.saving = this.saving.catch(()=>{}).then(async () => {
      const current = rosterOf(combat);
      const changed = normalizeEncounterRoster(typeof update === 'function' ? update(current) : update);
      await combat.setFlag(MODULE_ID, 'encounterRoster', changed);
    });
    await this.saving;
    this.paint();
  }
  async saveDeadRoster(combat, update) {
    if (!combat || !isGM()) return;
    this.deadSaving = this.deadSaving.catch(()=>{}).then(async () => {
      const current = deadOf(combat);
      const changed = normalizeEncounterDead(typeof update === 'function' ? update(current) : update);
      await combat.setFlag(MODULE_ID, 'encounterDead', changed);
    });
    await this.deadSaving;
    this.paint();
  }
  paint() {
    if (!this.pane?.isConnected) return;
    const combat = this.selected();
    const combats = combatList();
    if (combat && !combats.some(entry => entry.id === combat.id)) { this.combatId = ''; return this.paint(); }
    const previousScroll = this.pane.querySelector('.buxa-enc-entries')?.scrollTop || 0;
    this.pane.innerHTML = `<div class="buxa-enc-shell">
      <div class="buxa-enc-head"><strong>COMBATS</strong><button data-enc-action="create" title="Create encounter" aria-label="Create encounter">＋</button></div>
      <div class="buxa-enc-list">${combats.map(entry => `<div class="buxa-enc-tab ${entry.id===combat?.id?'is-current':''}"><button data-enc-action="open" data-id="${esc(entry.id)}" class="buxa-enc-tab-main ${entry.id===combat?.id?'is-current':''}"><span>${esc(entry.name || 'Combat')}</span><small>${entry.started?'IN PROGRESS':'PREPARING'}</small></button><button class="buxa-enc-tab-delete" data-enc-action="delete-combat" data-id="${esc(entry.id)}" title="Delete combat" aria-label="Delete combat">×</button></div>`).join('')}</div>
      ${combat ? this.combatMarkup(combat) : '<p class="buxa-enc-empty">Create or open a combat.</p>'}
    </div>`;
    if (combat && this.expanded) this.hydrateExpanded(combat);
    const scroll = this.pane.querySelector('.buxa-enc-entries');
    if (scroll) scroll.scrollTop = previousScroll;
  }
  combatMarkup(combat) {
    const roster = rosterOf(combat);
    const tokens = sceneTokens(combat);
    const resolved = bindRosterTokens(roster, tokens);
    const missing = resolved.filter(entry => entry.npc && !entry.tokenId);
    const entries = combat.started ? [...(combat.turns || combat.combatants || [])] : resolved;
    const dead = deadOf(combat);
    const renderRow = entry => {
      const active = combat.started;
      const actor = active ? currentActor(entry) : actorFor(entry, combat);
      const id = active ? entry.id : entry.id;
      const missingToken = !active && entry.npc && !tokenFor(entry, combat) && !resolved.find(candidate => candidate.id === id)?.tokenId;
      const selected = this.expanded === id;
      return `<article class="buxa-enc-combatant ${missingToken?'is-unplaced':''} ${selected?'is-selected':''}" ${active?`draggable="true" data-enc-reorder="${esc(id)}"`:''}>
        <div class="buxa-enc-card">
          <button class="buxa-enc-row" data-enc-row="${esc(id)}" title="Click to expand. Double-click to open sheet.">
            <img src="${esc(icon(actor))}" alt="">
            <span class="buxa-enc-row-copy"><b>${esc(actor?.name || 'Missing Actor')}</b><small>${esc(combatantSummary(actor))}${missingToken?' · NOT PLACED':''}</small></span>
            ${active?`<strong class="buxa-enc-ini">${entry.initiative ?? '–'}</strong>`:''}
          </button>
          ${!active?`<button class="buxa-enc-remove" data-enc-action="remove" data-id="${esc(id)}" title="Remove from combat" aria-label="Remove from combat">×</button>`:''}
        </div>
        ${selected?`<div class="buxa-enc-inline-detail" data-enc-detail-id="${esc(id)}">
            <div class="buxa-enc-inline-top"><span class="buxa-enc-inline-title">${esc(actor?.name || 'Missing Actor')}</span><small>double-click actor to open sheet</small></div>
            <div class="buxa-enc-inline-attributes" data-enc-attr-host="${esc(id)}"></div>
            <div class="buxa-enc-resource-list" data-enc-resource-host="${esc(id)}"></div>
            <div class="buxa-enc-shortcuts" data-enc-item-host="${esc(id)}"></div>
          </div>`:''}
      </article>`;
    };
    return `<div class="buxa-enc-active">
      <div class="buxa-enc-combat-title"><b>${esc(combat.name || 'Combat')}</b><small>${combat.started?`ROUND ${combat.round||1} · TURN ${(combat.turn??0)+1}`:'SETUP'}</small></div>
      <div class="buxa-enc-actions">${combat.started
        ? `<button data-enc-action="npcr">ROLL NPC INIT</button><button data-enc-action="prev">◀ PREV</button><button data-enc-action="next">NEXT ▶</button>`
        : `<button data-enc-action="picker">SELECT ACTOR</button>${missing.length?`<button data-enc-action="place">PLACE NPCs (${missing.length})</button>`:''}<button data-enc-action="start" ${missing.length||!resolved.length?'disabled':''}>START COMBAT</button>`}
      </div>
      <div class="buxa-enc-entries" data-enc-drop="actors">${entries.map(renderRow).join('') || '<p class="buxa-enc-empty">Drag Actors here, or use Select Actor.</p>'}</div>
      ${combat.started || dead.length ? this.deadDrawerMarkup(dead, combat) : ''}
      ${combat.started ? '<div class="buxa-enc-footer"><button data-enc-action="end">END COMBAT</button></div>' : ''}
    </div>`;
  }
  deadDrawerMarkup(dead, combat) {
    const body = dead.map(entry => {
      const actor = encounterScene(combat)?.tokens?.get?.(entry.tokenId)?.actor || byId(entry.actorId);
      const summary = actor ? combatantSummary(actor) : entry.summary || 'Defeated';
      return `<div class="buxa-enc-dead-row">
        <img src="${esc(entry.img || 'icons/svg/mystery-man.svg')}" alt="">
        <span><b>${esc(entry.name || 'Missing Actor')}</b><small>${esc(summary)}</small></span>
        <button data-enc-action="revive" data-id="${esc(entry.id)}" title="Return to combat after restoring HP">↩</button>
      </div>`;
    }).join('') || '<p class="buxa-enc-empty buxa-enc-empty-dead">No defeated actors yet.</p>';
    return `<section class="buxa-enc-dead ${this.deadExpanded?'is-open':''}">
      <button class="buxa-enc-dead-toggle" data-enc-action="toggle-dead" aria-expanded="${this.deadExpanded?'true':'false'}">
        <span class="buxa-enc-dead-arrow">▴</span><strong>DEAD</strong><small>${dead.length}</small>
      </button>
      <div class="buxa-enc-dead-body">${body}</div>
    </section>`;
  }
  hydrateExpanded(combat) {
    const entry = combat.started ? combat.combatants?.get?.(this.expanded) : rosterOf(combat).find(candidate => candidate.id === this.expanded);
    const actor = combat.started ? currentActor(entry) : actorFor(entry, combat);
    if (!entry || !actor) return;
    const detail = this.pane.querySelector(`[data-enc-detail-id="${CSS.escape(this.expanded)}"]`);
    if (!detail) return;
    const attrHost = detail.querySelector(`[data-enc-attr-host="${CSS.escape(this.expanded)}"]`);
    if (attrHost) {
      const tray = buildHotbarAttributeTray(document, actor);
      tray.classList.add('is-open');
      tray.style.position = 'relative';
      tray.style.pointerEvents = 'auto';
      attrHost.append(tray);
      bindHotbarAttributeTray(tray, actor);
    }
    const resourceHost = detail.querySelector(`[data-enc-resource-host="${CSS.escape(this.expanded)}"]`);
    if (resourceHost) {
      try {
        const config = getSheetConfig();
        for (const resource of config.resources || []) {
          const amount = getEffectiveResourceState(actor, resource, config);
          const badge = document.createElement('span');
          badge.textContent = `${resource.label}: ${amount.current}/${amount.max}`;
          if (/^#[0-9a-f]{6}$/i.test(resource.color)) badge.style.setProperty('--enc-resource', resource.color);
          resourceHost.append(badge);
        }
      } catch {
        /* Missing custom actor state should not block GM tools. */
      }
    }
    const itemHost = detail.querySelector(`[data-enc-item-host="${CSS.escape(this.expanded)}"]`);
    if (itemHost) {
      const state = getHotbarState();
      const ids = hotbarSlots(state, actor.uuid || actor.id).filter(Boolean);
      const allItems = [...(actor.items || [])];
      const expanded = this.expandedAllItems === this.expanded;
      const items = expanded ? allItems : (ids.length
        ? [...new Set(ids)].map(id => actor.items?.get?.(id)).filter(Boolean)
        : allItems.slice(0, 20));
      if (allItems.length > items.length || expanded) {
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'buxa-enc-item buxa-enc-all-items';
        toggle.textContent = expanded ? 'SHOW SHORTCUTS' : `ALL ITEMS (${allItems.length})`;
        toggle.addEventListener('click', () => {
          this.expandedAllItems = expanded ? '' : this.expanded;
          this.paint();
        });
        itemHost.append(toggle);
      }
      for (const item of items) {
        const button = document.createElement('button');
        button.className = 'buxa-enc-item';
        button.title = item.name;
        const art = document.createElement('img');
        art.src = item.img || 'icons/svg/item-bag.svg';
        art.alt = '';
        const label = document.createElement('span');
        label.textContent = item.name || 'Item';
        button.append(art, label);
        button.addEventListener('click', () => {
          if (button.disabled) return;
          button.disabled = true;
          void Promise.resolve().then(() => activateHotbarItem(actor, item))
            .catch(error => warn(errorText(error)))
            .finally(() => { if (button.isConnected) button.disabled = false; });
        });
        itemHost.append(button);
      }
    }
  }
  async receiveDrop(event) {
    const combat = this.selected();
    if (!combat || combat.started || !isGM()) return;
    const dt = event.dataTransfer; let parsed;
    try { parsed = JSON.parse(dt.getData('text/plain') || dt.getData('application/json') || 'null'); }
    catch { parsed = null; }
    const id = dt.getData('application/x-buxa-encounter-actor') || parsed?.actorId || (parsed?.type === 'Actor' ? String(parsed.uuid || '').split('.').at(-1) : '');
    await this.addActor(id);
  }
  async addActor(actorId) {
    const combat = this.selected();
    if (!combat || combat.started || !isGM()) return;
    const actor = byId(actorId); if (!actor) return warn('Drag an Actor from the world directory.');
    await this.saveRoster(combat, current => addEncounterActor(current, actor));
  }
  async action(action, id) {
    if (!isGM()) return;
    const locked = ['create','start','delete-combat','end','place'].includes(action);
    const lockKey = `${action}:${id || this.combatId}`;
    if (locked && this.actionLocks.has(lockKey)) return;
    if (locked) this.actionLocks.add(lockKey);
    try {
    const combat = this.selected();
    if (action === 'create') {
      if (!currentScene()) return warn('Open a Scene before creating a combat.');
      const created = await Combat.create({name:`Combat ${game.combats.size+1}`, scene:currentScene().id, active:true});
      if (created) {
        await created.setFlag(MODULE_ID, 'encounterDead', []);
        await this.select(created);
      }
    } else if (action === 'open') await this.select(activeCombat(id));
    else if (action === 'delete-combat') {
      const target = activeCombat(id);
      if (!target) return;
      const confirm = globalThis.foundry?.applications?.api?.DialogV2?.confirm;
      if (typeof confirm !== 'function') return warn('Delete confirmation is unavailable.');
      const scene = game.scenes?.get?.(identifier(target));
      const cleanupEntries = !target.started ? new Set(rosterOf(target).filter(entry => entry.npc).map(entry => entry.id)) : new Set();
      const placedTokens = !target.started && scene
        ? [...(scene.tokens?.contents || [])].filter(token => cleanupEntries.has(token.flags?.[MODULE_ID]?.encounterEntryId))
        : [];
      const accepted = await confirm({window: {title:'Delete encounter'},
        content:`<p>Delete <strong>${esc(target.name)}</strong> permanently? This cannot be undone.</p>${placedTokens.length?`<p>${placedTokens.length} NPC token(s) spawned during setup will also be removed from the scene.</p>`:''}`,
        yes:{label:'Delete encounter'},no:{label:'Cancel'},modal:true});
      if (!accepted) return;
      const wasCurrent = this.combatId === target.id;
      if (target.started) await target.endCombat();
      await target.delete();
      if (placedTokens.length) {
        try { await scene.deleteEmbeddedDocuments('Token', placedTokens.map(token => token.id)); }
        catch (error) { notifyError(`Encounter was deleted, but NPC token cleanup failed: ${errorText(error)}`); }
      }
      if (wasCurrent) {
        const next = combatList().find(entry => entry.id !== id) || null;
        this.combatId = next?.id || '';
        this.expanded = '';
        this.deadExpanded = false;
      }
    }
    else if (!combat) return;
    else if (action === 'picker') this.openPicker();
    else if (action === 'remove' && !combat.started) await this.saveRoster(combat, current => current.filter(entry => entry.id !== id));
    else if (action === 'sheet') {
      const entry = combat.started ? combat.combatants.get(id) : rosterOf(combat).find(candidate => candidate.id === id);
      const actor = combat.started ? currentActor(entry) : actorFor(entry, combat);
      actor?.sheet?.render?.({force:true});
    } else if (action === 'place') this.beginPlacement();
    else if (action === 'start') await this.start(combat);
    else if (action === 'toggle-dead') this.deadExpanded = !this.deadExpanded;
    else if (action === 'revive') {
      if (!combat.started) return warn('Start combat again before returning an actor.');
      const entry = deadOf(combat).find(row => row.id === id);
      if (!entry) return;
      const actor = encounterScene(combat)?.tokens?.get?.(entry.tokenId)?.actor || byId(entry.actorId);
      if (!actor) return warn('The archived Actor no longer exists.');
      if (actorIsDead(actor)) return warn('Restore HP above zero before returning this actor.');
      const tokenId = encounterScene(combat)?.tokens?.get?.(entry.tokenId) ? entry.tokenId : null;
      const present = [...(combat.combatants || [])].some(member =>
        member.actorId === entry.actorId && (member.tokenId || null) === tokenId);
      if (!present) await combat.createEmbeddedDocuments('Combatant', [{actorId:entry.actorId,
        tokenId, sceneId:identifier(combat)}]);
      await this.saveDeadRoster(combat, current => current.filter(row => row.id !== id));
    }
    else if (action === 'npcr' && combat.started) {
      const ids = [...combat.combatants].filter(entry => actorIsNPC(currentActor(entry))).map(entry => entry.id);
      if (ids.length) await combat.rollInitiative(ids);
    } else if (action === 'next' && combat.started) await combat.nextTurn();
    else if (action === 'prev' && combat.started) await combat.previousTurn();
    else if (action === 'end' && combat.started) await combat.endCombat();
    this.paint();
    } finally {
      if (locked) this.actionLocks.delete(lockKey);
    }
  }
  async reorder(source, target) {
    const combat = this.selected();
    if (!isGM() || !combat?.started || !source || !target || source === target
      || !combat.combatants?.get?.(source) || !combat.combatants?.get?.(target)) return;
    const turns = [...combat.turns];
    const initiative = initiativeAfterMove(turns, source, target);
    if (initiative != null) await combat.combatants.get(source)?.update({initiative});
    else {
      const updates = initiativeReorderUpdates(turns, source, target);
      if (updates.length) await combat.updateEmbeddedDocuments('Combatant', updates);
    }
    this.paint();
  }
  async start(combat) {
    if (combat.started || identifier(combat) !== currentScene()?.id) return warn('Open this combat’s Scene before starting.');
    const roster = bindRosterTokens(rosterOf(combat), sceneTokens());
    if (!roster.length) return warn('Add an Actor first.');
    if (roster.some(entry => entry.npc && !entry.tokenId)) return warn('Place every NPC on this Scene before starting.');
    if (roster.some(entry => !byId(entry.actorId))) return warn('An Actor is missing from the encounter.');
    const existing = [...(combat.combatants || [])];
    const combatants = roster.filter(entry => !existing.some(candidate => candidate.actorId === entry.actorId &&
      (!entry.npc || (candidate.tokenId || '') === (entry.tokenId || ''))))
      .map(entry => ({
        actorId:entry.actorId,
        tokenId:entry.tokenId || null,
        sceneId:currentScene().id,
        hidden: Boolean(entry.npc && currentScene().tokens?.get?.(entry.tokenId)?.hidden)
      }));
    // A restarted combat keeps its previous death archive.
    if (combatants.length) await combat.createEmbeddedDocuments('Combatant', combatants);
    await combat.startCombat();
    await this.sweepCombatDeaths(combat);
  }
  beginPlacement() {
    const combat = this.selected();
    if (!isGM() || !combat || combat.started || identifier(combat) !== currentScene()?.id) return warn('Open this combat’s Scene first.');
    const missing = bindRosterTokens(rosterOf(combat), sceneTokens()).filter(entry => entry.npc && !entry.tokenId);
    if (!missing.length) return;
    this.endPlacement(); this.placing = true;
    this.preview = document.createElement('div');
    this.preview.className = 'buxa-enc-place-ghost';
    this.preview.setAttribute('aria-hidden', 'true');
    document.body.append(this.preview);
    this.missing = missing;
    // Reuse sprites while the cursor moves, instead of recreating all images
    // on every pointermove and forcing the browser to decode/reflow repeatedly.
    const ghosts=missing.map(entry=>{
      const image=document.createElement('img');
      image.src=icon(byId(entry.actorId)); image.alt='';
      this.preview.append(image);
      return image;
    });
    const footprints=missing.map(entry=>byId(entry.actorId)?.prototypeToken);
    this.movePlacement = event => {
      const board = document.querySelector('#board');
      if (!board?.contains(event.target)) { this.preview.hidden=true; return; }
      const world = clientToWorld(event.clientX, event.clientY); if (!world) return;
      this.anchor = world;
      this.preview.hidden=false;
      const positions = encounterPlacements(missing.length, world, canvas.dimensions?.size, sceneTokens().map(token => ({x:token.x,y:token.y,width:token.width,height:token.height})), {
        footprints,
        maxWidth: canvas.dimensions?.width,
        maxHeight: canvas.dimensions?.height
      });
      ghosts.forEach((tile,index)=>{tile.hidden=index>=positions.length;});
      positions.forEach((pos, index) => {
        const client = canvas.clientCoordinatesFromCanvas(pos);
        if (!client) return;
        const tile = ghosts[index];
        tile.style.left = `${client.x}px`; tile.style.top = `${client.y}px`;
        const actor = byId(missing[index].actorId);
        const width = (canvas.dimensions?.size || 100) * Math.max(1, Number(actor?.prototypeToken?.width) || 1);
        const height = (canvas.dimensions?.size || 100) * Math.max(1, Number(actor?.prototypeToken?.height) || 1);
        const far = canvas.clientCoordinatesFromCanvas({x:pos.x+width, y:pos.y+height});
        tile.style.width = `${Math.max(24, (far?.x || client.x+48) - client.x)}px`;
        tile.style.height = `${Math.max(24, (far?.y || client.y+48) - client.y)}px`;
      });
    };
    this.clickPlacement = event => {
      if (event.button !== 0 || !document.querySelector('#board')?.contains(event.target)) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (this.planeBusy) return;
      this.planeBusy = true;
      void this.commitPlacement(this.anchor)
        .catch(error => warn(errorText(error)))
        .finally(() => { this.planeBusy = false; this.endPlacement(); this.paint(); });
    };
    this.upPlacement = event => {
      if (this.planeBusy && event.button===0) {event.preventDefault();event.stopImmediatePropagation();}
    };
    this.keyPlacement = event => { if (event.key === 'Escape') this.endPlacement(); };
    document.addEventListener('pointermove', this.movePlacement, true);
    document.addEventListener('pointerdown', this.clickPlacement, true);
    document.addEventListener('pointerup', this.upPlacement, true);
    document.addEventListener('keydown', this.keyPlacement, true);
  }
  async commitPlacement(anchor) {
    const combat = this.selected(), scene = currentScene();
    if (!anchor || !scene || !combat || !isGM() || combat.started) return;
    const live = bindRosterTokens(rosterOf(combat), sceneTokens());
    const missing = live.filter(entry => entry.npc && !entry.tokenId);
    const positions = encounterPlacements(missing.length, anchor, canvas.dimensions?.size, sceneTokens().map(token => ({x:token.x,y:token.y,width:token.width,height:token.height})), {
      footprints: missing.map(entry => byId(entry.actorId)?.prototypeToken),
      maxWidth: canvas.dimensions?.width,
      maxHeight: canvas.dimensions?.height
    });
    if (positions.length !== missing.length) throw Error('Not enough free places to spawn the NPCs.');
    const drafts = [];
    for (let index = 0; index < missing.length; index++) {
      const actor = byId(missing[index].actorId);
      if (!actor) throw Error('An NPC was deleted.');
      const doc = await actor.getTokenDocument({...positions[index], hidden:true, actorLink:false});
      const data = doc.toObject(); delete data._id;
      data.hidden = true; data.actorLink = false; data.actorId = actor.id;
      data.flags ||= {};
      data.flags[MODULE_ID] = {...(data.flags[MODULE_ID] || {}), encounterEntryId:missing[index].id};
      drafts.push(data);
    }
    await createEncounterNpcTokens(scene, drafts, {
      commit: async created => {
        const ids = createdEncounterTokenMap(created);
        await this.saveRoster(combat, current => current.map(entry => ids.has(entry.id)
          ? {...entry,tokenId:ids.get(entry.id)} : entry));
      },
      isCommitted: async tokens => {
        const mapped = new Map(tokens.map(token=>[
          token.flags?.[MODULE_ID]?.encounterEntryId ?? token.getFlag?.(MODULE_ID,'encounterEntryId'),token.id]));
        return missing.every(entry=>rosterOf(combat).some(row=>
          row.id===entry.id && row.tokenId===mapped.get(entry.id)));
      },
      clearFailedRoster: async ids => {
        const removed = new Set(ids);
        if (!rosterOf(combat).some(row=>removed.has(row.tokenId))) return;
        await this.saveRoster(combat, current => current.map(row =>
          removed.has(row.tokenId) ? {...row,tokenId:''} : row));
      }
    });
  }
  endPlacement() {
    if (this.movePlacement) document.removeEventListener('pointermove', this.movePlacement, true);
    if (this.clickPlacement) document.removeEventListener('pointerdown', this.clickPlacement, true);
    if (this.upPlacement) document.removeEventListener('pointerup', this.upPlacement, true);
    if (this.keyPlacement) document.removeEventListener('keydown', this.keyPlacement, true);
    this.preview?.remove();
    this.preview = null; this.placing = false; this.movePlacement = null; this.clickPlacement = null; this.upPlacement = null; this.keyPlacement = null;
  }
  openPicker() { toggleEncounterActorPicker(this, { icon, combatantSummary }); }
  async sweepCombatDeaths(combat) {
    const liveCombat = activeCombat(combat?.id || combat);
    if (!isEncounterDeathAuthority() || !liveCombat?.started) return;
    const victims = [...(liveCombat.combatants || [])].filter(combatant => actorIsDead(currentActor(combatant)));
    if (!victims.length) return;
    const removed = await archiveEncounterDeaths(liveCombat, victims, {actorFor: currentActor});
    if (removed.includes(this.expanded)) this.expanded = '';
    if (removed.length) this.deadExpanded = true;
    this.requestPaint();
  }
  queueDeathSweep(combat = null, actorId = '', tokenId = '') {
    if (!isEncounterDeathAuthority()) return;
    const targets = combat ? [activeCombat(combat?.id || combat)].filter(Boolean) : combatList().filter(entry => entry?.started);
    for (const entry of targets) {
      if (actorId || tokenId) {
        if (![...(entry.combatants || [])].some(member =>
          (actorId && member.actorId === actorId) || (tokenId && member.tokenId === tokenId))) continue;
      }
      this.pendingSweeps.add(entry.id);
    }
    if (this.sweepScheduled) return;
    this.sweepScheduled = true;
    queueMicrotask(() => {
      this.sweepScheduled = false;
      const ids = [...this.pendingSweeps];
      this.pendingSweeps.clear();
      this.sweepQueue = this.sweepQueue.catch(() => {}).then(async () => {
        for (const id of ids) {
          const live = activeCombat(id);
          if (live) await this.sweepCombatDeaths(live);
        }
      }).catch(error => console.error(`${MODULE_ID} | Encounter death sweep failed`, error));
    });
  }
  requestPaint() {
    if (this.queued) return;
    this.queued = true;
    requestAnimationFrame(() => {
      this.queued = false;
      this.paint();
    });
  }
}
const controller = new EncounterController();
export function installBuxaCombatEncounters() {
  const attach = (app, element) => {
    if (!isGM()) return;
    const root = sidebarElement(element || app?.element);
    if (!root) return;
    controller.mount(root);
  };
  Hooks.on('renderCombatTracker', attach);
  Hooks.on('renderCombatTrackerV2', attach);
  Hooks.on('renderSidebar', () => { const el = globalThis.ui?.combat?.element; if (el) attach(ui.combat, el); });
  for (const hook of ['createCombat','updateCombat','deleteCombat','createCombatant','updateCombatant','deleteCombatant','createToken','deleteToken','updateToken','canvasReady'])
    Hooks.on(hook, () => controller.requestPaint());
  Hooks.on('updateActor', actor => {
    if (!isGM() || !actor) return;
    controller.queueDeathSweep(null, actor.id);
    controller.requestPaint();
  });
  Hooks.on('updateToken', (token) => {
    if (!isGM() || !token) return;
    controller.queueDeathSweep();
    controller.requestPaint();
  });
  Hooks.on('createCombatant', combatant => controller.queueDeathSweep(combatant?.combat));
  Hooks.on('createToken', () => controller.queueDeathSweep());
  Hooks.on('updateCombat', combat => controller.queueDeathSweep(combat));
  Hooks.on('updateCombatant', combatant => controller.queueDeathSweep(combatant?.combat));
  Hooks.on('canvasTearDown', () => controller.endPlacement());
  try { const app = globalThis.ui?.combat; if (app?.element) attach(app, app.element); } catch { /* sidebar may not be ready */ }
}
