# Buxa Framework v0.13.55 — Source Audit Notes

## Scope
Reviewed the module entry points, Actor and ground-storage transfer paths, inventory validation, item stack/import flows, serialized backpack contents, socket transaction ledger, and the open-container pointer handlers. Compared against the v0.13.54 release and ran the complete Node regression suite.

## Changes applied
1. Replaced shared mutable Foundry options in four stack/update paths. This addresses a demonstrated regression where a mocked Foundry method inserts `parent` and `pack` into the options and the next operation inherits an invalid context.
2. Rejected non-array serialized backpack contents rather than converting them into an empty bundle, a potential data-loss scenario during transfers.
3. Refused invalid quarter-turn rotations in nested ground-item bundles.
4. Required a real grid cell for pointer placement into open ground storage, avoiding accidental auto-placement from the header, scrollbars or masked cells.
5. Made failed backpack repair rollback visible rather than ignoring the error.

## Verification
- Node tests: 607 passed / 0 failed (602 baseline plus five new test cases).
- `node --check` for every JS module: passed.
- Architecture guard: passed; nine soft-limit warnings predate this release.
- ZIP: full Foundry install folder packaged and integrity checked.

## Remaining review targets (not claimed fixed)
- Real Foundry V14 drag/drop pointer capture across canvas and movable windows.
- Repeated Actor ↔ ground-container transfers, especially with nested shaped Items, concurrent hooks and token Actors.
- CSS/component sprawl and the nine soft-size warnings (large controllers/templates need a deliberate extraction, not a blind rewrite).
- Transaction rollback under real Foundry permissions, socket disconnections and post-write hook failures.

No live Foundry session was available to validate those runtime-specific interactions.
