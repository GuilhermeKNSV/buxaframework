/** Use the same official Actor persistence method as normal inventory moves.
 * Portable backpack pickup stages its complete flag state before any new
 * Item documents are created; no separate static Actor update is required. */
import { MODULE_ID } from './constants.js';
export async function writeBackpackInventory(actor,state,options={}) {
  await actor.update({[`flags.${MODULE_ID}.inventory`]:state},options);
  const saved=actor.getFlag?.(MODULE_ID,'inventory');
  if(!saved || (state.tracked||[]).some(id=>!saved.tracked?.includes(id)) ||
    Object.entries(state.placements||{}).some(([id,p])=>
      Object.entries(p).some(([key,value])=>saved.placements?.[id]?.[key]!==value)))
    throw Error('Backpack inventory update was not confirmed by Foundry.');
  return saved;
}
