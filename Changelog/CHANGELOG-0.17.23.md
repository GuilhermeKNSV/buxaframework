# Buxa Framework v0.17.23 — Sidebar Edit Buttons Layout & Drag Polish

## Changes

- **Lower-left dock:** positioned just beyond Foundry's left-side controls, in the lower-left area of the viewport instead of drifting into the middle of the board. The other side of the native sidebar remains unchanged. Placement still checks visible Foundry panels and open application windows, and stays in viewport bounds.
- **Stable collapse/expand:** dock reserves its fully expanded footprint for positioning. Collapsing, expanding, or rerendering the sidebar does not use the collapsed height to move the dock. An open Foundry window can still force the dock to an available location.
- **Folder flyouts:** replaced tall text-card folder menus with a compact, single-row, icon-only strip that opens directly beside the folder button toward the screen center. Each icon retains the native tab's function and accessible label. Oversized folders scroll horizontally instead of covering the sidebar.
- **Faster drag response:** draggable ghost follows pointer coordinates using compositor translation; insertion hit-testing is throttled to one pass per animation frame. Neighbor shift animations use a shorter 135ms transition and cancel previous moves so effects no longer build up.
- **Square corners:** no rounded borders were introduced. Reduced-motion behavior and the native-tab edit-mode interaction lock remain intact.

## Unchanged

User/world layout save formats, folder membership, permissions, hide/delete, restore, native sidebar behavior, and all underlying gameplay features.

## Verification

- 2,931/2,931 Node tests passed.
- Architecture check passed (12 nonfatal existing file-length warnings).
- Chromium page navigation was blocked by the execution environment. Live Foundry placement and drag feel still need in-game verification.
