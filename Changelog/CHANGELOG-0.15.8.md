# Buxa Framework 0.15.8 — Rotation and equipment motion fixes

- Track the pointer's exact fractional position inside the grabbed occupied cell, not an assumed cell center. The fraction rotates with the cell through 90-degree turns and returns after four turns.
- Correct clipping of rectangular, tall, wide, and irregular drag previews while the old footprint rotates into the new one. Paint containment is relaxed only during the active rotation.
- Unwrap the actual computed rotation angle so rapid R presses continue smoothly even when a CSS/WAAPI matrix crosses ±180 degrees.
- Safely end active rotation effects before switching to an equipment or simple-storage drag preview, or rebuilding the complex ghost's children.
- Change equipment flight animations to use uniform scaling plus crossfade rather than non-uniform stretching. Animation failures clean up without invalidating a successful saved move.
- Added `tests/inventory-grab-motion-v0158.test.mjs` covering off-center grabs, four rotations, angle winding, and aspect ratio of equip flights.

Automated verification: 1,896 tests passed. Browser/Foundry live interaction remains to be checked.
