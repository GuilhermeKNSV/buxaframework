# Buxa Framework v0.13.51 — Root-scoped closed-storage Actor save

- Addresses the v0.13.50 failure at `restoreBackpackContents` where `Actor5e.update()` routes a world Actor inventory flag update through an invalid embedded Actor context (`Actor is not a valid embedded Document within the Actor Document`).
- World Actor backpack placement/repair writes now use `Actor.implementation.updateDocuments` with an explicit `parent: null` and a world Actor `_id`. This uses Foundry's documented top-level document update path instead of `actor.update()` for that operation.
- Synthetic token Actors keep using their instance update path to avoid writing their world template.
- Confirms committed inventory placements before creating backpack children. The existing transaction keeps the chest on the board and rolls back the destination if a save fails.
- Regression test reproduces the exact error on the previous v0.13.50 code; the new root-scoped update route passes. A second test verifies scene contents remain when the root document write fails.
- 597 automated tests passed, architecture and ZIP checks passed. Real Foundry V14 testing still required.
