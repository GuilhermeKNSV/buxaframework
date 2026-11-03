# Buxa Framework v0.17.19 — Sidebar Edit Mode Interaction Fixes

## Fixed
- **No tab activation in Edit Buttons mode.** Foundry V14 and other sidebar extensions can attach activation listeners to ancestors of the sidebar tab bar or to pointer/mouse events before a `click`. New `sidebar-edit-interaction-lock.js` intercepts those events at window capture and routes edit gestures to the sidebar editor, without letting native tabs open while editing.
- Right-click now routes to the sidebar editor's context menu only; blank-area right-click still opens the hidden-button drawer.
- Left-clicking native tabs while editing never navigates, including double-clicks, pointer events, touch activation and keyboard activation. The editor launcher remains active to exit mode.
- Normal sidebar button navigation remains unchanged outside Edit Mode.
- All editor UI elements have **square, 0px corners** (toolbar, buttons, context menu, dialogs, drawers, folders, badges, drag ghost, placeholder and form controls). Soft shadows and animations are preserved.

## Verification
- 2,912 / 2,912 automated tests passed, including 5 new regressions.
- Architecture check passed (12 nonfatal size warnings).
- Headless Chromium smoke test: tabs blocked on left/right click in Edit Mode; right-click handled by editor; launcher usable; tab navigation restored outside Edit Mode; computed corner radii verified as 0px.
- Live Foundry V14 integration testing is still recommended.
