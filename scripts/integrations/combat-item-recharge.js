/** GM-authoritative automatic Item recharge on Foundry V14 combat advances.
 * Cursor lives on each encounter; progress lives on each owned Item instance.
 * Rewinds, initiative changes and unrelated combat edits grant nothing.
 */
import { MODULE_ID } from '../core/constants.js';
import { getSheetConfig } from '../core/config.js';
import { getItemRules } from '../core/item-config.js';
import { normalizeItemUsage } from '../core/item-use-config.js';

const pending=new Map();
/** Turn indices are meaningful only for one ordered set of Combatants.
 * A drag-reorder can change their order without changing the list length. */
export function combatTurnOrderSignature(turns=[]) {
  return [...turns].map(turn=>String(turn?.id ?? turn?._id ?? turn?.actor?.uuid ?? turn?.actor?.id ?? '')).join('|');
}
const asInt=(value,fallback=0)=>Number.isInteger(value)&&value>=0?value:fallback;
export function combatTurnAdvance(previous,next,slots) {
  if (!previous || !next || !Number.isInteger(slots) || slots<1) return 0;
  const a=asInt(previous.round,-1),b=asInt(next.round,-1);
  const x=asInt(previous.turn,-1),y=asInt(next.turn,-1);
  if(a<1 || b<1 || x<0 || y<0 || x>=slots || y>=slots) return 0;
  const distance=(b-a)*slots+(y-x);
  return distance>0 && distance<=10000 ? distance : 0;
}
export function applyCombatRecharge(usage, progress, rule, delta) {
  const positiveInt=(value,fallback)=>Number.isSafeInteger(value)&&value>=0?value:fallback;
  const period=Math.max(1,positiveInt(rule?.everyTurns,1));
  const charges=Math.max(1,positiveInt(rule?.charges,1));
  // A damaged saved counter must not be able to create arbitrarily many charges.
  const previous=positiveInt(progress,0)%period;
  const advance=Math.min(10000,positiveInt(delta,0));
  const elapsed=previous+advance;
  const triggers=Math.floor(elapsed/period);
  return {usage:{used:Math.max(0,normalizeItemUsage(usage).used-triggers*charges)},
    progress:elapsed%period,triggers};
}
const gmIsPrimary=()=> {
  if (!game.user?.isGM) return false;
  const active=game.users?.activeGM;
  if (active?.isGM && active.active !== false) return active.id===game.user.id;
  const gms=[...(game.users?.contents || (game.users?.[Symbol.iterator] ? game.users : []))].filter(u=>u?.isGM && u.active!==false)
    .sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  return !gms.length || gms[0].id===game.user.id;
};
async function processCombat(combat,changes,snapshot) {
  if(!gmIsPrimary() || !combat?.started || !('round' in changes || 'turn' in changes)) return;
  try {
    const slots=snapshot.slots;
    const cursor=combat.getFlag?.(MODULE_ID,'rechargeCursor');
    // Changes to the combatant list invalidate ordinal turn offsets. Reset
    // without awarding phantom charges from a turn order that no longer exists.
    const signature=combatTurnOrderSignature(snapshot.turns);
    const changedOrder=Boolean(cursor && (cursor.combatants!==slots ||
      (cursor.orderSignature && cursor.orderSignature!==signature)));
    const prev=cursor?.combatants===slots ? cursor : snapshot.previous;
    const next={round:snapshot.round,turn:snapshot.turn};
    // Save the starting cursor before awarding any Item. If the second Item
    // throws, the next update must still know which earlier turn needs replay.
    // Each successful Item has its own cursor, so it won't be credited twice.
    if(!cursor && prev && Number.isInteger(prev.round) && prev.round>=1 &&
       Number.isInteger(prev.turn) && prev.turn>=0 && prev.turn<slots) {
      await combat.setFlag(MODULE_ID,'rechargeCursor',{
        round:prev.round,turn:prev.turn,combatants:slots,orderSignature:signature,
        highRound:prev.round,highTurn:prev.turn
      });
    }
    // Preserve a high-water mark: rewinding and replaying old turns must not
    // regenerate charges. Changing combatant counts resets the baseline safely.
    const high=cursor?.combatants===slots && cursor.highRound!=null
      ? {round:cursor.highRound,turn:cursor.highTurn} : prev;
    const delta=changedOrder ? 0 : combatTurnAdvance(high,next,slots);
    const previouslyHigh=high && ((high.round>next.round) || (high.round===next.round && high.turn>=next.turn));
    const peak=previouslyHigh ? high : next;
    const oldPeak=cursor?.highRound!=null ? {round:cursor.highRound,turn:cursor.highTurn} : null;
    const protectedPeak=changedOrder && oldPeak && oldPeak.round>peak.round ? oldPeak : peak;
    const newCursor={...next,combatants:slots,orderSignature:signature,
      highRound:protectedPeak?.round??next.round,
      highTurn:Math.max(0,Math.min(slots-1,protectedPeak?.turn??next.turn))};
    if(!delta) {
      if (!cursor || cursor.round!==next.round || cursor.turn!==next.turn || cursor.combatants!==slots ||
          cursor.orderSignature!==signature)
        await combat.setFlag(MODULE_ID,'rechargeCursor',newCursor);
      return;
    }
    const config=getSheetConfig();
    const actors=new Map();
    for(const entry of snapshot.turns) if(entry.actor?.id) actors.set(entry.actor.uuid||entry.actor.id,entry.actor);
    for(const actor of actors.values()) {
      if(!actor.items) continue;
      for(const item of actor.items) {
        const limits=getItemRules(item,config).limits;
        if(!limits.enabled || !limits.recharge.combat.enabled) continue;
        const state=item.getFlag?.(MODULE_ID,'combatRecharge') || {};
        const previous=state.combatId===combat.id && Number.isSafeInteger(state.progress) && state.progress>=0 ? state.progress : 0;
        // An item already processed at this cursor must never recharge twice,
        // including after a GM reconnect or when hooks are delivered twice.
        if(state.combatId===combat.id && state.round===next.round && state.turn===next.turn) continue;
        const itemCursor=state.combatId===combat.id && Number.isInteger(state.round) && Number.isInteger(state.turn) &&
          !changedOrder ? {round:state.round,turn:state.turn} : null;
        // Preserve each Item's own high-water mark as well as the encounter's.
        // Rewinding must never rewrite an advanced Item cursor backwards.
        if(itemCursor && !combatTurnAdvance(itemCursor,next,slots)) continue;
        const itemDelta=itemCursor ? combatTurnAdvance(itemCursor,next,slots) : delta;
        const result=applyCombatRecharge(item.getFlag?.(MODULE_ID,'itemUsage'),previous,limits.recharge.combat,itemDelta);
        const update={[`flags.${MODULE_ID}.combatRecharge`]:{combatId:combat.id,round:next.round,turn:next.turn,progress:result.progress}};
        if(result.triggers && normalizeItemUsage(item.getFlag?.(MODULE_ID,'itemUsage')).used!==result.usage.used)
          update[`flags.${MODULE_ID}.itemUsage`]=result.usage;
        try {await item.update(update,{[`${MODULE_ID}.combatRecharge`]:true});}
        catch(error) {
          const saved=item.getFlag?.(MODULE_ID,'combatRecharge');
          if(saved?.combatId!==combat.id || saved.round!==next.round || saved.turn!==next.turn) throw error;
        }
      }
    }
    await combat.setFlag(MODULE_ID,'rechargeCursor',newCursor);
  } catch(error) {console.error(`${MODULE_ID} | Combat item recharge failed; will retry on next combat update.`,error);}
}

export function registerCombatItemRecharge() {
  Hooks.on('updateCombat',(combat,changes)=>{
    if(!gmIsPrimary() || !('round' in changes || 'turn' in changes))return;
    const snapshot={round:combat.round,turn:combat.turn,slots:combat.turns?.length??0,
      turns:[...(combat.turns??[])],previous:combat.previous&&{round:combat.previous.round,turn:combat.previous.turn}};
    const previous=pending.get(combat.id) || Promise.resolve();
    const next=previous.catch(()=>{}).then(()=>processCombat(combat,changes,snapshot));
    pending.set(combat.id,next);
    void next.finally(()=>{if(pending.get(combat.id)===next)pending.delete(combat.id);});
  });
}
