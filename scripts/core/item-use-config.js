import { formatItemDiceFormula } from './item-formula-display.js';
import { numericField, booleanField } from './numeric-field.js';
/** Persistence model for Item Resource and Limits; missing fields are inert for legacy Items. */
const integer = (value, fallback, min, max) => {
  return numericField(value, fallback, min, max, true);
};
const numeric = (value, fallback, min, max) => {
  return numericField(value, fallback, min, max);
};
export function normalizeItemResourceEffects(input) {
  if (!Array.isArray(input)) return [];
  const ids = new Set();
  return input.slice(0, 32).map((value, index) => {
    const raw = value && typeof value === 'object' ? value : {};
    const base = String(raw.id || `resource-${index + 1}`).slice(0, 60);
    let id=base, suffix=2;
    while (ids.has(id)) {
      const part=`-${suffix++}`;
      id=`${base.slice(0,60-part.length)}${part}`;
    }
    ids.add(id);
    const attr = raw.attributeDice && typeof raw.attributeDice === 'object' ? raw.attributeDice : {};
    const modifier = raw.modifier && typeof raw.modifier === 'object' ? raw.modifier : {};
    return {
      id, resourceId: String(raw.resourceId || '').slice(0, 100),
      action: raw.action === 'fill' ? 'fill' : 'drain',
      timing: raw.timing === 'after' ? 'after' : 'before',
      amountType: ['flat','percent','dice'].includes(raw.amountType) ? raw.amountType : 'flat',
      amount: numeric(raw.amount, 1, 0, 1000000),
      count: integer(raw.count, 1, 0, 100), faces: integer(raw.faces, 10, 2, 1000),
      attributeDice: { enabled: booleanField(attr.enabled), attributeId: String(attr.attributeId || '').slice(0, 100), faces: integer(attr.faces, 10, 2, 1000) },
      modifier: { source: ['attribute','proficiency'].includes(modifier.source) ? modifier.source : 'none', id: String(modifier.id || '').slice(0, 100) },
      flat: numeric(raw.flat, 0, -1000000, 1000000),
      rollMode: ['advantage','disadvantage'].includes(raw.rollMode) ? raw.rollMode : 'normal'
    };
  });
}
export function normalizeItemRecharge(input) {
  const raw = input && typeof input === 'object' ? input : {};
  const method = key => {
    const entry = raw[key] && typeof raw[key] === 'object' ? raw[key] : {};
    return {enabled: booleanField(entry.enabled),
      charges: integer(entry.charges, 1, 1, 999999),
      ...(key === 'button' ? {
        resourceId: String(entry.resourceId || '').slice(0, 100),
        cost: numeric(entry.cost, 0, 0, 1000000),
        costType: entry.costType === 'percent' ? 'percent' : 'flat'
      } : {}),
      ...(key === 'item' ? {templateId:String(entry.templateId || '').slice(0, 128)} : {}),
      ...(key === 'combat' ? {everyTurns:integer(entry.everyTurns, 1, 1, 999999)} : {})
    };
  };
  return {button:method('button'), item:method('item'), combat:method('combat')};
}
export function rechargeRemainingUses(limits, usage, amount) {
  const left = remainingItemUses(limits, usage);
  return left === null ? null : Math.min(limits.maxUses, Math.max(0,left + Math.max(0,Math.trunc(Number(amount)||0))));
}
export function rechargeItemUsage(limits, usage, amount) {
  const normalized = normalizeItemUsage(usage);
  // When the GM lowers Max Uses below a previously spent count, the item is
  // exhausted, not indebted for hundreds of invisible future charges.
  return {used:Math.max(0,Math.min(limits.maxUses,normalized.used) - Math.max(0,Math.trunc(Number(amount)||0)))};
}
export function normalizeItemLimits(input) {
  const raw = input && typeof input === 'object' ? input : {};
  return {
    enabled: booleanField(raw.enabled),
    maxUses: integer(raw.maxUses, 4, 1, 999999),
    onExhaust: ['disable','destroy','transform'].includes(raw.onExhaust) ? raw.onExhaust : 'disable',
    transformItemId: String(raw.transformItemId || '').slice(0, 128),
    recharge: normalizeItemRecharge(raw.recharge)
  };
}
export function normalizeItemUsage(input) {
  const raw = input && typeof input === 'object' ? input : {};
  return { used: integer(raw.used, 0, 0, 999999) };
}
export function remainingItemUses(limits, usage) {
  return !limits?.enabled ? null : Math.max(0, limits.maxUses - normalizeItemUsage(usage).used);
}
export function itemIsExhausted(limits, usage) { return limits?.enabled && remainingItemUses(limits, usage) === 0; }
export function formatResourceEffect(entry, resourceName = 'Resource') {
  const amount = entry.amountType === 'dice'
    ? formatItemDiceFormula({
      count:entry.attributeDice?.enabled ? 1 : entry.count,
      faces:entry.attributeDice?.enabled ? entry.attributeDice.faces : entry.faces,
      bonus:entry.flat,
      unresolvedModifier:['attribute','proficiency'].includes(entry.modifier?.source) ? 'MOD' : ''
    })
    : `${entry.amount}${entry.amountType === 'percent' ? '%' : ''}`;
  return `${entry.action === 'fill' ? 'Restore' : 'Drain'} ${amount} ${resourceName} · ${entry.timing === 'after' ? 'After' : 'Before'} roll`;
}
