## 0.13.48 — Match closed-chest pickup to visible storage cell geometry

- Fix the underlying mismatch between open scene chests and Actor storage: shaped items are positioned by the bounding-box origin, which may be an *empty* cell outside the storage mask. The Actor's `validLocation` wrongly demanded that origin be a valid storage square, even when every occupied footprint cell was legal. This rejected legitimate axe/sword/glove arrangements during closed-chest pickup.
- Keep exact occupied-cell geometry authoritative through `fitsExternalStorage` for all Actor storage movement and reconciliation. Cells actually outside the mask, overlapping other items or off-grid are still rejected; only the unnecessary bounding-origin rule was removed.
- Closed-chest pickup now preserves valid irregular/rotated item placements without repacking, repair, Overflow, or an unnecessary transaction rollback. The restored backpack remains movable after pickup.
- Add an end-to-end board-chest pickup test with four closely packed items, including a masked-out top-left origin, and three parity tests comparing open ground storage with Actor storage for all four rotations, neighbor collisions, and forbidden cells.
- No data migration or modified contents are required; previously saved valid positions remain as-is. Foundry V14 runtime testing still required.
