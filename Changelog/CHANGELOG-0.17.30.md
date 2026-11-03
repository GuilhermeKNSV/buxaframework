# Buxa Framework 0.17.30 — Sidebar editor follows Foundry UI

- The horizontal folder flyout now anchors outside the full expanded Foundry sidebar, rather than overlapping the sidebar contents. It follows the sidebar when expanded/collapsed/resized, preserving native-sized icon buttons and the open folder.
- The edit dock moves below the GM Controls panel in the stacking order when GM Controls opens and returns to normal when it closes. The dock is not pushed into the middle of the scene.
- Added targeted short-duration UI transition tracking and ResizeObserver updates without idle polling.
- All layouts, flags, edit interactions and square corners are unchanged.
- Added regression tests for expanded/collapsed left/right sidebars and GM layering.
