# Buxa Framework v0.13.53 — Stop leaked Foundry embedded-document options

- Fix closed/open filled-storage pickups failing on the **second or later round trip** with `Actor is not a valid embedded Document within the Actor Document`.
- Root cause: `physical-item-transfers.js` shared one mutable `MUTATION_OPTION` object across Actor and embedded Item document operations. Foundry document methods can add `parent`/`pack` fields; subsequent Actor updates inherited the stale embedded-document parent and failed.
- Every physical-transfer document operation now receives a fresh, isolated options object. Backpack restoration additionally discards any leaked `parent`/`pack` fields before writing the Actor or creating children.
- Preserve previously implemented pre-root inventory staging, storage geometry, shape rotations, and transaction rollback; no migration required.
- New regression first reproduced the exact error on v0.13.52 after a successful pickup followed by a drop and second pickup. Added a three-cycle round-trip test with deliberately mutated `parent`/`pack` on every embedded Item operation; all contents and original compartments persist.
- Tests: 599/599 passed; module syntax and architecture check passed. This is not yet verified in a live Foundry V14 world.
