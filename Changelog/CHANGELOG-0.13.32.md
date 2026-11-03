# Buxa Framework 0.13.32 — Storage cell repair

- Custom storage painter: use capture-phase secondary pointer presses to remove selected cells even when Foundry intercepts native context menus. The native context menu remains a fallback.
- Do not permit deleting the last active cell or a bridge cell that would disconnect the storage footprint. Expose the reason on hover and when removal is attempted.
- Ground storage: quarantine pre-existing saved contents whose positions are outside the current custom mask or overlap another saved item. Keep every serialized item intact and offer an “Unplaced items” recovery strip so they can be dragged back to valid cells.
- Preserve original compartment indices, nested content data, normal compact layout, and existing transfer mechanisms. The recovery strip is shown only when invalid placements exist.
- Added regression tests covering removal, mask mismatches, collisions, full preservation and recovery moves.

Validation: automated Node suite, JavaScript syntax, architecture, ZIP integrity. Live Foundry 14 UI behavior must still be verified.
