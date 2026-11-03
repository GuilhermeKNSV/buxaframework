/** Shared safety for Actor progression writes. A rapid double click, two tabs, or
 * simultaneous level/attribute/resource edits must not spend the same points twice.
 * Locks are scoped to an Actor object and released even if Foundry rejects a write.
 */
const active = new WeakSet();
export async function withProgressMutation(actor, action) {
  if (!actor || typeof actor !== 'object') return false;
  if (active.has(actor)) return false;
  active.add(actor);
  try { return await action(); }
  finally { active.delete(actor); }
}
/** Foundry listeners are optional observers: a misbehaving addon must not make
 * a completed gameplay update appear failed and tempt the user to repeat it.
 */
export function emitProgressHook(name, ...args) {
  try { globalThis.Hooks?.callAll?.(name, ...args); }
  catch (error) { console.error(`buxaframework | Observer for ${name} failed after the update was saved.`, error); }
}
