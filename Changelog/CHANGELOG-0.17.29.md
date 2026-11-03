# Buxa Framework 0.17.29 — Sidebar folder navigation and dock placement

- Folder flyout entries now navigate through Foundry V14's public Sidebar `changeTab(id, "primary")` API, rather than synthesizing a click on a hidden native tab. Legacy native-click fallback remains for other sidebar builds.
- Selecting a folder entry leaves the horizontal folder strip open. The strip is preserved across sidebar rerenders when its contents have not changed, preventing flicker and lost click handlers.
- Clicking the already-active tab keeps the sidebar expanded; selecting a tab from a collapsed sidebar opens it.
- The Edit Buttons dock now prefers the far-left lower viewport edge (or far-right if the native sidebar is left), matching the screenshot. It moves inward only if an actual Foundry control or open window overlaps its footprint.
- Removed overly broad transparent UI-wrapper obstacles which could push the dock hundreds of pixels onto the board.
- No changes to saved layout format, folder contents, native UI controls, permissions, or corner radii.
- Added Foundry navigation and dock position regression tests.
