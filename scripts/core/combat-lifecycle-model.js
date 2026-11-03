/** Buxa combat lifecycle — pure snapshots and transitions.
 * No Foundry writes and no UI. The integration consumes these observations;
 * other subsystems can subscribe without polling a Combat document.
 */
const str = value => value == null ? '' : String(value);
const nonnegative = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
const asItems = collection => {
  if (!collection) return [];
  if (Array.isArray(collection)) return collection;
  if (Array.isArray(collection.contents)) return collection.contents;
  return typeof collection[Symbol.iterator] === 'function' ? [...collection] : [];
};

export function captureCombatLifecycle(combat) {
  if (!combat?.id) return null;
  const combatants = asItems(combat.combatants).filter(entry => entry?.id).map(entry => ({
    id: str(entry.id), actorId: str(entry.actorId ?? entry.actor?.id),
    tokenId: str(entry.tokenId ?? entry.token?.id),
    name: str(entry.name ?? entry.actor?.name),
    initiative: Number.isFinite(entry.initiative) ? entry.initiative : null,
    defeated: Boolean(entry.defeated), hidden: Boolean(entry.hidden)
  }));
  const ordered = asItems(combat.turns).filter(entry => entry?.id).map(entry => str(entry.id));
  const fallback = combatants.map(entry => entry.id);
  const order = ordered.length ? ordered : fallback;
  const rawTurn = Number.isSafeInteger(combat.turn) && combat.turn >= 0 ? combat.turn : null;
  const currentId = str(combat.combatant?.id || (rawTurn != null && ordered.length ? order[rawTurn] : ''));
  const flag = (key, fallback = []) => {
    try { const value = combat.getFlag?.('buxaframework', key); return Array.isArray(value) ? value : fallback; }
    catch { return fallback; }
  };
  const roster = flag('encounterRoster').filter(row => row && (row.id || row.actorId)).map(row => ({
    id: str(row.id), actorId: str(row.actorId), tokenId: str(row.tokenId), npc: Boolean(row.npc)
  }));
  const dead = flag('encounterDead').filter(row => row?.id).map(row => ({
    id: str(row.id), actorId: str(row.actorId), tokenId: str(row.tokenId)
  }));
  return {
    combatId: str(combat.id), sceneId: str(combat.scene?.id ?? combat.scene),
    started: Boolean(combat.started), active: Boolean(combat.active),
    round: nonnegative(combat.round), turn: rawTurn,
    currentCombatantId: currentId, order, combatants, roster, dead
  };
}

/** A canonical event stream, including START/END boundaries on a single update.
 * Reorders/reassignments must NEVER look like actual turn advances.
 * A large round jump is one observed transition (not synthetic turns).
 */
export function diffCombatLifecycle(before, after, {created = false, deleted = false, clockUpdated = false} = {}) {
  if (!before && !after) return [];
  const events = [];
  const send = (type, details = {}) => events.push({type, ...details});
  const from = before || null, to = after || null;
  const prev = from || {started:false,round:0,turn:null,currentCombatantId:'',active:false,
    combatants:[],order:[],roster:[],dead:[],sceneId:''};
  const next = to || {...prev,started:false,active:false};
  const previousCombatantId = prev.currentCombatantId || '';
  const currentCombatantId = next.currentCombatantId || '';
  const position = {
    previousRound: prev.round, previousTurn: prev.turn, previousCombatantId,
    round: next.round, turn: next.turn, combatantId: currentCombatantId
  };
  const oldPosition = {...position, round:prev.round,turn:prev.turn,combatantId:previousCombatantId};

  if (created) send('combat:created');
  if (from && to && from.sceneId !== to.sceneId) send('combat:scene-changed', {previousSceneId:from.sceneId, sceneId:to.sceneId});
  if (from && to && from.active !== to.active) send(to.active ? 'combat:activated' : 'combat:deactivated');

  const beforeMembers = new Map(prev.combatants.map(row => [row.id,row]));
  const afterMembers = new Map(next.combatants.map(row => [row.id,row]));
  for (const [id,row] of afterMembers) {
    if (!beforeMembers.has(id)) { if (from) send('combatant:joined', {combatantId:id,actorId:row.actorId,tokenId:row.tokenId}); continue; }
    const old = beforeMembers.get(id);
    const fields = ['actorId','tokenId','name','initiative','defeated','hidden'].filter(key => old[key] !== row[key]);
    if (fields.length) send('combatant:updated', {combatantId:id,actorId:row.actorId,fields,
      before:old,after:row});
  }
  for (const [id,row] of beforeMembers) if (!afterMembers.has(id))
    send('combatant:left', {combatantId:id,actorId:row.actorId,tokenId:row.tokenId});

  if (from && to && prev.order.join('\u001f') !== next.order.join('\u001f')) {
    send('initiative:order-changed', {previousOrder:prev.order,order:next.order});
  }
  const oldRoster = new Set(prev.roster.map(row=>row.id));
  const newRoster = new Set(next.roster.map(row=>row.id));
  const added = next.roster.filter(row=>!oldRoster.has(row.id));
  const removed = prev.roster.filter(row=>!newRoster.has(row.id));
  if (from && to && (added.length || removed.length)) send('roster:changed', {added,removed});
  const oldDead = new Set(prev.dead.map(row => row.id));
  const newDead = new Set(next.dead.map(row => row.id));
  if (from && to) {
    for (const row of next.dead) if (!oldDead.has(row.id)) send('combatant:archived', {entry:row});
    for (const row of prev.dead) if (!newDead.has(row.id)) send('combatant:unarchived', {entry:row});
  }

  // End boundaries before start boundaries, including combat being deleted.
  if (prev.started && (!next.started || deleted)) {
    if (previousCombatantId) send('turn:ended', {...oldPosition,reason:deleted ? 'deleted' : 'combat-ended'});
    if (prev.round >= 1) send('round:ended', {...oldPosition,reason:deleted ? 'deleted' : 'combat-ended'});
    send('combat:ended', {...oldPosition,reason:deleted ? 'deleted' : 'stopped'});
  } else if (!prev.started && next.started) {
    send('combat:started', {...position});
    if (next.round >= 1) send('round:started', {...position,reason:'combat-start'});
    if (currentCombatantId) send('turn:started', {...position,reason:'combat-start'});
  } else if (prev.started && next.started && from && to) {
    const roundChanged = prev.round !== next.round;
    const indexChanged = prev.turn !== next.turn;
    const currentChanged = previousCombatantId !== currentCombatantId;
    // Same numeric turn after initiative shuffle / death is a reassignment,
    // not a new turn. A genuine round or turn change is an advance/rewind.
    if (indexChanged && !roundChanged && !currentChanged && !clockUpdated) {
      // A combatant deletion or initiative resort moved the numeric cursor,
      // but the same actor is still active. No turn has actually passed.
      send('turn:reindexed', {...position,reason:'order-or-roster-changed'});
    } else if (roundChanged || indexChanged) {
      const reason = next.round < prev.round || (next.round === prev.round && next.turn != null && prev.turn != null && next.turn < prev.turn)
        ? 'rewind' : 'advance';
      if (previousCombatantId) send('turn:ended', {...oldPosition,reason});
      if (roundChanged && prev.round >= 1) send('round:ended', {...oldPosition,reason});
      if (roundChanged && next.round >= 1) send('round:started', {...position,reason,
        roundsElapsed:Math.max(0,next.round-prev.round),skippedRounds:Math.max(0,next.round-prev.round-1)});
      if (currentCombatantId) send('turn:started', {...position,reason});
    } else if (currentChanged) {
      send('turn:reassigned', {...position, reason:clockUpdated ? 'clock-updated' : 'order-or-roster-changed'});
    }
  }
  if (deleted) send('combat:deleted');
  return events;
}
