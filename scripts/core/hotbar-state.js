/** Per-client, actor-scoped shortcut layout. Item documents are never copied or moved. */
export const HOTBAR_SETTING = 'hotbarConfiguration';
const MAX_TABS = 12;
const MAX_SLOT_ID = 150;
const MAX_ACTOR_ID = 150;
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const record = () => Object.create(null);
const integer = (value, fallback, min, max) => {
  if (value == null || typeof value === 'boolean' ||
      (typeof value === 'string' && !value.trim()) ||
      !['number','string'].includes(typeof value)) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.trunc(n))) : fallback;
};
export const hotbarColor = (input, fallback = '#bc965b') => /^#[\da-f]{6}$/i.test(String(input)) ? String(input) : fallback;
export const defaultHotbarState = () => ({
  enabled: false, locked: false, rows: 1, columns: 10, color: '#bc965b',
  activeTab: 'tab-1', activeActorId: '', activeTokenId: '', activeSceneId: '',
  tabs: [{ id: 'tab-1', name: '1' }, { id: 'tab-2', name: '2' }, { id: 'tab-3', name: '3' }],
  orbs: [{ resourceId: '', showNumber: false }, { resourceId: '', showNumber: false }],
  bindings: {}
});
const safeId = value => String(value || '').replace(/[^a-zA-Z\d_-]/g, '').slice(0, 64);
export function normalizeHotbarState(raw) {
  const base = defaultHotbarState();
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const tabs = [], ids = new Set();
  // Scan past duplicate/broken leading entries before applying the tab cap.
  for (const entry of Array.isArray(source.tabs) ? source.tabs.slice(0, 10000) : base.tabs) {
    if (tabs.length >= MAX_TABS) break;
    const id = safeId(entry?.id);
    if (!id || ids.has(id)) continue;
    ids.add(id);
    tabs.push({ id, name: String(entry?.name ?? tabs.length + 1).trim().slice(0, 24) || String(tabs.length + 1) });
  }
  if (!tabs.length) tabs.push(base.tabs[0]);
  const rows = integer(source.rows, 1, 1, 4);
  const columns = integer(source.columns, 10, 4, 14);
  const bindings = record();
  if (source.bindings && typeof source.bindings === 'object' && !Array.isArray(source.bindings)) {
    let kept = 0;
    for (const [actorId, actorBindings] of Object.entries(source.bindings)) {
      if (kept >= 10000) break;
      if (!actorId || actorId.length > MAX_ACTOR_ID || !actorBindings || typeof actorBindings !== 'object' || Array.isArray(actorBindings)) continue;
      const perTab = record();
      for (const tab of tabs) {
        const slots = own(actorBindings, tab.id) ? actorBindings[tab.id] : null;
        if (!Array.isArray(slots)) continue;
        perTab[tab.id] = slots.slice(0, 56).map(itemId => {
          const id = typeof itemId === 'string' ? itemId.trim() : '';
          return id.length && id.length <= MAX_SLOT_ID ? id : null;
        });
      }
      bindings[actorId] = perTab;
      kept++;
    }
  }
  const orbs = [0, 1].map(i => ({
    resourceId: safeId(source.orbs?.[i]?.resourceId),
    showNumber: source.orbs?.[i]?.showNumber === true
  }));
  return {
    enabled: source.enabled === true,
    locked: source.locked === true,
    rows, columns,
    color: hotbarColor(source.color),
    activeTab: tabs.some(t => t.id === source.activeTab) ? source.activeTab : tabs[0].id,
    activeActorId: typeof source.activeActorId === 'string' ? source.activeActorId.slice(0, 150) : '',
    activeTokenId: typeof source.activeTokenId === 'string' ? source.activeTokenId.slice(0, 150) : '',
    activeSceneId: typeof source.activeSceneId === 'string' ? source.activeSceneId.slice(0, 150) : '',
    tabs, orbs, bindings
  };
}
export function hotbarSlots(state, actorId, tabId = state.activeTab) {
  const amount = state.rows * state.columns;
  const actorBindings = state.bindings && own(state.bindings, actorId) ? state.bindings[actorId] : null;
  const list = actorBindings && own(actorBindings, tabId) ? actorBindings[tabId] : [];
  return Array.from({ length: amount }, (_, i) => typeof list[i] === 'string' && list[i] ? list[i] : null);
}
/** Locate a shortcut in any tab, including hidden rows kept for later. */
export function hotbarItemLocations(state, actorId, itemId) {
  if (!actorId || !itemId || typeof itemId !== 'string') return [];
  const tabs = state?.bindings && own(state.bindings, actorId) ? state.bindings[actorId] : null;
  if (!tabs || typeof tabs !== 'object') return [];
  const result = [];
  for (const tab of state.tabs ?? []) {
    const slots = Object.hasOwn(tabs, tab.id) ? tabs[tab.id] : null;
    if (!Array.isArray(slots)) continue;
    slots.forEach((id, index) => { if (id === itemId) result.push({ tabId: tab.id, index }); });
  }
  return result;
}

/** Clear references only; NEVER touch the Actor's embedded Item. */
export function removeHotbarItem(raw, actorId, itemId) {
  const state = normalizeHotbarState(raw);
  if (state.locked || !hotbarItemLocations(state, actorId, itemId).length) return null;
  const tabs = state.bindings[actorId];
  for (const { tabId, index } of hotbarItemLocations(state, actorId, itemId)) tabs[tabId][index] = null;
  return state;
}

/** Move, swap or assign references only; never touch inventory state. */
export function assignHotbarSlot(raw, actorId, tabId, index, itemId, source = null) {
  const state = normalizeHotbarState(raw);
  if (state.locked || typeof actorId !== 'string' || !actorId || actorId.length > MAX_ACTOR_ID
      || !state.tabs.some(tab => tab.id === tabId)) return null;
  if (itemId !== null && (typeof itemId !== 'string' || !itemId.trim() || itemId.length > MAX_SLOT_ID)) return null;
  if (!Number.isInteger(index) || index < 0 || index >= state.rows * state.columns) return null;
  const fullSlots = (id) => {
    const prior = state.bindings?.[actorId]?.[id] ?? [];
    const slots = Array.isArray(prior) ? [...prior] : [];
    while (slots.length < state.rows * state.columns) slots.push(null);
    return slots;
  };
  const slots = fullSlots(tabId);
  const nextId = typeof itemId === 'string' ? itemId.trim() : null;
  if (!own(state.bindings, actorId)) state.bindings[actorId] = record();
  if (source && source.actorId === actorId && state.tabs.some(t => t.id === source.tabId)
      && Number.isInteger(source.index) && source.index >= 0 && source.index < state.rows * state.columns) {
    const origin = source.tabId === tabId ? slots : fullSlots(source.tabId);
    if (origin[source.index] !== nextId) return null;
    origin[source.index] = slots[index];
    state.bindings[actorId][source.tabId] = origin;
  }
  slots[index] = nextId;
  state.bindings[actorId][tabId] = slots;
  return state;
}
export function nextHotbarSlot(state, actorId, itemId) {
  if (!itemId) return null;
  const slots = hotbarSlots(state, actorId);
  const existing = slots.indexOf(itemId);
  return existing >= 0 ? existing : slots.indexOf(null);
}
export function addHotbarTab(raw) {
  const state = normalizeHotbarState(raw);
  if (state.tabs.length >= MAX_TABS) return state;
  let counter = 1;
  while (state.tabs.some(t => t.id === `tab-${counter}`)) counter++;
  state.tabs.push({ id: `tab-${counter}`, name: String(state.tabs.length + 1) });
  state.activeTab = `tab-${counter}`;
  return state;
}
export function removeHotbarTab(raw, id) {
  const state = normalizeHotbarState(raw);
  if (state.tabs.length <= 1) return state;
  state.tabs = state.tabs.filter(t => t.id !== id);
  if (state.tabs.length === 0) return normalizeHotbarState(raw);
  for (const actorTabs of Object.values(state.bindings)) if (own(actorTabs, id)) delete actorTabs[id];
  if (state.activeTab === id) state.activeTab = state.tabs[0].id;
  return state;
}

/** Merge only appearance settings. An open config dialog must not erase new
 * shortcuts added elsewhere while the dialog was open. */
export function mergeHotbarConfiguration(current, submitted, baseline = null) {
  const live = normalizeHotbarState(current);
  const next = normalizeHotbarState(submitted);
  const previouslyKnownTabs = new Set(live.tabs.map(tab => tab.id));
  const choseNewTab = !previouslyKnownTabs.has(next.activeTab);
  live.rows = next.rows; live.columns = next.columns; live.color = next.color;
  live.orbs = next.orbs;
  // A settings dialog only knows the tabs that existed when it opened. Merge
  // tabs added while it was open instead of deleting their Item shortcuts.
  // Explicitly removed *known* tabs stay removed.
  const known = baseline ? new Set(normalizeHotbarState(baseline).tabs.map(t => t.id)) : null;
  const submittedIds = new Set(next.tabs.map(t => t.id));
  const concurrent = known ? live.tabs.filter(t => !known.has(t.id) && !submittedIds.has(t.id)) : [];
  live.tabs = [...next.tabs, ...concurrent].slice(0, MAX_TABS);
  if (choseNewTab) live.activeTab = next.activeTab;
  for (const actorTabs of Object.values(live.bindings)) {
    for (const id of Object.keys(actorTabs)) {
      if (!live.tabs.some(tab => tab.id === id)) delete actorTabs[id];
    }
  }
  if (!live.tabs.some(tab => tab.id === live.activeTab)) live.activeTab = live.tabs[0].id;
  return live;
}
