# Buxa Framework 0.15.10 — NPC Drop inventory fix

- Moved NPC-only Drop from its own sheet tab directly below normal Inventory in the same page (works for Quick and Visual NPC sheets).
- Existing saved NPC sheet `activeTab: drop` migrates to Inventory on reopen, avoiding a hidden panel.
- Integrated NPC Drop with Buxa's pointer-based inventory/equipment/storage item dragging; no longer relies only on HTML5 drop events.
- NPC Drop receives a copied item template; its original Actor inventory/equipment item is not consumed.
- Improved native Item directory/Actor/Compendium UUID drag-data lookup and fallback to Buxa Item drag MIME.
- Items dropped onto a Simple Drop cell insert into the selected position; full capacity is respected.
- Serialized simultaneous additions to avoid replacing an earlier drop entry.
- Added visible drag-over highlight, pointer occlusion/visibility checks, and prevented unrelated destinations from stealing NPC Drop release.
- Added regression tests for slot placement, pointer and native drag paths, permissions, concurrent saves, and saved-tab migration.

Verified by Node regression and architecture checks. Live Foundry V14 drag interactions still require in-world validation.
