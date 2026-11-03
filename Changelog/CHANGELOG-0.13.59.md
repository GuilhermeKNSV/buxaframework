# Buxa Framework 0.13.59 — Board-to-crate auto-placement fix

- Fix scene Item -> crate sprite drops incorrectly rejecting usable storage with "No compatible space for this item's configured footprint". The sprite target has no `valid` flag because it does not identify a specific storage cell; the old handler treated that as an invalid manual grid placement.
- Distinguish **explicit grid drops** from **automatic crate-sprite drops**. Grid drops still require a valid planned target; sprite drops let the authoritative GM placement resolver find free cells and item rotations across compartments.
- Added an integration regression using the pictured 5×4 chest layout with two axes and a stack of coins: a 2×3 sword now enters at index 5, with all previous contents intact. The regression fails against the v0.13.58 source and passes with this fix.
- No item flag migrations, shape changes, or automatic movement of existing chest contents.
- Automated tests: 632/632 passed. JavaScript syntax and architecture checks passed. Live Foundry V14 validation still required.
