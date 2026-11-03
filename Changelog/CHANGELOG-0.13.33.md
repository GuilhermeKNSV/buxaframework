# Buxa Framework 0.13.33 — Ground storage placement repair

- Storage placement and UI now use the same valid occupied-cell mask. Saved invalid or overlapping legacy items remain recoverable but cannot block visually empty cells.
- Automatic item drops onto a ground storage object search all eligible compartments and rotations, preserving the actual selected rotation in saved storage.
- Explicit cell drops still require a valid fit at that exact cell, preventing silent jumps.
- Existing inventories, backpack contents, and world storage formats are unchanged.
- Added geometry and GM-authoritative transfer regression tests reproducing irregular masked chest placements.
