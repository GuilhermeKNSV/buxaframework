/** Stage encounter NPCs without leaving orphaned Tokens when a Foundry hook
 * throws after some (or all) embedded documents have already been persisted.
 * The roster save remains the authoritative commit check; never delete Tokens
 * that were on the scene before this operation. */
const tokenList = scene => scene?.tokens?.contents ?? [...(scene?.tokens ?? [])];
const tagOf = token => token?.flags?.buxaframework?.encounterEntryId ??
  token?.getFlag?.('buxaframework','encounterEntryId');

/** Embedded creation is not contractually ordered by requested roster entry.
 * Use the saved encounter tag, never the array index, to associate instances. */
export function createdEncounterTokenMap(tokens) {
  const mapped = new Map();
  for(const token of tokens ?? []) {
    const entryId=tagOf(token);
    if(!entryId || !token?.id || mapped.has(entryId))
      throw Error('New NPC Tokens have missing or duplicate encounter identities.');
    mapped.set(entryId,token.id);
  }
  return mapped;
}

export async function createEncounterNpcTokens(scene, drafts, {commit, isCommitted=()=>false,
  clearFailedRoster=async()=>{}}={}) {
  if (!scene?.createEmbeddedDocuments || !scene?.deleteEmbeddedDocuments || typeof commit !== 'function' ||
      !Array.isArray(drafts) || !drafts.length) throw Error('Invalid NPC placement request.');
  const before = new Set(tokenList(scene).map(token=>token?.id).filter(Boolean));
  const expected = new Set(drafts.map(draft=>draft?.flags?.buxaframework?.encounterEntryId));
  if (expected.has(undefined) || expected.has('') || expected.size !== drafts.length)
    throw Error('Encounter NPC placement requires unique roster identities.');
  let created = [];
  const owned = () => {
    const matches = new Map();
    for(const token of tokenList(scene)) {
      if (!token?.id || before.has(token.id) || !expected.has(tagOf(token))) continue;
      matches.set(token.id,token);
    }
    // Returned documents may be missing from a mock collection while the
    // embedded-creation promise is still settling; include their identities.
    for(const token of created) if(token?.id && !before.has(token.id) && expected.has(tagOf(token)))
      matches.set(token.id,token);
    return [...matches.values()];
  };
  try {
    const result = await scene.createEmbeddedDocuments('Token', drafts);
    created = Array.isArray(result) ? result : [];
    if (created.length !== drafts.length || new Set(created.map(token=>token?.id)).size !== drafts.length)
      throw Error('Foundry did not confirm the placement of every NPC.');
    const tagged=createdEncounterTokenMap(created);
    if (tagged.size!==expected.size || [...expected].some(entryId=>!tagged.has(entryId)))
      throw Error('Foundry did not preserve the NPC encounter identity.');
    await commit(created);
    return created;
  } catch(error) {
    const tokens = owned();
    // An update hook can throw AFTER the roster was saved. If the roster
    // already points to every newly created Token, retain those committed NPCs.
    let committed = false;
    if (tokens.length === drafts.length) {
      try { committed = await isCommitted(tokens); }
      catch (checkError) {
        console.warn('Buxa encounter | Could not confirm NPC roster commit; attempting recovery.',checkError);
      }
    }
    if (committed) return tokens;
    const ids = tokens.map(token=>token.id);
    if (ids.length) {
      try { await scene.deleteEmbeddedDocuments('Token', ids); }
      catch(rollback) {
        if (tokenList(scene).some(token=>ids.includes(token.id)))
          throw Error('NPC placement may have left untracked Tokens. Ask the GM to inspect the scene before trying again.', {cause:rollback});
      }
      if (tokenList(scene).some(token=>ids.includes(token.id)))
        throw Error('NPC placement left untracked Tokens. Ask the GM to inspect the scene before trying again.', {cause:error});
    }
    // A Foundry hook may also have saved part of the roster before failing.
    // Clear only references to Tokens created by THIS operation, so no row
    // keeps pointing to an NPC Token we just removed.
    if (ids.length) {
      try { await clearFailedRoster(ids); }
      catch(repairError) {
        throw Error('NPC placement was removed, but its roster could not be repaired. Ask the GM to inspect this combat.', {cause:repairError});
      }
    }
    throw error;
  }
}
