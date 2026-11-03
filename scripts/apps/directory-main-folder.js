/** A single, real, pinned Main folder per world document type.
 * Never rewrite existing documents: only newly created world docs are placed here.
 */
import { MODULE_ID } from "../core/constants.js";
import { folderIdOf, MAIN_FOLDER_COLOR } from "./item-directory-cards.js";

export const DIRECTORY_TYPES = Object.freeze(["Item", "Actor", "Scene"]);
const pending = new Map();

export function isMainFolder(folder) {
  return Boolean(folder && DIRECTORY_TYPES.includes(folder.type) && folderIdOf(folder) === null && (
    folder.flags?.[MODULE_ID]?.directoryMain === folder.type || folder.name === "Main"
  ));
}

export function getMainFolder(type) {
  if (!DIRECTORY_TYPES.includes(type)) return null;
  const folders = (globalThis.game?.folders?.contents ?? []).filter(folder => folder.type === type && isMainFolder(folder));
  // Prefer one explicitly marked by Buxa over a user's existing Main folder.
  return folders.find(folder => folder.flags?.[MODULE_ID]?.directoryMain === type) ?? folders[0] ?? null;
}

export async function ensureMainFolder(type) {
  if (!DIRECTORY_TYPES.includes(type)) throw new Error(`Unsupported directory: ${type}`);
  const found = getMainFolder(type);
  if (!game.user?.isGM) return found;
  if (pending.has(type)) return pending.get(type);
  const task = (async () => {
    const existing = getMainFolder(type);
    if (existing) {
      // Recolor older Main folders as well as folders that existed before Buxa.
      // Never touch their contents or reparent them.
      if (String(existing.color ?? "").toLowerCase() !== MAIN_FOLDER_COLOR && typeof existing.update === "function") {
        await existing.update({ color: MAIN_FOLDER_COLOR });
      }
      return existing;
    }
    return Folder.create({
      name: "Main", type, color: MAIN_FOLDER_COLOR,
      flags: { [MODULE_ID]: { directoryMain: type } }
    });
  })();
  pending.set(type, task);
  try { return await task; } finally { pending.delete(type); }
}

export function sortMainFirst(a, b) {
  const mainA = isMainFolder(a);
  const mainB = isMainFolder(b);
  return (mainA === mainB ? 0 : mainA ? -1 : 1) ||
    String(a.name ?? "").localeCompare(String(b.name ?? ""), undefined, { numeric: true, sensitivity: "base" });
}

/** Keep this on world collections only; never modify embedded actor Items. */
export function installMainFolderHooks() {
  for (const type of DIRECTORY_TYPES) {
    Hooks.on(`preCreate${type}`, (document, data) => {
      if (document.parent || data?.pack || document.pack || data?.flags?.[MODULE_ID]?.physicalTransfer) return;
      // Explicit destination folders always win, including moves after creation.
      if (data?.folder || folderIdOf(document)) return;
      const main = getMainFolder(type);
      if (main) document.updateSource({ folder: main.id });
    });
  }
  Hooks.on("preCreateFolder", (folder, data) => {
    if (!DIRECTORY_TYPES.includes(folder.type || data?.type)) return;
    if (data?.flags?.[MODULE_ID]?.directoryMain || data?.flags?.[MODULE_ID]?.directoryTab) return;
    if (folderIdOf(folder) || data?.folder) return;
    const main = getMainFolder(folder.type || data.type);
    if (main) folder.updateSource({ folder: main.id });
  });
  Hooks.on("preDeleteFolder", (folder) => {
    if (isMainFolder(folder)) return false;
  });
  Hooks.on("preUpdateFolder", (folder, changes) => {
    if (!isMainFolder(folder)) return;
    if ((changes.name !== undefined && changes.name !== "Main") ||
      (changes.folder !== undefined && changes.folder !== null)) return false;
  });
  // Only one authoritative GM creates world folders automatically.
  Hooks.once("ready", async () => {
    if (!game.user?.isActiveGM) return;
    for (const type of DIRECTORY_TYPES) {
      try { await ensureMainFolder(type); }
      catch (error) { console.warn(`Buxa | Could not initialize ${type} Main folder`, error); }
    }
  });
}
