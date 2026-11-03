/** Guard Foundry sidebar navigation while Buxa's layout editor is active.
 * Foundry V14 may delegate native tab activation to ancestors of the sidebar
 * navigation (or listen to pointer/mouse events), so blocking clicks on the
 * nav alone is too late. Capture at window BEFORE those listeners run.
 * Outside Edit Mode nothing is intercepted. The editor launcher is exempt.
 */
const NATIVE_EVENTS = [
  'pointerdown', 'pointermove', 'pointerup', 'pointercancel',
  'mousedown', 'mouseup', 'click', 'auxclick', 'dblclick', 'contextmenu',
  'touchstart', 'touchmove', 'touchend', 'touchcancel', 'keydown', 'keyup'
];

export function blockNativeSidebarEvent(editor, event) {
  if (!editor.edit || !editor.nav?.isConnected || !event.target) return false;
  if (!editor.nav.contains(event.target)) return false;
  if (editor.editButton?.contains(event.target)) return false;
  if (!editor.saving) {
    switch (event.type) {
      case 'pointerdown': editor.onDown(event); break;
      case 'pointermove': editor.onMove(event); break;
      case 'pointerup': editor.onUp(event); break;
      case 'pointercancel': editor.cancelDrag(); break;
      case 'click': editor.onNavClick(event); break;
      case 'contextmenu': editor.onContext(event); break;
      case 'keydown':
        if (event.key === 'Tab') return false; // keyboard focus navigation
        if (event.key === 'Escape') {
          editor.cancelDrag(); editor.closeMenu(); editor.closeFlyout(); editor.closeDialog();
        } else editor.onNavKey(event);
        break;
      case 'keyup': if (event.key === 'Tab') return false; break;
      default: break;
    }
  }
  if (event.cancelable && event.type !== 'pointermove' && event.type !== 'keyup') event.preventDefault();
  event.stopImmediatePropagation();
  return true;
}

export function installSidebarNativeLock(editor, signal) {
  for (const type of NATIVE_EVENTS) {
    window.addEventListener(type, event => blockNativeSidebarEvent(editor, event),
      {capture: true, signal});
  }
}
