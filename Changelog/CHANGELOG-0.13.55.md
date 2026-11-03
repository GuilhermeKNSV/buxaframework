# Buxa Framework v0.13.55 — Code audit and transfer-safety hardening

- **Fresh Foundry operation options:** Stacking, native Item import, moved-item auto-stacking, and manual merge/rollback now generate a separate options object for each embedded Item action. This prevents Foundry-added `parent` and `pack` fields from leaking between document operations.
- **Do not silently discard corrupted chest contents:** Non-array `backpackContents` metadata is now rejected instead of interpreted as an empty chest. Such a transfer remains blocked until the GM repairs the saved data.
- **Ground storage validation:** Nested bundle rotations must use supported quarter-turns (0–3); invalid metadata is rejected before persistence.
- **Pointer accuracy:** A chest drop on window chrome, a scrollbar, or a masked-out/unusable grid cell cannot silently auto-place an Item somewhere else. Legitimate drops inside grid cells still run the existing validated placement planner.
- **Repair transparency:** If the Actor rejects a repaired backpack placement and the rollback also fails, the module reports that rollback failure explicitly rather than swallowing it and claiming nothing changed.
- Five new regression tests cover Item-option mutation during create/update/delete/rollback, malformed packed metadata, and invalid rotations. 607/607 automated tests pass; all 161 JS files pass `node --check`; architecture validation passes with nine pre-existing soft-size warnings.
- No migration, saved Item flags changes, or feature removal. Actual Foundry V14 interactions, especially ground-storage drag/drop and repeated backpack transfers, remain **unverified in a running Foundry world**.
