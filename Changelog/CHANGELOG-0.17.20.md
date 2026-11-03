# Buxa Framework v0.17.20 — Edit Buttons UI polish

- Replaced the large top-left sidebar editor panel with a compact 52px glass control dock anchored beside the native sidebar tab column.
- Split Save into a primary personal Save action and optional GM Save-for-everyone menu; moved both reset actions into More.
- Added compact Snap-to-Grid and Auto-Align state indicators, hover labels, and collapsible dock controls.
- Replaced the rectangular right-click list with staggered circular Hide/Delete/folder action bubbles and off-screen-safe positioning.
- Replaced dimmed full-screen dialogs with contextual floating cards for visibility scope, folder naming, and icon selection.
- Repositioned the hidden buttons tray and folder flyouts beside the sidebar, clear of the control dock and native tabs.
- Added close/exit and pop/slide transitions; respected reduced-motion preferences and added CSS theme variables.
- Preserved user flags, world settings, visibility permissions, layout shape, native tab interaction locking, and drag-and-drop behavior.
- Fixed a hidden player-checklist presentation bug: the specific-player list is hidden until that option is selected.
- Extracted presentation-only dock methods into `scripts/apps/sidebar-edit-dock.js` to preserve architecture limits.

## Verification
- 2,917/2,917 Node regression tests passed.
- Browser smoke test verified tool-dock placement, bubble actions, floating visibility card with no backdrop, and Save-for-me operation.
- Architecture check passed (12 existing soft file-size warnings).
- Visual integration in Foundry V14 remains to be confirmed in an actual game.
