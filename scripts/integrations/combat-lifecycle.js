/** Invisible, read-only combat lifecycle observer for future Buxa features.
 * Uses actual Combat document state (not button clicks, sidebar or DOM).
 * The primary GM persists a bounded per-combat history in a single flag.
 * Clients only observe and publish local events; no gameplay writes are made.
 */
import { MODULE_ID } from '../core/constants.js';
import { captureCombatLifecycle, diffCombatLifecycle } from '../core/combat-lifecycle-model.js';

export const COMBAT_LIFECYCLE_HOOK = 'buxaCombatLifecycle';
export const COMBAT_LIFECYCLE_HISTORY_LIMIT = 192;
const FLAG = 'lifecycleHistory';
const states = new Map();
const removedIds = [];
const MAX_DELETED_HISTORY = 32;
const subscriptions = new Map();
let installed = false;
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

function combatList() {
  const collection = globalThis.game?.combats;
  if (!collection) return [];
  if (Array.isArray(collection.contents)) return collection.contents;
  if (Array.isArray(collection)) return collection;
  return typeof collection[Symbol.iterator] === 'function' ? [...collection] : [];
}
function getCombat(id) { return combatList().find(c => c?.id === id) || globalThis.game?.combats?.get?.(id) || null; }
function primaryGM() {
  const game = globalThis.game;
  if (!game?.user?.isGM) return false;
  const elected = game.users?.activeGM;
  if (elected?.isGM && elected.active !== false) return elected.id === game.user.id;
  const members = game.users?.contents || (typeof game.users?.[Symbol.iterator] === 'function' ? [...game.users] : []);
  const gms = members.filter(user => user?.isGM && user.active !== false)
    .sort((a,b) => String(a.id).localeCompare(String(b.id)));
  return !gms.length || gms[0].id === game.user.id;
}
function historyFlag(combat) {
  try {
    const saved = combat?.getFlag?.(MODULE_ID, FLAG);
    if (!saved || saved.version !== 1 || !Array.isArray(saved.events)) return {events:[],sequence:0};
    // Treat document flags as untrusted saved data. Never replay them as hooks.
    const valid = saved.events.filter(event => event && typeof event.type === 'string' &&
      event.combatId === combat.id && Number.isSafeInteger(event.sequence) && event.sequence > 0);
    return {events:clone(valid.slice(-COMBAT_LIFECYCLE_HISTORY_LIMIT)),
      sequence:Math.max(Number.isSafeInteger(saved.sequence) ? saved.sequence : 0,
        ...valid.map(event=>event.sequence),0)};
  } catch { return {events:[],sequence:0}; }
}
function ensure(combat) {
  if (!combat?.id) return null;
  const id = String(combat.id);
  let state = states.get(id);
  if (state) return state;
  const saved = historyFlag(combat);
  state = {snapshot:captureCombatLifecycle(combat),events:saved.events,
    sequence:saved.sequence,revision:0,persisting:null,removed:false,dispatching:false,dispatchQueue:[]};
  states.set(id,state);
  return state;
}
function publish(event) {
  // Listeners cannot alter tracked records or break later listeners.
  const deliver = handler => {
    try { handler(clone(event)); }
    catch(error) { console.error(`${MODULE_ID} | Combat lifecycle subscriber failed`, error); }
  };
  for (const callback of subscriptions.get(event.type) || []) deliver(callback);
  for (const callback of subscriptions.get('*') || []) deliver(callback);
  try { globalThis.Hooks?.callAll?.(COMBAT_LIFECYCLE_HOOK, clone(event)); }
  catch(error) { console.error(`${MODULE_ID} | Combat lifecycle hook failed`, error); }
}
/** Listeners can update Combat synchronously. Buffer reentrant observations so
 * callbacks never see phase events interleaved out of chronological order. */
function dispatch(state,events) {
  state.dispatchQueue.push(...events);
  if (state.dispatching) return;
  state.dispatching = true;
  try {
    while (state.dispatchQueue.length) publish(state.dispatchQueue.shift());
  } finally {
    state.dispatching = false;
  }
}
function queuePersistence(combat,state) {
  if (!primaryGM() || !combat?.setFlag || state.removed) return;
  ++state.revision;
  if (state.persisting) return;
  const run = async () => {
    while (!state.removed && primaryGM()) {
      const revision = state.revision;
      const data = {version:1,sequence:state.sequence,events:clone(state.events)};
      try { await combat.setFlag(MODULE_ID,FLAG,data); }
      catch(error) {
        console.warn(`${MODULE_ID} | Combat lifecycle history could not be saved`,error);
        return;
      }
      if (revision === state.revision) return;
    }
  };
  state.persisting = run().finally(() => { state.persisting = null; });
}
function observe(combat,options={}) {
  if (!combat?.id) return;
  const id = String(combat.id);
  const state = states.get(id);
  // Existing combat seen for first time is a baseline, not a fabricated start.
  if (!state && !options.created) { ensure(combat); return; }
  const previous = state?.snapshot || null;
  const next = captureCombatLifecycle(combat);
  if (!next) return;
  if (!state) {
    const newState = ensure(combat);
    // This was genuinely created during this session, not discovered on ready.
    newState.snapshot = null;
  }
  const current = states.get(id);
  if (current.removed) return;
  const changes = diffCombatLifecycle(previous,next,options);
  current.snapshot = next;
  if (!changes.length) return;
  const now = Date.now();
  const published = [];
  for (const change of changes) {
    const event = { ...change, combatId:id, sceneId:next.sceneId,
      timestamp:now,sequence:++current.sequence,
      round:change.round ?? next.round,turn:change.turn ?? next.turn,
      combatantId:change.combatantId ?? next.currentCombatantId };
    current.events.push(event);
    if (current.events.length > COMBAT_LIFECYCLE_HISTORY_LIMIT)
      current.events.splice(0,current.events.length-COMBAT_LIFECYCLE_HISTORY_LIMIT);
    published.push(event);
  }
  dispatch(current,published);
  queuePersistence(combat,current);
}
function observeDeleted(combat) {
  if (!combat?.id) return;
  const state = ensure(combat);
  if (state.removed) return;
  // When a combat has been deleted after another hook already ended it, do
  // not emit duplicate combat/turn endings.
  const previous = state.snapshot;
  const events = diffCombatLifecycle(previous,null,{deleted:true});
  state.removed = true;
  const published = [];
  for (const change of events) {
    const event = {...change,combatId:String(combat.id),sceneId:previous?.sceneId || '',
      timestamp:Date.now(),sequence:++state.sequence,
      round:change.round ?? previous?.round ?? 0,turn:change.turn ?? previous?.turn ?? null,
      combatantId:change.combatantId ?? previous?.currentCombatantId ?? ''};
    state.events.push(event);
    if (state.events.length > COMBAT_LIFECYCLE_HISTORY_LIMIT) state.events.shift();
    published.push(event);
  }
  state.snapshot = null;
  removedIds.push(String(combat.id));
  if (removedIds.length > MAX_DELETED_HISTORY) states.delete(removedIds.shift());
  dispatch(state,published);
}

/** Read-only snapshot and event access; no UI and no direct document writes. */
export function getCombatLifecycleSnapshot(combatId) {
  const id = String(combatId || globalThis.game?.combat?.id || '');
  const state = states.get(id) || ensure(getCombat(id));
  return clone(state?.snapshot || null);
}
export function getCombatLifecycleHistory(combatId, {type,limit=COMBAT_LIFECYCLE_HISTORY_LIMIT} = {}) {
  const id = String(combatId || globalThis.game?.combat?.id || '');
  const state = states.get(id) || ensure(getCombat(id));
  const size = Number.isSafeInteger(limit) ? Math.max(0,Math.min(limit,COMBAT_LIFECYCLE_HISTORY_LIMIT)) : COMBAT_LIFECYCLE_HISTORY_LIMIT;
  const history = type ? state?.events.filter(event=>event.type===type) : state?.events;
  return clone(size === 0 ? [] : (history || []).slice(-size));
}
/** Event types are documented in docs/COMBAT_LIFECYCLE.md. '*' observes all. */
export function onCombatLifecycle(type,callback) {
  if (typeof type !== 'string' || !type || typeof callback !== 'function') throw new TypeError('Expected a lifecycle event name and callback.');
  const callbacks = subscriptions.get(type) || new Set();
  callbacks.add(callback); subscriptions.set(type,callbacks);
  return () => { callbacks.delete(callback); if (!callbacks.size) subscriptions.delete(type); };
}

export function installCombatLifecycleTracking() {
  if (installed) return;
  installed = true;
  for (const combat of combatList()) ensure(combat);
  globalThis.Hooks.on('createCombat', combat => observe(combat,{created:true}));
  globalThis.Hooks.on('updateCombat', (combat,changes={}) => observe(combat,{
    clockUpdated:changes != null && (Object.hasOwn(changes,'round') || Object.hasOwn(changes,'turn'))
  }));
  globalThis.Hooks.on('deleteCombat', observeDeleted);
  for (const hook of ['createCombatant','updateCombatant','deleteCombatant']) {
    globalThis.Hooks.on(hook,combatant => {
      const combat = combatant?.parent || combatant?.combat;
      if (!combat) return;
      observe(combat);
      // Embedded hooks can fire before derived Combat.turns are recalculated.
      queueMicrotask(() => observe(combat));
    });
  }
}
