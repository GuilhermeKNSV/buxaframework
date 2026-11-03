/** Safe parent changes for World Item folders. Never move Main or form cycles. */
import { isMainFolder } from './directory-main-folder.js';
import { MODULE_ID } from '../core/constants.js';

const parentId = folder => typeof folder?.folder === 'string' ? folder.folder : folder?.folder?.id || null;

export function canMoveWorldItemFolder(folder, destinationId, getFolder = id => globalThis.game?.folders?.get?.(id)) {
  if (!folder || folder.type !== 'Item' || isMainFolder(folder) || folder.flags?.[MODULE_ID]?.directoryTab === 'Item' || !folder.id) return false;
  const dest = destinationId || null;
  if (dest === folder.id) return false;
  if (!dest) return true;
  const seen = new Set();
  for (let current = getFolder(dest); current; current = getFolder(parentId(current))) {
    if (!current.id || seen.has(current.id) || current.type !== 'Item' || current.id === folder.id) return false;
    seen.add(current.id);
  }
  return seen.has(dest);
}

export async function moveWorldItemFolder(folder, destinationId, getFolder = id => globalThis.game?.folders?.get?.(id)) {
  if (!globalThis.game?.user?.isGM) throw Error('Only GMs can move Item folders.');
  const dest = destinationId || null;
  if (!canMoveWorldItemFolder(folder, dest, getFolder)) throw Error('This folder cannot be moved there.');
  if (parentId(folder) === dest) return false;
  await folder.update({ folder: dest });
  return true;
}

/** Native/Buxa folder drags only: do not confuse Actor folders with Item folders. */
export function itemFolderFromDrop(data, getFolder = id => globalThis.game?.folders?.get?.(id)) {
  if (!data || data.type !== 'Folder') return null;
  const uuid = typeof data.uuid === 'string' ? data.uuid : '';
  if (uuid && !/^Folder\.[A-Za-z0-9]+$/.test(uuid)) return null;
  const id = uuid ? uuid.slice('Folder.'.length) : data.id;
  const folder = typeof id === 'string' ? getFolder(id) : null;
  return folder?.type === 'Item' ? folder : null;
}
