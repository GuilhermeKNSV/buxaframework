## 0.13.47 — Closed backpack transfer recovery without Overflow

- Prevent Buxa's Item lifecycle hooks from re-running Actor inventory reconciliation in the middle of GM-authoritative physical transfers, or after an internal Item snapshot update.
- Keep valid board-container item positions and rotations when restoring into an Actor. If a previously saved child no longer fits its original position, find a safe cell within its own compartment (not the Actor main inventory or Overflow); preserve unrelated Items.
- If the contained item cannot fit anywhere in its original compartment, abort the pickup and roll back created embedded Items. The chest and its contents remain on the board, instead of producing a false successful transfer and a broken backpack.
- Repair older Actor backpack placements still pointing at invalid storage coordinates when the owner tries to transfer the backpack. Contained Items are included in the transfer rather than dropped/left behind in Overflow.
- Add regression coverage for legacy placements, no-fit rollback, hooked transaction guards, closed chests with rotated/shaped contents, and moving/retransferring the repaired backpack.
- Automated tests and syntax/architecture checks passed; live Foundry V14 behavior still requires confirmation.
