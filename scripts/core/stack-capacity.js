/** Rules shared by Actor inventories, backpacks, and portable ground containers.
 * Plain serialized item data and live Foundry Item documents both work here. */
import { MODULE_ID } from './constants.js';
import { getItemRules } from './item-config.js';
import { sameStoredValue } from './value-equality.js';
import { validStackQuantity } from './stack-quantity.js';

function flagOf(item, scope, key) {
  return item?.getFlag?.(scope, key) ?? item?.flags?.[scope]?.[key];
}
export function stackQuantity(item) {
  const amount = Number(item?.system?.quantity ?? item?.data?.system?.quantity ?? 1);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : 1;
}
function hasStorageGrants(rules) {
  return Boolean(rules.storage?.slots?.external?.length ||
    Number(rules.storage?.slots?.add) > 0 || rules.storage?.equipped?.slotIds?.length);
}
export function maxStackOf(item, config) {
  const rules = getItemRules({ getFlag: (scope, key) => flagOf(item, scope, key) }, config);
  // Each Item document provides one unique set of compartment IDs. Treat
  // grant-providing items as individual Items even if a legacy world template
  // accidentally enables stacking.
  return rules.multiple.enabled && !hasStorageGrants(rules) ? rules.multiple.maxStack : 1;
}
export function stackIdentityOf(item, config) {
  const rules = getItemRules({ getFlag: (scope, key) => flagOf(item, scope, key) }, config);
  if (!rules.multiple.enabled) return null;
  if (rules.multiple.stackKey) return `buxa:${rules.multiple.stackKey}`;
  const origin = flagOf(item, MODULE_ID, 'itemInstance')?.originUuid
    || flagOf(item, 'core', 'sourceId') || item?._stats?.compendiumSource;
  if (origin) return `source:${String(origin).trim()}`;
  return `fallback:${String(item?.type || '')}:${String(item?.name || '').trim().toLowerCase()}:${String(item?.img || '')}`;
}
/** An identity alone is not enough: a user may modify the rarity, bonuses,
 * discovery or damage on an individual instance while retaining its stackKey.
 * Merging such items would silently destroy the source's customized rules.
 * Max Stack is intentionally excluded: stackRoom already honors BOTH limits. */
function comparableStackRules(item,config) {
  const rules=getItemRules({getFlag:(scope,key)=>flagOf(item,scope,key)},config);
  return {...rules,multiple:{...rules.multiple,maxStack:null}};
}
export function sameStackType(source, target, config) {
  const identity = stackIdentityOf(source, config);
  if (!identity || identity !== stackIdentityOf(target, config)) return false;
  // Each limited-use Item owns an independent counter. Merging documents
  // would silently discard one counter (even if both are unused).
  const sourceRules=getItemRules({getFlag:(scope,key)=>flagOf(source,scope,key)},config);
  const targetRules=getItemRules({getFlag:(scope,key)=>flagOf(target,scope,key)},config);
  if (sourceRules.limits.enabled || targetRules.limits.enabled) return false;
  // A storage-granting document is the provider for its own pouch IDs and
  // equipment capacity. Removing it during a stack merge would orphan any
  // contained Items; stacking providers also cannot represent multiple bags
  // with independent contents. Protect this in the shared identity check so
  // manual, automatic and cross-surface stacking all use the same rule.
  if (hasStorageGrants(sourceRules) || hasStorageGrants(targetRules)) return false;
  if (String(source?.type??'') !== String(target?.type??'') ||
      String(source?.img??'') !== String(target?.img??'')) return false;
  if (!sameStoredValue(comparableStackRules(source,config),comparableStackRules(target,config))) return false;
  // D&D system fields may also be edited on an individual stack. Quantity and
  // equipped are per-stack state; everything else must agree to avoid data loss.
  const system=item=>{
    const documentSystem=item?.system??item?.data?.system;
    // Foundry D&D SystemData is a DataModel, not a plain object. Extract its
    // serializable snapshot before comparing to imported Item objects.
    const raw=typeof documentSystem?.toObject==='function' ? documentSystem.toObject() : documentSystem;
    if(!raw || typeof raw!=='object')return {};
    const {quantity,equipped,...rest}=raw;
    return rest;
  };
  if (!sameStoredValue(system(source),system(target))) return false;
  // Native equipped state and unrelated module flags are *not* disposable
  // stack metadata. Losing either during merge silently destroys instance state.
  const equipped = item => Boolean(item?.system?.equipped ?? item?.data?.system?.equipped);
  if (equipped(source) !== equipped(target) || equipped(source)) return false;
  const otherFlags = item => {
    const raw = item?.flags ?? item?.data?.flags ?? {};
    const flags = typeof raw?.toObject === 'function' ? raw.toObject() : raw;
    if (!flags || typeof flags !== 'object') return {};
    const { [MODULE_ID]: _buxa, ...other } = flags;
    return other;
  };
  return sameStoredValue(otherFlags(source), otherFlags(target));
}
export function stackRoom(source, target, config) {
  if (!validStackQuantity(source) || !validStackQuantity(target) || !sameStackType(source, target, config)) return 0;
  // Both item types' limits apply if their configurations differ.
  return Math.max(0, Math.min(maxStackOf(source, config), maxStackOf(target, config)) - stackQuantity(target));
}
/** Fill existing partial stacks first. Returns a pure transfer plan; does not mutate documents. */
export function planStackTransfer(source, quantity, targets, config) {
  // A legacy corrupted quantity must never be interpreted as a single Item.
  // stackQuantity intentionally returns one for display compatibility only.
  if (!validStackQuantity(source) || stackQuantity(source) <= 0) throw Error('Invalid source stack quantity; source stack is empty or corrupt.');
  const count=Number(quantity);
  if(!Number.isSafeInteger(count) || count<0)throw Error('Invalid stack quantity for transfer.');
  let remaining = count;
  const merges = [];
  const seen = new Set();
  for (const target of targets) {
    if(!target || seen.has(target.id ?? target))continue;
    seen.add(target.id ?? target);
    if (remaining <= 0) break;
    const amount = Math.min(remaining, stackRoom(source, target, config));
    if (amount > 0) { merges.push({target, amount}); remaining -= amount; }
  }
  const chunks = [];
  const limit = maxStackOf(source, config);
  while (remaining > 0) {
    const amount = Math.min(limit, remaining);
    chunks.push(amount);
    remaining -= amount;
    if (chunks.length >= 1000 && remaining > 0) throw new Error('Too many new stacks required for this transfer.');
  }
  return {merges, chunks};
}
