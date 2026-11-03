# Buxa Framework v0.17.17 — Sidebar Edit Buttons

## Feature

- Adds an **Edit Buttons** control to the bottom of the native Foundry VTT v14 sidebar tab navigation.
- Edit Mode: subtle icon wiggle, drag pickup ghost/pop, animated insertion slot, neighboring tab repositioning, drop spring, Cancel, Save for me, GM-only Save for everyone, Reset to Default, Reset to world default, Snap to Grid, Auto-Align, and Add Folder.
- Context menu: Hide and Delete for individual sidebar buttons. The **Settings** button is protected against deletion, hiding, or placement in a folder.
- Hide modal: **Only me**, plus GM-only **All players** and **Specific players** with a user checklist. GM-wide hiding requires Save for everyone.
- Right-click empty sidebar tab rail during Edit Mode to open the **Hidden Buttons** drawer. Drag a button back onto the rail or click it to restore (GM-enforced visibility cannot be overridden by players).
- Folders can contain multiple native tab actions, be rearranged, renamed and deleted, use Font Awesome icon classes, and pick SVG/images from Buxa's Asset Browser. Clicking a folder opens or closes a staggered side flyout. The flyout remains open until clicked again or edit mode closes.
- Persistence: personal layout through `User` document flags; shared GM layout and player visibility through a world setting. Personal layouts take precedence over the shared ordering, but not GM-enforced visibility rules.
- Supports the native Collapse button when present; retains native sidebar tab elements and Foundry handlers. No changes to existing tab content or combat logic.
- Responsive modal/toolbar/drawer, accessibility labels, keyboard reordering, reduced-motion accommodations.

## QA

- `node --test tests/*.test.mjs` — 2,907 passed.
- `node check-architecture.mjs` — passed with pre-existing and one new soft file-size warning.
- Browser smoke simulation: edit mode, folder creation, personal save, context menu hide, drawer restore, drag into folder, folder open/close, protected Settings actions and GM worldwide visibility save all exercised without JS exceptions.
- **Live Foundry V14 integration is still required**, especially compatibility with other modules which replace sidebar navigation elements and clients with nonstandard tab markup.

## Implementation

- `scripts/core/sidebar-button-layout.js` — pure normalized and protected layout model.
- `scripts/apps/sidebar-edit-buttons.js` — sidebar controller and interactive UI.
- `styles/181-sidebar-edit-buttons.css` — all presentation and motion, scoped to the editor.
- `tests/sidebar-buttons-v01717.test.mjs` — normalization, drag model, security and permissions coverage.
