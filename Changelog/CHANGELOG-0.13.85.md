# Buxa Framework v0.13.85 — Inventory & Item Integrity Audit

- Reviewed the full Simple/Complex inventory, mixed-mode storage, Item rules, stack handling, and portable ground containers; baseline 1,067 automated tests passed.
- Fixed automatic Simple-main → Complex-storage placement using a 1×1 footprint instead of the Item's true shape. Preview and save now share the correct lazy shape map.
- Automatic pouch-header placement can rotate a multi-cell Item when no slot fits the initial orientation. Exact cell drops retain their requested orientation.
- Made Actor-native Item imports and generated Item stacks use the same automatic storage rotation policy.
- Protected storage-granting Items (bags/bonus slots/equipment unlocks) from stacking, preserving the unique Item document that provides each compartment; such templates create single units even if multiple/stackable was enabled.
- Kept legacy Follow Inventory backpack occupancy when moving from a Simple Actor onto the scene; portable metadata preserves the resolved mode without overwriting the Item's configurable `inherit` rule.
- Added 6 regression tests covering footprint-safe mixed-mode placement, rotation, one-slot Simple pouches, pointer path, container stacking, and scene transfer preservation.
- 1,073/1,073 Node tests passed and architecture guard passed (8 pre-existing soft size warnings). Requires live Foundry V14 verification.
