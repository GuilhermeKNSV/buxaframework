# Buxa Framework 0.17.31 — Sidebar folder placement and live reflow

- Fix folder icon strips floating on top of the Items/Scenes directory header after native sidebar expansion.
- Follow sidebar layout changes even **outside** Edit Buttons mode; folder flyouts remain interactive and stay open after switching tabs.
- Resolve folder placement from the visible native sidebar content pane, not solely from the navigation rail or the viewport half. Properly ignore full-viewport sidebar wrappers.
- Position expanded-folder controls on the free side of the Foundry directory. When the window is too narrow for a horizontal row, use a compact **vertical** square-icon strip in the available gutter instead of covering native UI.
- Keep the normal horizontal native-sized folder strip where space permits, including animations and reduced-motion settings.
- Observe sidebar panel and tab dimensions and follow transition motion so expansion/collapse repositions the flyout promptly.
- Extract positioning into `sidebar-folder-flyout-position.js`, retaining module file-size architecture limits.
- Add `sidebar-flyout-reflow-v01731.test.mjs` regression tests for narrow panes, wide right sidebars, wrapper geometry, and normal-mode follow. Update source-assumption tests for the extracted positioning helper.

No changes to sidebar layout persistence, visibility permissions, folder membership, tab navigation, game logic, or GM Controls.

Verification: 2,968 source tests pass; architecture check passes (nonfatal soft size warnings). Live Foundry visual verification remains necessary.
