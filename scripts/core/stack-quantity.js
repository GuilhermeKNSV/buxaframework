/** Validate the raw quantity before a destructive stack action. */
export function validStackQuantity(item) {
  const raw = globalThis.foundry?.utils?.getProperty?.(item, 'system.quantity') ?? item?.system?.quantity;
  if (typeof raw !== 'number' && typeof raw !== 'string') return false;
  if (typeof raw === 'string' && !raw.trim()) return false;
  const quantity = Number(raw);
  return Number.isSafeInteger(quantity) && quantity >= 0;
}
