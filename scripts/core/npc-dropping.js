/** NPC-only, always-simple drop table. Template entries never enter Actor inventory. */
import { MODULE_ID } from './constants.js';
import { numericField, booleanField } from './numeric-field.js';
// NPC inputs can arrive from old flags or forms: never coerce arrays, objects,
// booleans, or Symbol values into capacities and drop probabilities.
const integer = (v, fallback, min, max) => numericField(v, fallback, min, max, true);
const resourceId = (value, fallback = '') => typeof value === 'string' && value.trim() ? value.trim().slice(0, 100) : fallback;
export function normalizeNpcDropping(input) {
  const raw=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
  return {defaultSlots:integer(raw.defaultSlots,12,1,200),resourceId:resourceId(raw.resourceId,'hp')};
}
export function npcDropCapacity(actor,config) {
  const global=normalizeNpcDropping(config?.npc?.dropping);
  return integer(actor?.getFlag?.(MODULE_ID,'npc.dropCapacity'),global.defaultSlots,1,200);
}
export function npcDropResource(actor,config) {
  const resources = Array.isArray(config?.resources) ? config.resources : [];
  const override = resourceId(actor?.getFlag?.(MODULE_ID,'npc.dropResource'));
  const configured = resourceId(config?.npc?.dropping?.resourceId,'hp');
  // Unknown/deleted Actor overrides must not silently switch death monitoring
  // to a different resource instead of the configured world HP resource.
  return (override ? resources.find(r => r?.id === override) : null)
    ?? resources.find(r => r?.id === configured)
    ?? resources.find(r => r?.id === 'hp')
    ?? resources[0] ?? null;
}
export function normalizeDropWeights(input) {
  if (typeof input !== 'string') return '';
  return input.trim().slice(0,600);
}
export function quantityOptions(entry) {
  const min=integer(entry?.min,1,1,100),max=integer(entry?.max,min,min,100);
  const weights=Object.create(null);
  for(const chunk of String(entry?.weights||'').split(/[,;\n]+/)) {
    const match=chunk.trim().match(/^(\d+)\s*:\s*(\d+(?:\.\d+)?)$/);
    if(!match)continue;
    const n=Number(match[1]),weight=Number(match[2]);
    if(n>=min&&n<=max&&weight>=0&&Number.isFinite(weight))weights[n]=Math.min(100000,weight);
  }
  const custom=entry?.weightsEnabled !== false && Object.keys(weights).length>0;
  return Array.from({length:max-min+1},(_,i)=>({quantity:min+i,weight:custom?(weights[min+i]??0):1}));
}
export function normalizeNpcDropEntry(input) {
  const raw=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
  const min=integer(raw.min,1,1,100);
  let data = null;
  if (raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)) {
    try { data = structuredClone(raw.data); } catch { return null; }
  }
  if(!data || !String(data.name||'').trim() || typeof raw.id!=='string' || !/^[a-z0-9_-]{3,64}$/i.test(raw.id))return null;
  delete data._stats;delete data.folder;delete data._id;
  // Legacy Item snapshots sometimes have malformed system fields. Never let
  // one invalid drop template crash the complete NPC kill/loot resolution.
  if (!data.system || typeof data.system !== 'object' || Array.isArray(data.system)) data.system = {};
  const weights=normalizeDropWeights(raw.weights);
  return {id:raw.id,data,chance:integer(raw.chance,100,0,100),min,
    max:integer(raw.max,min,min,100),weights,
    // Legacy entries with custom weights remain enabled; new entries default off.
    weightsEnabled: booleanField(raw.weightsEnabled, Boolean(weights)),
    destination:raw.destination==='ground'?'ground':'inventory'};
}
export function npcDropTable(actor) {
  const entries=actor?.getFlag?.(MODULE_ID,'npc.dropTable');
  return Array.isArray(entries)?entries.slice(0,200).map(normalizeNpcDropEntry).filter(Boolean):[];
}
export function rollNpcDrops(entries,random=Math.random) {
  const results=[];
  const chance = () => {
    const n = random();
    // A broken RNG must not promote an item to a guaranteed rare drop.
    return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n < 1 ? n : null;
  };
  for (const entry of entries) {
    const rule = normalizeNpcDropEntry(entry);
    if (!rule) continue;
    const dropRoll = chance();
    if (dropRoll === null || dropRoll * 100 >= rule.chance) continue;
    const options=quantityOptions(rule),total=options.reduce((sum,v)=>sum+v.weight,0);
    if(total<=0)continue;
    const quantityRoll = chance();
    if (quantityRoll === null) continue;
    let pick=quantityRoll*total,quantity=options.at(-1).quantity;
    for(const option of options){pick-=option.weight;if(pick<0){quantity=option.quantity;break;}}
    const data=structuredClone(rule.data);data.system??={};data.system.quantity=quantity;
    results.push({id:rule.id,quantity,destination:rule.destination,data});
  }
  return results;
}
export function npcCorpseState(token) {
  const state=token?.document?.getFlag?.(MODULE_ID,'npcLoot') ?? token?.getFlag?.(MODULE_ID,'npcLoot');
  return state&&typeof state==='object'&&!Array.isArray(state)?state:null;
}

/** Every corpse inventory row needs a unique stable receipt ID. A drop table
 * can intentionally contain the same rule multiple times; taking one copy
 * must never consume the others. Preserve the first ID for old saves. */
export function uniqueNpcInventoryDrops(drops) {
  const reserved=new Set(drops.map(entry=>entry.id));
  const seen=new Set();
  return drops.map(entry=>{
    if(!seen.has(entry.id)){seen.add(entry.id);return {...entry};}
    let ordinal=2, id;
    do {id=`${entry.id}--${ordinal++}`;} while(reserved.has(id));
    reserved.add(id);seen.add(id);
    return {...entry,id};
  });
}
