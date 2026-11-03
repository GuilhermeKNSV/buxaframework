/** Pure encounter roster/placement helpers. No Foundry data mutation here. */
export const actorIsNPC = actor => actor?.type === 'npc';
export const rosterId = () => globalThis.crypto?.randomUUID?.() || `entry-${Math.random().toString(36).slice(2)}-${Date.now()}`;
export function normalizeEncounterRoster(input) {
  if (!Array.isArray(input)) return [];
  const ids = new Set(), players = new Set(), result = [];
  for (const raw of input) {
    const id = typeof raw?.id === 'string' ? raw.id.slice(0, 100) : '';
    const actorId = typeof raw?.actorId === 'string' ? raw.actorId.slice(0, 100) : '';
    if (!id || ids.has(id) || !actorId) continue;
    const npc = raw.npc === true;
    if (!npc && players.has(actorId)) continue;
    if (!npc) players.add(actorId);
    ids.add(id);
    result.push({id, actorId, npc, tokenId: typeof raw.tokenId === 'string' ? raw.tokenId : ''});
  }
  return result;
}
export function addEncounterActor(roster, actor, id = rosterId()) {
  const existing = normalizeEncounterRoster(roster);
  if (!actor?.id || (!actorIsNPC(actor) && existing.some(e => !e.npc && e.actorId === actor.id))) return existing;
  return [...existing, {id, actorId: actor.id, npc: actorIsNPC(actor), tokenId: ''}];
}
export function normalizeEncounterDead(input) {
  if (!Array.isArray(input)) return [];
  const ids = new Set(), result = [];
  for (const raw of input) {
    const id = typeof raw?.id === 'string' ? raw.id.slice(0, 100) : '';
    if (!id || ids.has(id)) continue;
    ids.add(id);
    result.push({
      id,
      actorId: typeof raw?.actorId === 'string' ? raw.actorId.slice(0, 100) : '',
      tokenId: typeof raw?.tokenId === 'string' ? raw.tokenId.slice(0, 100) : '',
      name: String(raw?.name || 'Missing Actor').slice(0, 200),
      img: String(raw?.img || 'icons/svg/mystery-man.svg').slice(0, 500),
      summary: String(raw?.summary || '').slice(0, 300),
      at: raw?.at == null || String(raw.at).trim() === '' || !Number.isFinite(Number(raw.at))
        ? 0 : Math.max(0, Number(raw.at))
    });
  }
  return result;
}
export function mergeEncounterDead(dead, additions) {
  const merged = normalizeEncounterDead(dead);
  const incoming = normalizeEncounterDead(additions);
  const byId = new Map(merged.map(entry => [entry.id, entry]));
  for (const entry of incoming) byId.set(entry.id, entry);
  return [...byId.values()].sort((a, b) => (Number(a.at) || 0) - (Number(b.at) || 0));
}
/** Only tokens explicitly assigned to this encounter may be reused.
 * Reservations happen BEFORE fallback lookup: two NPC copies can never share a token.
 * Legacy untagged NPCs are not silently hijacked. */
export function bindRosterTokens(roster, tokens) {
  const all = [...(tokens ?? [])];
  const entries = normalizeEncounterRoster(roster);
  const used = new Set();
  const match = (entry, predicate) => all.find(token =>
    token?.id && !used.has(token.id) && token.actorId === entry.actorId &&
    token.actorLink !== true && predicate(token));
  // Existing stored token IDs take priority over tags on *other* entries.
  const reserved = new Map();
  for (const entry of entries) {
    if (!entry.npc || !entry.tokenId) continue;
    const token = match(entry, token => token.id === entry.tokenId &&
      (!token.flags?.buxaframework?.encounterEntryId || token.flags.buxaframework.encounterEntryId === entry.id));
    if (token) { used.add(token.id); reserved.set(entry.id, token); }
  }
  for (const entry of entries) {
    if (!entry.npc || reserved.has(entry.id)) continue;
    const token = match(entry, item => item.flags?.buxaframework?.encounterEntryId === entry.id);
    if (token) { used.add(token.id); reserved.set(entry.id, token); }
  }
  return entries.map(entry => entry.npc
    ? {...entry, tokenId: reserved.get(entry.id)?.id || ''}
    : entry);
}
export function unplacedNPCs(roster, tokens) {
  return bindRosterTokens(roster, tokens).filter(entry => entry.npc && !entry.tokenId);
}
/** Pick non-overlapping token top-left cells; accounts for oversized actors
 * and tokens already in the scene. Coordinates are Foundry canvas pixels. */
export function encounterPlacements(count, origin, gridSize = 100, occupied = [], options = {}) {
  const size = Math.max(20, Number(gridSize) || 100);
  const centerX = Math.round((Number(origin?.x) || 0) / size);
  const centerY = Math.round((Number(origin?.y) || 0) / size);
  const used = new Set();
  // Oversized creatures must reserve their complete footprint, never a silent 20-cell clamp.
  const validSpan = n => {
    const value = Number(n);
    if (!Number.isFinite(value) || value <= 0) return 1;
    if (value > 128) throw RangeError('NPC footprint exceeds the supported 128-cell limit.');
    return Math.max(1, Math.ceil(value));
  };
  const reserve = (x,y,w,h) => {
    for(let row=y; row<y+h; row++) for(let col=x; col<x+w; col++) used.add(`${col}/${row}`);
  };
  const free = (x,y,w,h) => {
    if(x<0||y<0||Number.isFinite(options?.maxWidth)&& (x+w)*size>options.maxWidth ||
      Number.isFinite(options?.maxHeight)&& (y+h)*size>options.maxHeight) return false;
    for(let row=y; row<y+h; row++) for(let col=x; col<x+w; col++) if(used.has(`${col}/${row}`)) return false;
    return true;
  };
  for(const p of occupied) if(Number.isFinite(p?.x) && Number.isFinite(p?.y)) {
    // Off-grid Tokens occupy every intersected cell, not just their rounded origin.
    const x = Math.floor(p.x / size), y = Math.floor(p.y / size);
    const width = Math.ceil((p.x + validSpan(p.width) * size) / size) - x;
    const height = Math.ceil((p.y + validSpan(p.height) * size) / size) - y;
    reserve(x, y, width, height);
  }
  const output = [];
  // A 200-entry limit silently truncated large staged combats. Reject absurd
  // imported counts explicitly rather than placing only the first entries.
  const total = Number(count);
  if (!Number.isSafeInteger(total) || total < 0 || total > 2000)
    throw RangeError('NPC placement requires a valid count (0–2000).');
  const sceneSpan = Math.max(0, Number(options?.maxWidth) || 0, Number(options?.maxHeight) || 0);
  const ringLimit = sceneSpan > 0 ? Math.min(1000, Math.ceil(sceneSpan / size) + 1) : 160;
  for(let i=0; i<total;i++) {
    const footprint = options?.footprints?.[i] || {};
    const w = validSpan(footprint.width), h = validSpan(footprint.height);
    let found = null;
    for(let ring=0;ring<ringLimit && !found;ring++) {
      // Scan only the perimeter. The old nested-square loop tested O(r²)
      // coordinates per ring despite immediately skipping its interior.
      const visit=(dx,dy)=>{
        if(found)return;
        const x=centerX+dx,y=centerY+dy;
        if(free(x,y,w,h))found={x:x*size,y:y*size};
      };
      if(!ring) visit(0,0);
      else {
        for(let dx=-ring;dx<=ring && !found;dx++)visit(dx,-ring);
        for(let dy=-ring+1;dy<=ring && !found;dy++)visit(ring,dy);
        for(let dx=ring-1;dx>=-ring && !found;dx--)visit(dx,ring);
        for(let dy=ring-1;dy> -ring && !found;dy--)visit(-ring,dy);
      }
    }
    if(!found) break;
    reserve(Math.round(found.x/size),Math.round(found.y/size),w,h);
    output.push(found);
  }
  return output;
}
/** Reorder combatants without rewriting their current initiative into an invalid value. */
export function initiativeAfterMove(combatants, movingId, targetId) {
  const row = combatants.find(c => c.id === movingId), target = combatants.find(c => c.id === targetId);
  if (!row || !target || row === target) return null;
  const rest = combatants.filter(c => c.id !== movingId);
  const index = rest.findIndex(c => c.id === targetId);
  const upper = index > 0 ? Number(rest[index-1].initiative) : Number(target.initiative) + 2;
  const lower = Number(target.initiative);
  if (!Number.isFinite(upper) || !Number.isFinite(lower)) return null;
  // Ties and almost-equal floats cannot be resolved by another midpoint.
  return upper - lower > 0.00001 ? (upper + lower) / 2 : null;
}
/** Stable fallback: re-number the requested order when two turns share a rank. */
export function initiativeReorderUpdates(combatants, movingId, targetId) {
  if (!movingId || !targetId || movingId === targetId) return [];
  const sorted = [...combatants];
  const source = sorted.findIndex(c => c.id === movingId);
  if (source < 0 || !sorted.some(c => c.id === targetId)) return [];
  const [moving] = sorted.splice(source,1);
  sorted.splice(sorted.findIndex(c => c.id === targetId),0,moving);
  const top = Math.max(sorted.length, ...sorted.map(c => Number(c.initiative) || 0).filter(Number.isFinite));
  return sorted.map((c,i) => ({_id:c.id,initiative:top-i}));
}
