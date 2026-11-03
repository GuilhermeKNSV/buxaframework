/** Shared destination resolver for native Item drags and Buxa pointer drags.
 * The resolved Actor is the sheet being hovered, never a guessed linked Actor. */
import { getInventoryDropDestination } from '../apps/inventory-drop-target.js';

export function resolvePhysicalDropTarget(target, clientX, clientY) {
  if (!target?.closest) return null;
  const sheet = target.closest('[data-buxa-drop-actor-id]');
  if (sheet?.dataset?.buxaDropActorId) {
    return {
      kind:'actor',actorId:sheet.dataset.buxaDropActorId,
      ...(sheet.dataset.buxaDropTokenId ? {targetTokenId:sheet.dataset.buxaDropTokenId} : {}),
      position:getInventoryDropDestination({target,clientX,clientY}) ?? null
    };
  }
  // Left folder panels live outside the sidebar. The normal directory lives
  // inside #items, which may contain a native Foundry Item list as well.
  const panel=target.closest('[data-buxa-folder-drop],[data-buxa-folder-panel]')
    || target.closest('[data-buxa-folder]');
  if (panel) return {kind:'world',folderId:panel.dataset.buxaFolderDrop ?? panel.dataset.buxaFolderPanel ?? panel.dataset.buxaFolder ?? null};
  const dir=target.closest('.buxa-world-item-directory, #sidebar #items, #items.sidebar-tab, [data-tab="items"].sidebar-tab');
  if (dir) {
    const folderNode=target.closest('[data-buxa-dir-folder],[data-folder-id],li.folder');
    const explicit=folderNode?.dataset.buxaDirFolder ?? folderNode?.dataset.folderId;
    if(explicit)return {kind:'world',folderId:explicit};
    // Dropping onto an Item card uses that card's actual folder. A bare
    // directory background remains the root, not the automatically used Main.
    const card=target.closest('[data-buxa-dir-item], [data-document-id], [data-entry-id]');
    const itemId=card?.dataset.buxaDirItem ?? card?.dataset.documentId ?? card?.dataset.entryId;
    const item=itemId?globalThis.game?.items?.get?.(itemId):null;
    return {kind:'world',folderId:typeof item?.folder==='string'?item.folder:item?.folder?.id??null};
  }
  return null;
}
export function physicalDropTargetFromClient(clientX,clientY,doc=globalThis.document) {
  const target=doc?.elementFromPoint?.(clientX,clientY);
  return resolvePhysicalDropTarget(target,clientX,clientY);
}
export function actorDropPayload(actor) {
  return {
    actorId: actor?.id,
    ...(actor?.isToken ? {sourceTokenId:actor.token?.id || actor.parent?.id} : {})
  };
}
