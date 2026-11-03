/** Resolve Buxa hotbar ownership without coupling player shortcuts to token selection.
 * Players use the character assigned to their user. GM selection is explicit. */
export function resolveHotbarActor(state, { gameRef = globalThis.game, canvasRef = globalThis.canvas } = {}) {
  const user = gameRef?.user;
  if (!user) return null;
  if (!user.isGM) {
    if (user.character?.isOwner) return user.character;
    // Small worlds often assign ownership without setting a user character.
    // Only auto-link when exactly one eligible Actor is owned.
    const owned = ownedHotbarActors(gameRef);
    return owned.length === 1 ? owned[0] : null;
  }
  if (state?.activeTokenId && state?.activeSceneId === canvasRef?.scene?.id) {
    const token = canvasRef?.tokens?.placeables?.find?.(entry => entry?.document?.id === state.activeTokenId);
    if (token?.actor?.isOwner) return token.actor;
  }
  const selected = state?.activeActorId ? gameRef?.actors?.get?.(state.activeActorId) : null;
  if (selected?.isOwner) return selected;
  return user.character?.isOwner ? user.character : null;
}
export function ownedHotbarActors(gameRef = globalThis.game) {
  const actors = [...(gameRef?.actors?.contents ?? gameRef?.actors?.values?.() ?? gameRef?.actors ?? [])].filter(actor => actor?.isOwner && ['character', 'npc'].includes(actor.type));
  return actors.sort((a, b) => String(a.name).localeCompare(String(b.name)));
}
