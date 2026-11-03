## 0.13.44 — Restore ground-storage drag/drop hitboxes

- Restore pointer hits on **occupied item cells** inside an open board storage window. The v0.13.41 inventory-specific CSS pointer filter accidentally disabled every chest item's interactive piece, without installing the Actor inventory's replacement cell-routing handler in this window.
- Keep item artwork and empty/irregular-shape portions noninteractive so pointers still reach the correct underlying storage squares. Ground container cells remain available as destinations for Actor, board and World Item drags.
- Preserve the v0.13.42 nested-backpack transfer fix and v0.13.43 ground drag lifecycle fix, including rotation and GM-authoritative writes. No data migration.
- Add regression test for the CSS interaction contract and run a real Chromium DOM hit-test: item pointerdown receives the event and an empty neighboring cell remains independently targetable.
