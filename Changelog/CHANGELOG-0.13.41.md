# v0.13.41 — Item and Complex Inventory Fixes

- Double-click an artwork tile to choose it immediately. A commit lock avoids invoking the selection callback twice from the native click and double-click events.
- Item Sheet storage tooltip: choose the accent color from **any configured rarity**, the item's own rarity, neutral, or a custom hex color. Persist the chosen rarity ID.
- Item names preserve their exact capitalization in the Item Sheet hero.
- The Item Sheet now respects custom and rarity-derived increase/dice colors instead of silently forcing them to gray.
- Item defaults: **Not Equippable** and **Storage Tooltip off** until explicitly enabled. Previously saved true/false values remain intact.
- Stackable quantity editor: constrain segmented controls and Max Stack fields to the Basic tab's width; preserve scrolling and footer positioning.
- Complex inventory hit testing: only occupied **grid cells** receive pointer events; artwork and piece overlays cannot steal clicks from adjacent shapes or holes. Existing board hit bindings forward drags, item inspection and context menu actions.
- A version 4+ saved invalid/overlapping Complex placement goes to Overflow instead of being silently relocated to an unrelated free slot. Existing valid placements remain unchanged. Legacy placement migration still uses first-fit.

Automated tests: 574/574 passed. Syntax checks passed; architecture check passed with eight pre-existing soft-size warnings. Chromium DOM hit testing confirmed logical grid-cell ownership. Live Foundry V14 integration needs user verification.
