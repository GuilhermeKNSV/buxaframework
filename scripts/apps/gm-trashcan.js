/** GM-only trash gateway for scene Items, world Items and embedded Items.
 * Trash actions are immediate; selection modes only collect explicit targets. */
import { requestPhysicalAction } from '../integrations/physical-item-transfers.js';
import { notifyError, notifySuccess, notifyWarning } from '../core/notifications.js';

let sceneId = null;
let selecting = false;
let mainSelecting = false;
let deletingMain = false;
const selected = new Set();
const selectedMain = new Set();
let render = () => {};
const here = () => globalThis.canvas?.scene?.id || null;
const emit = () => { render?.(); paintSelectedMainItems(); };
const guardScene = () => {
  if (sceneId !== here()) { selected.clear(); selecting = false; sceneId = here(); emit(); }
};
export function registerTrashcanView(callback) { render = typeof callback === 'function' ? callback : () => {}; }
export function trashcanState() {
  guardScene();
  return { selecting, sceneId, count: selected.size, mainSelecting, mainCount: selectedMain.size };
}
export function setTrashcanSelecting(next) {
  if (!globalThis.game?.user?.isGM) return false;
  guardScene(); selecting = Boolean(next);
  if (selecting) { mainSelecting = false; selectedMain.clear(); }
  else selected.clear();
  emit(); return selecting;
}
export function setTrashcanMainSelecting(next) {
  if (!globalThis.game?.user?.isGM) return false;
  mainSelecting = Boolean(next);
  if (mainSelecting) { selecting = false; selected.clear(); }
  else selectedMain.clear();
  emit(); return mainSelecting;
}
export function trashcanSelectSceneItem(recordId) {
  if (!globalThis.game?.user?.isGM) return false;
  guardScene();
  if (!selecting || !recordId || !sceneId) return false;
  selected.has(recordId) ? selected.delete(recordId) : selected.add(recordId);
  emit(); return true;
}
export function trashcanItemSelected(recordId) { guardScene(); return selecting && selected.has(recordId); }
export function trashcanSelectMainItem(itemId) {
  if (!globalThis.game?.user?.isGM || !mainSelecting || !globalThis.game?.items?.get?.(itemId)) return false;
  selectedMain.has(itemId) ? selectedMain.delete(itemId) : selectedMain.add(itemId);
  emit(); return true;
}
export function trashcanMainItemSelected(itemId) { return mainSelecting && selectedMain.has(itemId); }
export function paintSelectedMainItems(root = globalThis.document) {
  if (!root?.querySelectorAll) return;
  globalThis.document?.body?.classList.toggle('buxa-trash-main-selecting', Boolean(mainSelecting && globalThis.game?.user?.isGM));
  for (const node of root.querySelectorAll('[data-buxa-dir-item], .buxa-folder-entry.is-item[data-buxa-item]')) {
    const id = node.dataset.buxaDirItem || node.dataset.buxaItem;
    node.classList.toggle('is-trash-selected', mainSelecting && selectedMain.has(id));
    node.setAttribute('aria-pressed', String(mainSelecting && selectedMain.has(id)));
  }
}
export function trashcanDragTarget(x,y,doc=globalThis.document) {
  if (!globalThis.game?.user?.isGM || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  const el=doc?.elementFromPoint?.(x,y);
  return Boolean(el?.closest?.('[data-buxa-trash-zone]'));
}
export async function trashcanDeleteSceneItems(itemIds, id = here()) {
  if (!globalThis.game?.user?.isGM || !id || !Array.isArray(itemIds)) return false;
  const clean=[...new Set(itemIds.filter(value=>typeof value==='string' && value))];
  if (!clean.length) return false;
  if (here() !== id) {notifyWarning('Scene changed. Nothing was deleted.');return false;}
  try {
    const result=await requestPhysicalAction({action:'trash',sceneId:id,itemIds:clean});
    for (const itemId of clean) selected.delete(itemId);
    emit();
    notifySuccess(`${result?.deleted ?? clean.length} scene item(s) deleted.`);
    return true;
  } catch(error) { notifyError(error?.message || 'Could not delete scene items.'); return false; }
}
export async function trashcanDeleteSelected() {
  guardScene();
  if (!selecting || !selected.size) return false;
  const items=[...selected];
  const ok=await trashcanDeleteSceneItems(items,sceneId);
  if (ok) { selecting=false; selected.clear(); emit(); }
  return ok;
}
export async function trashcanDeleteSelectedMain() {
  if (!globalThis.game?.user?.isGM || !mainSelecting || !selectedMain.size || deletingMain) return false;
  deletingMain = true;
  let deleted = 0;
  try {
    for (const id of [...selectedMain]) {
      const item = globalThis.game?.items?.get?.(id);
      if (!item || item.parent || item.documentName !== 'Item') { selectedMain.delete(id); continue; }
      try { await item.delete(); deleted++; selectedMain.delete(id); }
      catch (error) { notifyError(error?.message || `Could not delete ${item.name}.`); }
    }
    if (deleted) notifySuccess(`${deleted} world item(s) deleted.`);
    if (!selectedMain.size) mainSelecting = false;
    return deleted > 0;
  } finally { deletingMain = false; emit(); }
}
/** A World Item, or an Item embedded in an Actor; never delete a whole Actor. */
export async function trashcanDeleteItemDocument(item) {
  if (!globalThis.game?.user?.isGM || item?.documentName !== 'Item' || !item?.id || typeof item.delete !== 'function') return false;
  try {await item.delete();selectedMain.delete(item.id);emit();notifySuccess('Item deleted.');return true;}
  catch(error){notifyError(error?.message||'Item deletion failed.');return false;}
}
export async function trashcanDeleteNativeItem(raw) {
  if (!globalThis.game?.user?.isGM) return false;
  let data;
  try {data=JSON.parse(raw);} catch {notifyWarning('This is not an Item drag.');return false;}
  if (data?.type!=='Item' || typeof data.uuid!=='string' || !/^((Actor\.[A-Za-z0-9]+\.Item\.[A-Za-z0-9]+)|(Item\.[A-Za-z0-9]+))$/.test(data.uuid)) {
    notifyWarning('Drag an Actor or Directory Item into Trashcan.'); return false;
  }
  const item=typeof globalThis.fromUuid==='function' ? await globalThis.fromUuid(data.uuid) : null;
  if (!item || item.documentName!=='Item' || !item.id) {notifyWarning('Item no longer exists.');return false;}
  return trashcanDeleteItemDocument(item);
}
/** Invoked only when an Actor's custom pointer inventory drag ends over trash. */
export function trashcanDropActorItem(actor,item,x,y,doc=globalThis.document) {
  if (!trashcanDragTarget(x,y,doc) || !actor?.items?.get?.(item?.id) || !globalThis.game?.user?.isGM) return false;
  void trashcanDeleteItemDocument(item);
  return true;
}
