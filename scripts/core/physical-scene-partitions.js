/** Independently persisted scene records. The old monolithic world setting is
 * retained as a read-only migration source. No Scene Document update is used. */
import { MODULE_ID } from './constants.js';

export const PHYSICAL_SCENE_PREFIX = 'physicalSceneV2_';
export const scenePartitionKey = sceneId => {
  if (!/^[a-zA-Z0-9_-]{1,96}$/.test(String(sceneId??''))) throw Error('Invalid physical scene ID.');
  return `${PHYSICAL_SCENE_PREFIX}${sceneId}`;
};
const canRegister = () => Boolean(globalThis.game?.settings?.register && globalThis.game?.settings?.settings?.has);
export function ensureScenePartition(sceneId) {
  const key=scenePartitionKey(sceneId);
  if (!canRegister()) return null; // Old isolated test fixtures: legacy path.
  if (!game.settings.settings.has(`${MODULE_ID}.${key}`)) {
    game.settings.register(MODULE_ID,key,{
      name:`Buxa Scene Items (${sceneId})`, scope:'world',config:false,type:Object,
      default:{version:2,initialized:false,records:[]},
      onChange:()=>globalThis.Hooks?.callAll?.('buxaPhysicalSceneItemsChanged',sceneId)
    });
  }
  return key;
}
export function readScenePartition(sceneId) {
  const key=ensureScenePartition(sceneId);
  if (!key) return null;
  let value;
  try { value=game.settings.get(MODULE_ID,key); }
  catch(error) {throw Error(`Buxa physical Scene ${sceneId} storage is unreadable. Transfers disabled.`,{cause:error});}
  if (!value || typeof value!=='object' || Array.isArray(value) || value.version!==2 ||
      typeof value.initialized!=='boolean' || !Array.isArray(value.records))
    throw Error(`Buxa physical Scene ${sceneId} storage is corrupt. Transfers disabled.`);
  return value;
}
function sameSceneRecords(a, b) {
  const normalize = value => value && typeof value === 'object'
    ? Array.isArray(value) ? value.map(normalize) : Object.fromEntries(Object.entries(value).sort(([x],[y]) => x.localeCompare(y)).map(([k,v])=>[k,normalize(v)]))
    : value;
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}
export async function writeScenePartition(sceneId,entries) {
  const before=readScenePartition(sceneId);
  if(!before) return null;
  await game.settings.set(MODULE_ID,scenePartitionKey(sceneId),{
    version:2,initialized:true,records:structuredClone(entries)
  });
  const saved=readScenePartition(sceneId);
  if(!saved.initialized || !globalThis.foundry?.utils?.equals?.(saved.records,entries) && !sameSceneRecords(saved.records,entries))
    throw Error('Physical Scene storage did not confirm its save. Inventory was not modified.');
  return saved;
}
