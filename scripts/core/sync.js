import { HOOKS, MODULE_ID } from "./constants.js";
import { emitProgressHook } from "./progression-safety.js";

const SYNC_OPTION = `${MODULE_ID}.syncing`;

function activeScene() {
  return globalThis.canvas?.scene ?? null;
}

function currentSceneTokenDocuments(actor) {
  const scene = activeScene();
  if (!scene || !actor) return [];
  return scene.tokens.filter((token) => token.actorId === actor.id);
}

async function updateCurrentSceneTokens(actor, changes) {
  const scene = activeScene();
  if (!scene) return;
  const tokens = currentSceneTokenDocuments(actor);
  if (!tokens.length) return;

  const updates = tokens.map((token) => ({ _id: token.id, ...changes }));
  try {
    await scene.updateEmbeddedDocuments("Token", updates, { [SYNC_OPTION]: true });
  } catch (error) {
    console.warn(`${MODULE_ID} | Could not update every current-scene token.`, error);
  }
}

export async function setFullbodyImage(actor, src) {
  if (!actor || !src || !actor.isOwner) return false;
  await actor.update({ img: src }, { [SYNC_OPTION]: true });
  emitProgressHook(HOOKS.FULLBODY_UPDATED, actor, src);
  return true;
}

export async function setTokenImage(actor, src) {
  if (!actor || !src || !actor.isOwner) return false;

  if (actor.isToken && actor.token) {
    await actor.token.update({ "texture.src": src }, { [SYNC_OPTION]: true });
  } else {
    await actor.update({ "prototypeToken.texture.src": src }, { [SYNC_OPTION]: true });
    await updateCurrentSceneTokens(actor, { "texture.src": src });
  }

  emitProgressHook(HOOKS.TOKEN_IMAGE_UPDATED, actor, src);
  return true;
}

export async function syncActorNameToTokens(actor, changed = {}) {
  if (!actor || !Object.prototype.hasOwnProperty.call(changed, "name")) return false;
  if (!actor.isOwner) return false;

  const name = actor.name;
  if (!name) return false;

  if (actor.isToken && actor.token) {
    if (actor.token.name !== name) {
      try {
        await actor.token.update({ name }, { [SYNC_OPTION]: true });
      } catch (error) {
        console.warn(`${MODULE_ID} | Could not synchronize synthetic token name.`, error);
        return false;
      }
    }
    return true;
  }

  const updates = {};
  if (actor.prototypeToken?.name !== name) updates["prototypeToken.name"] = name;

  if (Object.keys(updates).length) {
    try {
      await actor.update(updates, { [SYNC_OPTION]: true });
    } catch (error) {
      console.warn(`${MODULE_ID} | Could not synchronize prototype token name.`, error);
    }
  }

  await updateCurrentSceneTokens(actor, { name });
  return true;
}

export function getTokenImage(actor) {
  if (!actor) return "icons/svg/mystery-man.svg";
  if (actor.isToken && actor.token?.texture?.src) return actor.token.texture.src;
  return actor.prototypeToken?.texture?.src || "icons/svg/mystery-man.svg";
}
