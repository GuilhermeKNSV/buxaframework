/** The authoritative, fail-closed Scene Item trash mutation. */
import { scenePhysicalItems, assertPhysicalSceneRecordsWritable } from '../core/physical-items.js';
/** Removal is serialized with transfers by the physical request channel. */
export async function trashSceneItems(payload,user,{sceneFor,writePhysical}) {
  if (!user?.isGM) throw Error('Only a GM may delete physical scene items.');
  const scene=sceneFor(payload.sceneId);
  if (!scene) throw Error('Scene not found.');
  const itemIds=payload.itemIds;
  if (!Array.isArray(itemIds) || itemIds.length<1 || itemIds.length>200 ||
      itemIds.some(id=>typeof id!=='string' || !id || id.length>160) || new Set(itemIds).size!==itemIds.length)
    throw Error('Invalid selection for deletion.');
  assertPhysicalSceneRecordsWritable(scene);
  const records=scenePhysicalItems(scene);
  const remaining=records.filter(item=>!itemIds.includes(item.id));
  if(records.length-remaining.length!==itemIds.length) throw Error('Selection changed. Nothing was deleted.');
  await writePhysical(scene,remaining);
  return {deleted:itemIds.length};
}
