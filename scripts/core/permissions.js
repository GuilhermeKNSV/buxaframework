import { HOOKS, MODULE_ID } from "./constants.js";
import { emitProgressHook } from "./progression-safety.js";

const UPDATE_OPTION = `${MODULE_ID}.runtime`;

function ownerLevel() {
  return CONST.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
}

function noneLevel() {
  return CONST.DOCUMENT_OWNERSHIP_LEVELS?.NONE ?? 0;
}

/** Explicit Buxa links only: Foundry grants GMs universal document ownership,
 * which must never be confused with a chosen loot destination. */
export function getLinkedUserIds(actor) {
  const stored = actor?.getFlag?.(MODULE_ID, "linkedUsers");
  if (!Array.isArray(stored)) return [];
  return [...new Set(stored.filter(id => typeof id === "string" && game.users?.get?.(id)))];
}

export async function setLinkedUsers(actor, userIds) {
  if (!actor || !game.user.isGM) return false;

  const selected = new Set((Array.isArray(userIds) ? userIds : []).filter((id) => {
    const user = game.users?.get(id);
    return Boolean(user);
  }));
  const ownership = { ...(actor.ownership ?? {}), default: noneLevel() };

  for (const user of game.users ?? []) {
    if (user.isGM) continue;
    ownership[user.id] = selected.has(user.id) ? ownerLevel() : noneLevel();
  }

  await actor.update({
    ownership,
    [`flags.${MODULE_ID}.linkedUsers`]: [...selected],
    [`flags.${MODULE_ID}.accessInitialized`]: true
  }, { [UPDATE_OPTION]: true });

  emitProgressHook(HOOKS.LINKED_USERS_UPDATED, actor, [...selected]);
  return true;
}

export function buildRestrictedOwnership(actor) {
  const ownership = { ...(actor?.ownership ?? {}), default: noneLevel() };
  for (const user of game.users ?? []) {
    if (!user.isGM) ownership[user.id] = noneLevel();
  }
  return ownership;
}
