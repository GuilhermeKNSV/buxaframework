/** Session-only compartment visibility; never changes the saved inventory. */
import { visibleEquippedCompartments } from './item-storage.js';
const opened = new Map();
const key = actor => actor?.uuid || actor?.id || '';
export function setStorageOpen(actor, itemId, open) {
  const owner = key(actor);if(!owner || !itemId)return;
  const ids=opened.get(owner) || new Set();
  if(open)ids.add(String(itemId));else ids.delete(String(itemId));
  if(ids.size)opened.set(owner,ids);else opened.delete(owner);
}
export function isStorageOpen(actor,itemId){return opened.get(key(actor))?.has(String(itemId))===true;}
export function visibleOpenedCompartments(actor, compartments=[], placements={}) {
  const visible = new Set(visibleEquippedCompartments(compartments, placements).map(b=>b.storageId));
  const manually=opened.get(key(actor))||new Set();
  const byId=new Map(compartments.map(b=>[b.storageId,b]));
  // Opening a provider also reveals nested pouches; it does not equip them.
  let changed=true;
  while(changed) {
    changed=false;
    for(const bag of compartments) {
      if(visible.has(bag.storageId))continue;
      const place=placements[bag.providerId];
      if(manually.has(bag.providerId) || (place?.area==='storage'&&visible.has(place.storageId) && byId.has(place.storageId))){
        visible.add(bag.storageId);changed=true;
      }
    }
  }
  return compartments.filter(b=>visible.has(b.storageId)).map(b=>({...b,manuallyOpened:manually.has(b.providerId),canClose:manually.has(b.providerId)&&!b.active}));
}
