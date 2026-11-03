import { MODULE_ID, SETTINGS } from "./constants.js";

const MAX_STORED_ACTORS = 750;
let stateWriteQueue = Promise.resolve();

function queueStateWrite(task) {
  const run = async () => task();
  const queued = stateWriteQueue.then(run, run);
  stateWriteQueue = queued.catch(() => {});
  return queued;
}

function cleanPosition(position = {}) {
  const result = {};
  for (const key of ["left", "top", "width", "height"]) {
    const value = Number(position?.[key]);
    if (Number.isFinite(value)) result[key] = value;
  }
  return result;
}

function legacyStateKey(actor) {
  return actor?.uuid || actor?.id || null;
}

function stateKey(actor) {
  const actorKey = legacyStateKey(actor);
  if (!actorKey) return null;
  const worldId = game.world?.id || "world";
  const userId = game.user?.id || "user";
  return `${worldId}:${userId}:${actorKey}`;
}

function readAllStates() {
  const stored = game.settings.get(MODULE_ID, SETTINGS.SHEET_UI_STATE);
  return stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
}

function trimOldStates(states) {
  const entries = Object.entries(states);
  if (entries.length <= MAX_STORED_ACTORS) return states;

  entries
    .sort(([, a], [, b]) => Number(b?.updatedAt || 0) - Number(a?.updatedAt || 0))
    .slice(MAX_STORED_ACTORS)
    .forEach(([key]) => delete states[key]);
  return states;
}

function currentStoredState(all, key, legacyKey) {
  const state = all[key] ?? (legacyKey ? all[legacyKey] : null);
  return state && typeof state === "object" && !Array.isArray(state) ? state : {};
}

export function getActorUiState(actor) {
  const key = stateKey(actor);
  const legacyKey = legacyStateKey(actor);
  if (!key) return null;

  try {
    const state = currentStoredState(readAllStates(), key, legacyKey);
    return Object.keys(state).length ? foundry.utils.deepClone(state) : null;
  } catch (_error) {
    return null;
  }
}

export async function patchActorUiState(actor, patch = {}) {
  const key = stateKey(actor);
  const legacyKey = legacyStateKey(actor);
  if (!key) return false;

  return queueStateWrite(async () => {
    const all = foundry.utils.deepClone(readAllStates());
    const current = foundry.utils.deepClone(currentStoredState(all, key, legacyKey));
    all[key] = {
      ...current,
      ...foundry.utils.deepClone(patch),
      updatedAt: Date.now()
    };

    if (legacyKey && legacyKey !== key) delete all[legacyKey];
    trimOldStates(all);
    await game.settings.set(MODULE_ID, SETTINGS.SHEET_UI_STATE, all);
    return true;
  });
}

export async function saveActorUiState(actor, {
  position = {},
  scrollTop = 0,
  portraitMode = "fullbody",
  activeTab = "basic"
} = {}) {
  return patchActorUiState(actor, {
    position: cleanPosition(position),
    scrollTop: Math.max(0, Number(scrollTop) || 0),
    portraitMode: portraitMode === "token" ? "token" : "fullbody",
    activeTab: activeTab === "inventory"
      ? "inventory"
      : ((activeTab === "stats" || activeTab === "otherStats") ? "stats" : "basic")
  });
}

export async function pruneActorUiState(actor) {
  const key = stateKey(actor);
  const legacyKey = legacyStateKey(actor);
  if (!key && !legacyKey) return false;

  return queueStateWrite(async () => {
    const all = foundry.utils.deepClone(readAllStates());
    let changed = false;
    for (const candidate of [key, legacyKey]) {
      if (!candidate || !Object.hasOwn(all, candidate)) continue;
      delete all[candidate];
      changed = true;
    }
    if (!changed) return false;
    await game.settings.set(MODULE_ID, SETTINGS.SHEET_UI_STATE, all);
    return true;
  });
}
