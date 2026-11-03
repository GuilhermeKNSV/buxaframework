# Buxa Framework 0.13.30 — Remaining six audit follow-ups

**Source:** 0.13.29 (the 23-follow-up audit). This release addresses its six remaining entries while preserving the Actor inventory model, the compact ground-storage window markup, and the physical transaction ledger.

## Status by original finding

| Finding | Outcome | Source |
|---|---|---|
| **23 · Authenticated socket sender** | **Implemented.** `physical-item-request-channel.js` uses Foundry's server-supplied socket callback `senderId` (second argument), not message data's forgeable `from`. Rejects missing sender identities and results not from the elected GM. Request replay/status is scoped to the verified user ID. | `scripts/integrations/physical-item-request-channel.js` |
| **28 · Per-scene world storage** | **Implemented with non-destructive migration.** Each scene now gets an independent world setting (`physicalSceneV2_<sceneId>`). Before initialization, old aggregate and Scene flags remain readable. Confirmed per-scene writes override those sources, including empty arrays. The original world aggregate is retained as a backup. | `scripts/core/physical-scene-partitions.js`, `scripts/core/physical-scene-migration.js` |
| **37 · Native fog mask match** | **Hardened, not fully closed without live V14 verification.** Render visibility now uses 25 interior samples instead of five. This is deliberately conservative at wall/vision boundaries. Physical Items still use an interactive `canvas.interface` Pixi layer, so this is not an exact GPU pixel-mask match. | `scripts/core/physical-item-visibility.js` |
| **38 · Requester-specific GM vision** | **Implemented as a conservative authorization gate.** Every scene-item `canInteractPhysical` access in GM-handled transfer operations verifies the requesting player's explicitly linked Token vision via `PointVisionSource.testPoint`, with no GM omniscient fallback. If the GM is not viewing the Scene or its source is missing, access is denied rather than assumed. | `scripts/core/physical-item-sight-auth.js`, `scripts/integrations/physical-item-transfers.js` |
| **39 · Ground-container controller split** | **Implemented.** Pure render markup, clipping-layout math and item diff calculations moved into `ground-container-view.js`; event handling, keyboard navigation, drag and transfer handlers stay in the window controller. All existing DOM selectors preserved. | `scripts/apps/ground-container-view.js`, `scripts/apps/ground-container-window.js` |
| **42 · Differential ground grid** | **Implemented.** Identical layouts retain the existing grid and event listeners. Unchanged item nodes are reused; removed/changed items are updated by source ID. A structural compartment/shape change triggers a full rebuild. | `scripts/apps/ground-container-window.js` |

## Safe per-scene migration

1. Back up your world data.
2. As GM, open the console and run `await game.buxaframework.migratePhysicalScenes()` to preview the migration. It does not write anything.
3. When ready, run `await game.buxaframework.migratePhysicalScenes({dryRun:false})`. It migrates known scenes, validates each saved record, and retains the old world setting as a backup.
4. Or simply continue using the module: each scene migrates when its items are first changed and saved. Other scenes remain on the old readable store until their own first write.

**No automatic destructive cleanup of old data is performed.** Unrecognized or previously deleted Scene IDs remain in the old aggregate for GM review.

## Security and visibility caveats

- The server-supplied socket sender ID is the identity used for transfers, based on Foundry's documented socket callback behavior (also used by socketlib). Raw message fields are never trusted as identity.
- Player ground-loot actions now require the authoritative GM to have the Scene loaded with the requesting character's Token vision source initialized. They will fail closed if that context is unavailable; this can be more restrictive than earlier versions and must be tested with a real GM/player session.
- `PointVisionSource.testPoint` checks the source's restricted shape/range. Complex lighting/detection modes and exact native fog pixel rendering still need comparison against V14 in-game. This release does **not** claim an exact native fog-mask implementation or fully verified multiplayer security from Node unit tests alone.
- The old aggregate remains stored for recovery; the new per-scene settings stop **new** growth of that aggregate but do not automatically shrink existing world data.

## Verification

- 502 / 502 Node automated tests passed, including five new test files covering authenticated sender spoofing, receipt isolation, per-scene writes and migration, GM requester-specific vision, fog boundaries, and differential item rendering.
- 147 JavaScript source syntax checks passed.
- Architecture validation passed with eight non-blocking soft-size warnings.
- Foundry V14 live and multiplayer acceptance testing is still required.

### Suggested in-game acceptance checks

1. GM and a regular player logged in concurrently: drag/drop, loot, edit as GM, and verify one transfer per action.
2. Player attempts to loot from behind a wall or outside the linked Token's sight: reject without moving any Item.
3. GM switches away from the Scene: player attempts to loot; Buxa must fail safely rather than bypass LOS.
4. Test a chest with a masked grid, then move one item repeatedly: the active cells, item image and ghost remain aligned.
5. On a world copy, migrate two Scenes and inspect that Scene A and B are independent, including deleting the last ground item and reloading.
