# Buxa Framework v0.13.61 — Follow-up audit disposition

## Source-confirmed issues addressed

1. Ground-container pointer hover cloned and revalidated the whole packed data for each candidate cell (`startDrag → groundMoveWithin`); the planning path also repeatedly created temporary container copies. Moved hover checks to a read-only occupancy snapshot and kept authoritative commit-time validation. Added comparison against the original placement checker across masks, shapes, rotations and invalid saved entries.
2. Stack-image composition editor mutated its live Item Configuration draft even if closed using × or outside click, with no Escape/Cancel semantics. Added an isolated draft transaction, explicit Apply/Cancel and pointer/keyboard cleanup. Added staging/cancellation tests.
3. Ground-container world-Item export deleted the new Item in the catch branch without first checking whether the scene write had nevertheless succeeded. Under a post-save hook error that could lose the only copy. Added persisted-state decision and verified cleanup tests.
4. Storage grid pointer geometry was embedded in a 500+ line App controller. Extracted pure hit-test functions with unchanged public re-exports, reducing soft size warnings.

## Still requires host validation / deferred

- **Actor ↔ ground backpack round trips:** Existing automated transaction/rollback coverage passes, but Foundry V14 native embedded-document context, socket authority and world/Token Actor behavior cannot be fully simulated here. No broad persistence rewrite was attempted without a proven host-level failure.
- **Cross-window pointer hit testing:** Source-side regression tests cover cropped hit testing, pointer lifecycle, and drop targets. Actual Foundry sheet z-order, native drag events and canvas PIXI routing must be tested in-app before declaring this stable.
- **Controller/template size:** `inventory-controls.js`, `item-config.js`, `physical-item-transfers.js`, and several Handlebars templates still exceed soft architecture limits. Refactoring their runtime data flows without in-app behavioral verification could introduce fresh item-loss regressions. Their oversized status is documented, not claimed solved.

## Release verification

- Full test suite 644/644 passed; geometry parity cases and rollback cases included.
- Architecture guard passes (8 pre-existing soft warnings; formerly 9).
- JavaScript syntax and installable ZIP integrity verified.
- No migrations, gameplay rule changes, or Foundry dependency updates.
