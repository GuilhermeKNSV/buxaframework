/** Automatic capacity-aware stacking for external ground chest compartments.
 * Builds one immutable record; callers persist it once as an atomic GM write. */
import { MODULE_ID } from './constants.js';
import { getItemRules } from './item-config.js';
import { stackQuantity, planStackTransfer } from './stack-capacity.js';
import { groundAddBranch, groundCompartments, groundDropDestination } from './ground-container.js';
import { getPackedContents, stripPackedContents, attachPackedContents } from './backpack-transfers.js';

export function receiveGroundStacks(record, itemData, descendants, requested, makeId, config) {
  const enabled=getItemRules({getFlag:(scope,key)=>itemData?.flags?.[scope]?.[key]},config).multiple.enabled;
  const destination=groundDropDestination(record,itemData,requested);
  // If an explicit target is occupied, we may still fill its compatible stack.
  const acceptedBags=groundCompartments(record)
    .filter(bag=>!requested.storageId || bag.storageId===requested.storageId);
  const contents=getPackedContents(record.data);
  if(!enabled || descendants.length) {
    if(!destination)throw Error('Container is full or the item does not fit.');
    return groundAddBranch(record,itemData,descendants,destination.storageId,destination.index,destination.rotation,makeId);
  }
  const bagIds=new Set(acceptedBags.map(bag=>bag.id));
  const candidates=contents.filter(entry=>entry.providerId==='root' && bagIds.has(entry.compartmentId));
  candidates.sort((a,b)=>{
    const favored=entry=>requested.index!=null && entry.index===Number(requested.index) &&
      (!requested.storageId || requested.storageId===`root:${entry.compartmentId}`) ? 0 : 1;
    return favored(a)-favored(b) || a.index-b.index;
  });
  const plan=planStackTransfer(itemData,stackQuantity(itemData),candidates.map(entry=>entry.data),config);
  const updated=contents.map(entry=>structuredClone(entry));
  for(const merge of plan.merges) {
    const position=contents.findIndex(entry=>entry.data===merge.target);
    if(position<0)throw Error('A target stack disappeared.');
    updated[position].data.system??={};
    updated[position].data.system.quantity=stackQuantity(merge.target)+merge.amount;
  }
  let result={...record,data:attachPackedContents(stripPackedContents(record.data),updated)};
  for(let index=0;index<plan.chunks.length;index++) {
    const copy=structuredClone(itemData);
    copy.system??={};copy.system.quantity=plan.chunks[index];
    const requestedCell=index===0 ? requested : {...requested,index:null};
    let place=groundDropDestination(result,copy,requestedCell);
    // A specific occupied stack is not a free placement. The remainder goes
    // to a free slot in the same compartment, never replaces another item.
    if(!place && requestedCell.index!=null)
      place=groundDropDestination(result,copy,{...requestedCell,index:null});
    if(!place)throw Error('Container has insufficient room for the remaining stacks.');
    result=groundAddBranch(result,copy,[],place.storageId,place.index,place.rotation,makeId);
  }
  return result;
}
