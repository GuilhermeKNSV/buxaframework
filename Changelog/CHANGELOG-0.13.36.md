# Buxa Framework v0.13.36

- Fixed native drag-and-drop from the Buxa Item Directory onto the Foundry scene board. The Item Directory previously set `effectAllowed: move` while the board's browser drop target required `dropEffect: copy`, so Chromium rejected the operation.
- Corrected both main Item Directory cards and items inside open left-side folder panels to use `copyMove` on dragstart. Scene/Actor/container drops copy world Item templates; folder reordering still moves cards.
- Added regression coverage for drag-effect compatibility and preserved source Item UUID payloads.

No world data migration required. Real Foundry browser playtesting still recommended.
