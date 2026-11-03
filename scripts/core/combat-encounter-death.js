/** Central archive for native encounter removals. The archive write happens
 * before deletion so NPC Kill and HP-based removal share one durable record.
 * If deletion fails, a later sweep retries the same combatant safely. */
import {MODULE_ID} from './constants.js';
import {mergeEncounterDead, normalizeEncounterDead} from './combat-encounter-model.js';

export function isEncounterDeathAuthority(users = globalThis.game?.users, user = globalThis.game?.user) {
  if (!user?.isGM) return false;
  const primary = users?.activeGM;
  if (primary?.isGM && primary.active !== false) return primary.id === user.id;
  const others = [...(users?.contents || (users?.[Symbol.iterator] ? users : []))].filter(gm => gm?.isGM && gm.active !== false)
    .sort((a,b) => String(a.id).localeCompare(String(b.id)));
  return others.length ? others[0].id === user.id : true;
}
export function validCombatHp(value) {
  if (value == null || typeof value === 'boolean' || String(value).trim() === '') return null;
  const hp = Number(value);
  return Number.isFinite(hp) ? hp : null;
}
export function isCombatantDefeated(dndHp, linkedHp) {
  const dnd = validCombatHp(dndHp), linked = validCombatHp(linkedHp);
  return (dnd !== null && dnd <= 0) || (linked !== null && linked <= 0);
}
function recordFor(combatant, actor) {
  const hp = actor?.system?.attributes?.hp;
  const name = String(actor?.name || combatant.name || 'Missing Actor');
  const summary = hp?.value != null ? `HP ${hp.value}/${hp.max ?? '?'}` : 'Defeated';
  return {
    id: String(combatant.id), actorId: String(combatant.actorId || actor?.id || ''),
    tokenId: String(combatant.tokenId || ''), name,
    img: String(actor?.img || 'icons/svg/mystery-man.svg'), summary, at: Date.now()
  };
}
export async function archiveEncounterDeaths(combat, combatants, {actorFor = candidate => candidate?.token?.actor || candidate?.actor, force = false} = {}) {
  if (!combat || !Array.isArray(combatants) || !combatants.length) return [];
  if (!force && !isEncounterDeathAuthority()) return [];
  const live = [...(combat.combatants || [])];
  const ids = new Set(live.map(entry => entry.id));
  const victims = combatants.filter(candidate => candidate?.id && ids.has(candidate.id));
  if (!victims.length) return [];
  if (typeof combat.setFlag === 'function' && typeof combat.getFlag === 'function') {
    const existing = normalizeEncounterDead(combat.getFlag(MODULE_ID, 'encounterDead'));
    const records = victims.map(candidate => recordFor(candidate, actorFor(candidate)));
    // Never overwrite the first snapshot if we are retrying deletion.
    const already = new Set(existing.map(row => row.id));
    const combined = mergeEncounterDead(existing, records.filter(record => !already.has(record.id)));
    await combat.setFlag(MODULE_ID, 'encounterDead', combined);
  }
  await combat.deleteEmbeddedDocuments('Combatant', victims.map(candidate => candidate.id));
  return victims.map(candidate => candidate.id);
}
