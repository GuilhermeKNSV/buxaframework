/** Local actor-scoped transactions for operations that cannot interleave.
 * Resource payments reject overlapping uses rather than enqueueing stale rolls.
 * Stack edits queue and re-read quantity after the previous mutation finishes.
 * The GM physical-transfer ledger remains the cross-client authority. */
const resources = new Set();
const stacks = new Map();
const keyFor = actor => String(actor?.uuid || actor?.id || '');
export function beginActorResourceUse(actor) {
  const key = keyFor(actor);
  if (!key) throw Error('Cannot use an item without a linked Actor.');
  if (resources.has(key)) throw Error('Another Item action is already updating this Actor. Retry in a moment.');
  resources.add(key);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    resources.delete(key);
  };
}
export function withActorStackMutation(actor, fn) {
  const key = keyFor(actor);
  if (!key) return Promise.reject(Error('Cannot edit stacks without an Actor.'));
  const prev = stacks.get(key) || Promise.resolve();
  const pending = prev.catch(() => {}).then(fn);
  const settled = pending.catch(() => {});
  stacks.set(key, settled);
  void settled.finally(() => { if (stacks.get(key) === settled) stacks.delete(key); });
  return pending;
}
