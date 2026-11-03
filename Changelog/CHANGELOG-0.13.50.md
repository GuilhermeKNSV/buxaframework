# Buxa Framework v0.13.50 — Closed Storage Transfer Ordering

- Rebuilt the closed-storage backpack restoration transaction: reserve stable child Item IDs and verify occupied cells BEFORE creating any child Item documents.
- Save Actor inventory placement flags before the child `createEmbeddedDocuments('Item')` calls, avoiding the Foundry V14 `Actor is not a valid embedded Document within the Actor Document` error observed after item creation.
- Create child documents with `keepId:true` so storage IDs precisely reference their persistent Item IDs, including nested compartments.
- Verify all restored items and placements before the ground source can be consumed; preserve the source and roll back children/flags on failure.
- Added regression tests simulating an Actor update backend that rejects ANY Actor flag update after child Item creation, failed preflight writes, partial nested creation, and unrelated concurrent Items.
- 595/595 automated Node tests passed. Full ZIP integrity and architecture checks passed. Live Foundry V14 verification remains necessary.
