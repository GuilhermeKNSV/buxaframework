# Buxa Framework v0.13.60 — Source audit and targeted repairs

Audit basis: complete uploaded v0.13.59 ZIP (Foundry V14, dnd5e 6.0.x). The baseline contained 632 passing Node tests. This is a source-level review, **not** an in-Foundry acceptance test.

## Confirmed issues reproduced and fixed

1. **Unsafe stack merges — high priority (data integrity).** `scripts/core/stack-capacity.js` used a shared `stackKey`/origin or name+image as sufficient proof that two stackable items were equivalent. Changing an individual item's rarity, effects in Buxa rules, or other saved configuration without changing its key could merge that item into a different instance and lose its distinct properties. Stack compatibility now also compares Buxa rules, item type/base artwork and serializable system fields (excluding per-stack quantity and equipped state). Stack limits can still differ: the smaller limit controls merge capacity. Actor's automatic receiver now uses this same compatibility check as ground storage and manual merges.
2. **Incorrect image library “In Use” status — confirmed.** `scripts/core/asset-browser-model.js` scanned the legacy monolithic `physicalSceneItems` store instead of the authoritative v2 per-scene physical item records. It also missed quantity-dependent replacement/composite stack artwork and contained portable Item snapshots. The picker now scans authoritative scene partition records (falling back to legacy only for unmigrated scenes), ordinary and nested Item artwork, replacement art and compositing layers. Board-item indexing remains GM-only.
3. **Rotated equipment swap displaced a valid item — confirmed.** `scripts/core/inventory.js` checked whether a displaced item could occupy a vacated Complex cell using rotation 0, then saved the *other item's* actual source rotation. At an edge this rejected a legally fitting 1×2 item or could mismatch the validated shape. Collision checks now use the rotation that will actually be saved.

## Tests

- New `tests/audit-01360-regressions.test.mjs` initially failed both tests on v0.13.59: incompatible rarity/bonus stacking, and missing authoritative board/variant artwork usage.
- Additional equipment swap test in `tests/inventory-integrity-v01130.test.mjs` initially failed on v0.13.59 (expected source index 3, got index 0).
- All **635/635** Node tests passed after fixes, including prior inventory, storage, directory, scene and image picker tests. JS syntax, architecture and ZIP checks completed before packaging.
- No migration of Actor, Item or world data is required. Existing distinct Items are not merged retroactively.

## Remaining audit findings / deferred work

1. **High-risk runtime path: closed and repeated backpack round trips.** `scripts/core/backpack-transfers.js` plus `scripts/integrations/physical-item-transfers.js` still coordinate Actor flag writes, reserved child IDs, embedded Item creation, and rollback. These operations are covered with mocks but not a genuine Foundry V14 host session. Confirm live transfers with 3–5 different rotated/irregular items, open/closed storage, and multiple consecutive pickup/drop cycles before considering this path stable.
2. **Potential pointer lag in filled chests.** `scripts/apps/ground-container-window.js` calls `groundMoveWithin()` during pointer moves; that helper clones and validates the entire portable contents structure. `scripts/core/ground-drop-intent.js` can try rotations and every cell for new targets. Cache-by-cell helps, but performance with large bags and deep nesting has not been profiled. Refactor toward one occupancy map per drag and avoid whole-container clones on every movement.
3. **Stack-image editor UX gap.** `scripts/apps/item-stack-editor.js` treats the close (×) button like Done, mutating the draft directly. There is no true Cancel or Escape handling for that dialog. This is usable, but surprises users who close without intending to keep composition changes. A follow-up should introduce temporary draft layers and explicit Apply/Cancel, with pointer listener cleanup.
4. **Large controllers remain coupled.** `scripts/integrations/physical-item-transfers.js` (~675 lines), `scripts/apps/inventory-controls.js` (~687 lines) and `templates/item-config.hbs` (~498 lines) exceed the project's soft architecture targets. The architecture check still passes, but further splitting would make future bug isolation easier.
5. **Cross-surface pointer routing remains live-only.** Overlapping Foundry windows, hit-testing under canvas sprites, and native document update hooks cannot be fully confirmed in Node mocks. Test with actual V14/6.0.x, not just assertions on source strings.

The deferred findings are not labeled “fixed” and do not imply their features are definitely broken. They are areas where source evidence justifies further targeted testing or refactoring.
