# Buxa Framework v0.13.84 — Independent Storage Occupancy Modes

- Each Item Configuration → Basic → Storage external compartment has its own **Item slots** selection: **Follow inventory**, **Simple (1 slot per item)**, or **Complex (item footprint)**. Compartment **Type** (rectangle/custom outline) is separate. Existing compartments default to Follow inventory.
- A Complex item entering a Simple pouch uses one slot while its actual shape and artwork flags are unchanged; leaving for Complex inventory restores its full footprint. Complex pouches can now be used in a globally Simple inventory as well.
- Fixed Simple-actor/Complex-pouch saved collision validation to load real item shapes.
- Updated pointer ghosts to shrink for Simple pouches and recover their shapes on exit without document writes.
- Ground-container placement, recovery, pointer previews, icon rendering, keyboard targeting, and shape occupancy respect explicitly Simple compartments; existing default ground-container behavior stays Complex.
- Added regression tests for independent pouch physics, painted masks, collision, automatic placement, mixed-mode persistence, ground interaction, and pointer ghost state.

## Validation
- Node suite: 1,067 tests passed before version bump.
- Architecture validator passed (8 pre-existing soft-limit warnings).
- Live Foundry V14 in-app testing not available here.
