# Buxa Framework v0.13.83 — Simple inventory / storage audit

- Fixed dragging and picking up items from a Simple-mode external storage compartment. Even if an Item has a large Complex footprint, its Simple pouch placement uses exactly one tile.
- Dropping on a pouch header now automatically chooses a valid free cell (respecting the custom mask) rather than failing on the first occupied/disabled tile. The same behavior is available through the inventory move runtime.
- Compatible stacks can now merge when dropped onto occupied Simple storage cells; incompatible items remain in place without overlap.
- Moved pointer storage resolution and validation into a focused helper to keep the large inventory drag controller bounded.
- Added 10 regression tests for Simple storage pickup, masks, capacity, swaps, unequip, sort, mode switching, auto target, and pouch stacking; pre-existing tests retained.
- Test result: 1056/1056 Node tests pass, architecture guard passes. Live Foundry V14 interaction remains to be verified by the user.
