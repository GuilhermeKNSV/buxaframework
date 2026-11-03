/** Protection from click macros and hardware auto-clickers hitting the actor sheet.
 * Independent of DOM nodes so redraws cannot reset the limiter. Ordinary
 * double-clicks, keyboard activations, and short deliberate sequences pass.
 * Only *excessive sustained* click bursts enter a temporary cooldown.
 */
const DEFAULTS = Object.freeze({
  perControlLimit: 4,
  perControlWindowMs: 1300,
  sheetLimit: 12,
  sheetWindowMs: 850,
  cooldownMs: 950,
  resetAfterMs: 5000
});

function normalizedTime(value) { return Number.isFinite(value) ? value : Date.now(); }
export function createSheetClickSafety(options = {}) {
  const settings = { ...DEFAULTS, ...options };
  const hits = new Map();
  const sheetHits = [];
  let blockedUntil = -1;
  let lastSeen = -1;
  const trim = (array, cutoff) => {
    while (array.length && array[0] <= cutoff) array.shift();
  };
  return {
    accept(key, at = Date.now()) {
      const now = normalizedTime(at);
      // A new sheet session or an idle period has no residual penalty.
      if (now < lastSeen || now - lastSeen > settings.resetAfterMs) {
        hits.clear(); sheetHits.length = 0; blockedUntil = -1;
      }
      lastSeen = now;
      // An auto-clicker must stop before the sheet unlocks; otherwise a
      // sustained macro would sneak one more mutation through every second.
      if (now < blockedUntil) {
        blockedUntil = now + settings.cooldownMs;
        return false;
      }
      trim(sheetHits, now - settings.sheetWindowMs);
      const id = String(key || 'button');
      const current = hits.get(id) || [];
      trim(current, now - settings.perControlWindowMs);
      if (current.length >= settings.perControlLimit || sheetHits.length >= settings.sheetLimit) {
        blockedUntil = now + settings.cooldownMs;
        return false;
      }
      current.push(now);
      hits.set(id, current);
      sheetHits.push(now);
      // Avoid indefinite memory growth as the user visits many inventory tabs.
      if (hits.size > 160) for (const [id, series] of hits) {
        trim(series, now - settings.perControlWindowMs);
        if (!series.length) hits.delete(id);
      }
      return true;
    },
    reset() { hits.clear(); sheetHits.length = 0; blockedUntil = -1; lastSeen = -1; }
  };
}

/** Stable across template rerenders: does not depend on the current DOM node,
 * current text (which changes after a level-up), or transient disabled state. */
/** Distinguish repeated controls that share an action/tooltip but operate on
 * different item rows. Use stable template data and layout order, not DOM
 * object identity (which changes on every sheet rerender). */
function stableButtonPath(button, owner) {
  const segments=[];
  let current=button;
  for (let depth=0; current && current!==owner && depth<4; depth++) {
    const parent=current.parentElement;
    if (!parent) break;
    const index=[...(parent.children||[])].indexOf(current);
    segments.push(`${current.localName||'element'}:${index}`);
    current=parent;
  }
  return segments.join('/');
}
export function sheetButtonIdentity(button) {
  if (!button) return 'button';
  const data = button.dataset || {};
  const fields = [
    'action', 'sheetTab', 'attributeId', 'attributeNumber', 'proficiencyId',
    'resourceId', 'resourceTrackToggle', 'itemId', 'storageId', 'equipmentSlot',
    'inventoryIndex', 'storageIndex', 'tab', 'slot', 'hotbarSlot', 'id'
  ];
  const known = fields.filter(field => data[field] != null && data[field] !== '')
    .map(field => `${field}=${data[field]}`);
  const owner = button.closest?.('[data-item-id],[data-slot-id],[data-resource-id],[data-attribute-card],[data-proficiency-id],[data-entry-id]');
  const ownerId = owner ? Object.entries(owner.dataset || {}).filter(([k])=>
    ['itemId','slotId','resourceId','attributeCard','proficiencyId','entryId'].includes(k))
    .map(([k,v])=>`${k}=${v}`).join('|') : '';
  const context = ownerId ? `owner:${ownerId}` : stableButtonPath(button,owner);
  if (known.length) return `${known.join('|')}|${context}`;
  const name = button.getAttribute?.('name') || button.getAttribute?.('aria-label')
    || button.getAttribute?.('title') || button.getAttribute?.('data-tooltip') || '';
  if (name) return `${button.localName || 'button'}:${name}:${context}:${stableButtonPath(button,owner)}`;
  return `${button.localName || 'button'}:${context}`;
}

/** Fail closed for click handlers on rapidly replaced controls. Do not intercept
 * normal typing, scrolling, drag starts, or non-click pointer interactions. */
export function installSheetClickSafety(root, guard) {
  if (!root?.addEventListener || !guard?.accept) return () => {};
  const listener = event => {
    const target = event.target;
    const button = target?.closest?.('button, [role="button"], [data-action], [data-sheet-tab], [data-resource-track-toggle]');
    if (!button || !root.contains?.(button)) return;
    // Foundry's window close/minimize controls must remain usable even while
    // a click macro is active in the sheet content.
    if (button.closest?.('.window-header, .window-controls, .header-control')) return;
    // Ignore click events emitted from an already-disabled control.
    if (button.disabled || button.getAttribute?.('aria-disabled') === 'true') return;
    if (guard.accept(sheetButtonIdentity(button))) return;
    event.preventDefault?.();
    event.stopImmediatePropagation?.();
    event.stopPropagation?.();
  };
  root.addEventListener('click', listener, true);
  root.addEventListener('contextmenu', listener, true);
  return () => {
    root.removeEventListener?.('click', listener, true);
    root.removeEventListener?.('contextmenu', listener, true);
  };
}
