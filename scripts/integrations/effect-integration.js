/** Foundry document and combat hooks for Effects. Installed once at ready. */
import { MODULE_ID, IS_CONDITION_FLAG } from '../core/constants.js';
import { getItemKind } from '../core/effect-config.js';
import { applyEffectToActor, removeEffectFromActor, getActiveEffects, isPrimaryEffectGM, tickActorEffects } from '../core/effect-runtime.js';
import { refreshActorEffectHuds } from '../apps/effect-hud.js';
import { onCombatLifecycle } from './combat-lifecycle.js';

let installed = false;
export function installEffectIntegration() {
  if (installed) return;
  installed = true;
  for (const phase of ['turn:started','turn:ended']) onCombatLifecycle(phase,event => {
    if (event.reason === 'rewind' || !isPrimaryEffectGM()) return;
    const combat = game.combats?.get?.(event.combatId);
    if (!combat?.started) return;
    const actors = new Map();
    for (const turn of combat.turns || []) if (turn?.actor) actors.set(turn.actor.uuid || turn.actor.id,turn.actor);
    for (const actor of actors.values()) if (getActiveEffects(actor).length) {
      void tickActorEffects(actor,combat,phase==='turn:started'?'onCombatTurnStart':'onCombatTurnEnd')
        .catch(error=>console.error('Buxa | Effect tick failed',error));
    }
  });
  Hooks.on('createItem',async item=>{
    if (!isPrimaryEffectGM() || item?.parent?.documentName!=='Actor' ||
        item.getFlag?.(MODULE_ID,IS_CONDITION_FLAG)!==true || getItemKind(item)!=='effect') return;
    try {await applyEffectToActor(item.parent,item);}
    catch(error) {console.error('Buxa | Condition creation failed',error);}
  });
  Hooks.on('updateItem',async (item,changed)=>{
    if (!isPrimaryEffectGM() || item?.parent?.documentName!=='Actor' ||
        item.getFlag?.(MODULE_ID,IS_CONDITION_FLAG)!==true || getItemKind(item)!=='effect' ||
        !foundry.utils.hasProperty(changed,`flags.${MODULE_ID}.${IS_CONDITION_FLAG}`) ||
        getActiveEffects(item.parent).some(entry=>entry.effectItemId===item.id)) return;
    try {await applyEffectToActor(item.parent,item);}
    catch(error) {console.error('Buxa | Condition flag update failed',error);}
  });
  Hooks.on('deleteItem', async item => {
    if (!isPrimaryEffectGM() || item?.parent?.documentName !== 'Actor') return;
    if (!getActiveEffects(item.parent).some(entry=>entry.effectItemId===item.id)) return;
    try { await removeEffectFromActor(item.parent,null,{effectItemId:item.id}); }
    catch (error) {console.error('Buxa | Deleted condition cleanup failed',error);}
  });
  Hooks.on('updateItem',item=>{ if(item?.parent?.documentName==='Actor') refreshActorEffectHuds(item.parent); });
  Hooks.on('updateActor',actor=>refreshActorEffectHuds(actor));
}
