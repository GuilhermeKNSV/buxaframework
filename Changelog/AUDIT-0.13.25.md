# Buxa Framework v0.13.25 — Stability Audit

Baseline: v0.13.24. Changes are intentionally scoped to error recovery, ground-container geometry, ground-loot permissions, and right-click interaction. The working floating storage UI, bag contents, and scene world-settings persistence are unchanged.

## Fixed

- Ground container: moving the sole stored item ignored neither its original footprint nor its existing saved storage flags. Removing the old packed-contents flag for the temporary fit check prevents self-collisions.
- Ground container: negative/out-of-range preferred cell indexes could skip the last candidate cell. Search now normalizes the start index and considers every grid cell exactly once.
- Server permission: scene-to-world directory transfers by non-GMs now verify normal looting permissions, explicit character links and configured loot distance, even if the user can create world Items.
- Actor transfer: if an embedded Item is persisted and a post-create Foundry hook throws, the newly created document is identified by its unique Buxa instance ID and rolled back before propagating the error. Unrelated Items remain untouched.
- World directory transfer: likewise recover an Item already persisted when a world Item create hook throws, and verify that Foundry actually registered successful creations.
- GM ground-loot right click: multiple Pixi pointer event variants no longer toggle the Edit affordance off immediately after opening it.

## Regression coverage

Added tests for a sole-item self-overlap reposition, negative start-index placement, post-create hook failures in Actor/world Items, scene-to-directory permission checks via a remote socket request, and multiple right-click events.

## Follow-up technical debt (not silently changed)

- `scripts/apps/inventory-controls.js` is large and near its architecture hard-size threshold. Split its pointer interactions from inventory mutations as a separate controlled refactor.
- `scripts/integrations/physical-item-transfers.js` has several multi-step cross-document transactions. Continue tightening explicit reconciliation and failure-injection tests when changing individual transfer routes.
- Browser-driven Foundry V14 multiplayer, synthetic Actor, fog, and long-running canvas interactions still require in-game validation.
