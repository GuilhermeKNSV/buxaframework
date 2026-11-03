# Buxa Framework v0.13.28 — Full Code Audit

**Source:** v0.13.27 complete module archive. **Scope:** 139 source JavaScript files, all templates, styles, existing test suite, plus the Foundry V14 integration and module manifest. All observations below are drawn from the bundled source. **Testing:** baseline 473/473; updated 484/484 automated tests; syntax and architecture checked separately. Live Foundry V14 interaction and multiplayer permission validation remain outstanding.

A “fixed” finding is a concrete code change in this ZIP. A “follow-up” is a real code-level risk, limitation, or maintainability opportunity identified during inspection, **not a claim of a reproduced production bug**. Do not conflate suggestions with shipped changes.

## 22 implemented safeguards and fixes

1. **[FIXED · security] Invalid distance values could authorize interaction.** In `core/physical-items.js`, `NaN > maxDistance` is false. `physicalDistanceFt()` now returns `Infinity` for missing or non-finite coordinates instead of letting malformed points satisfy the range check.
2. **[FIXED · security] Null/blank coordinates could mean the scene origin.** Explicit `null` and empty strings now fail distance validation rather than coercing to zero.
3. **[FIXED · security] Hidden Token documents could count as linked nearby characters.** `nearestLinkedToken()` checks both token-level and document-level hidden state.
4. **[FIXED · validation] Invalid token dimensions could yield incorrect center measurements.** Linked-token selection rejects nonnumeric, zero and negative footprint dimensions.
5. **[FIXED · validation] Invalid token centers contaminated distance ranking.** Non-finite distances are discarded before sorting candidates; the drop-range outline uses the same validated token set.
6. **[FIXED · permissions] Ground item → chest lacked source-item loot-distance authorization.** `transferGroundContents(... direction='import', source='scene')` now checks source-item loot permission, not just proximity to the target chest.
7. **[FIXED · permissions] A player could use two different linked characters for a ground-to-chest transfer.** Source and destination access now require the same linked actor for non-GMs.
8. **[FIXED · permissions] Chest item → board could bypass the configured player drop range.** Ground-container export-to-scene now verifies drop distance before saving a world item.
9. **[FIXED · geometry] Dragged ground artwork could protrude past the playable scene boundary.** `moveOnScene()` now validates its entire square footprint against Foundry's padded scene rectangle.
10. **[FIXED · geometry] GM artwork editing used `(0,0,width,height)` rather than the padded scene rectangle.** It now checks position and size against the derived `sceneRect`.
11. **[FIXED · integrity] Duplicate source IDs in a portable chest-child bundle could overwrite the ID remapping.** Bundle metadata is validated before remapping.
12. **[FIXED · integrity] A nested chest item could refer to a missing provider.** Every ancestry chain must resolve to its bundle root before mutation.
13. **[FIXED · integrity] Circular nested chest ancestry could be persisted.** Repeated ancestors and self-parenting are rejected.
14. **[FIXED · integrity] Invalid nested indices, compartment identifiers, and rotations were not validated at the transformation boundary.** The bundle validator rejects malformed metadata before a new record is written.
15. **[FIXED · integrity] Freshly assigned chest-child IDs could collide.** ID remapping checks all current, new-root and new-descendant identities.
16. **[FIXED · integrity] Existing corrupt packed metadata could be silently propagated by chest operations.** Add, remove and reposition validate existing contained records before modifying them.
17. **[FIXED · integrity] A parent backpack could be dragged into its own grandchild's compartment.** `fitsExternalStorage()` walks the provider chain to refuse indirect containment cycles.
18. **[FIXED · validation] Non-integer item rotations could enter storage footprint checks.** Item rotation must be a whole quarter turn.
19. **[FIXED · geometry] A corrupt multi-cell placement at the last column could wrap into the next row and block a valid cell.** Occupancy is calculated using actual X/Y cells; invalid old footprints are not partially counted.
20. **[FIXED · data] Duplicate storage-tooltip row IDs could confuse editing or save targeting.** Normalization now guarantees unique IDs, keeping each row within its length limit.
21. **[FIXED · data] Duplicating a maximum-length compartment ID could produce identifiers longer than 48 characters.** The suffix generator reserves space for its suffix.
22. **[FIXED · data] A partially populated artwork-edit form could reset X/Y to zero when values were `null` or blank.** Normalization keeps the existing coordinate in those cases.

## 23 additional findings and recommended follow-ups

23. **[FOLLOW-UP · high] Socket message identity needs transport-level verification.** `integrations/physical-item-transfers.js` resolves a request's user from `message.from`; confirm whether Foundry exposes an authenticated sender context and refuse a mismatched claimed identity. Do not assume client-supplied fields are authentication.
24. **[FOLLOW-UP · high] Transfer requests are not idempotent across network retries.** The GM serializes in-memory mutations but has no persisted replay cache keyed by request ID. Design an exactly-once response ledger for drop, loot, and item creation actions.
25. **[FOLLOW-UP · high] Socket request timeout and successful late commit can diverge.** `requestPhysicalAction()` rejects after 15 seconds while the authority may still finish. Add queryable transaction status and retry-safe resolution.
26. **[FOLLOW-UP · high] Actor backpack restore cleanup can remove unrelated concurrently created items.** `core/backpack-transfers.js` removes every Actor item ID absent from its initial snapshot after an error; scope rollback to this transfer's assigned identities.
27. **[FOLLOW-UP · high] Backup/recovery of multi-document transactions is still procedural.** Several paths (`dropToScene`, `transferCrossSurface`, `transferGroundContents`) commit an Actor Item and a world setting separately. Add a reconciliation journal for crash/power-loss recovery.
28. **[FOLLOW-UP · high] World storage is one large setting for all scenes.** `writePhysical()` clones and writes the entire `physicalSceneItems` object on every change, risking large payloads and serialized writes as campaigns grow. Consider versioned scene-sized storage, with migration tests.
29. **[FOLLOW-UP · medium] Save confirmation serializes all scene records to JSON.** `writePhysical()` uses two complete stringifications to confirm equality, which scales with all items in the active scene. Consider revision IDs plus a targeted checksum or changed entry verification.
30. **[FOLLOW-UP · medium] Packed-content reads repeatedly deep clone whole item snapshots.** `getPackedContents()` and callers often clone again; profile allocations in large chests and consolidate immutable snapshot boundaries.
31. **[FOLLOW-UP · medium] Ground branch discovery repeatedly scans all descendants.** `groundContentBranch()` performs iterative full-array scans; a parent→children adjacency index would reduce nested transfers from quadratic work.
32. **[FOLLOW-UP · medium] Actor backpack traversal repeatedly scans every Item.** `captureBackpackContents()` loops over the Actor's entire collection for each nesting level. Preindex by storage provider for predictable performance.
33. **[FOLLOW-UP · medium] Backpack restoration creates children one document at a time.** `restoreBackpackContents()` issues one awaited creation for each descendant; preflight and batch by dependency depth where Foundry permits.
34. **[FOLLOW-UP · medium] Socket authority switch while a transfer is pending lacks a clear handover.** `physicalActiveGM()` elects the current GM, but outstanding requests belong to the previous authority's in-memory queue. Add failover/recovery tests with two GMs.
35. **[FOLLOW-UP · medium] `physicalSceneStore()` treats unreadable settings as an empty store.** This simplifies initialization but can hide an actual read error. Distinguish unregistered initialization from a live read failure and surface a Buxa warning.
36. **[FOLLOW-UP · medium] `scenePhysicalItems()` does not explicitly reject duplicate physical IDs.** Duplicate records can cause ambiguous rendering and mutation targeting; build a non-destructive GM diagnostic and repair flow.
37. **[FOLLOW-UP · medium] Canvas vision uses five discrete sample points instead of Foundry's fog clipping.** `core/physical-item-visibility.js` works for tested boundaries but may not exactly match irregular fog/wall masks. Compare against Foundry's native scene-visibility mask in live games.
38. **[FOLLOW-UP · medium] World storage transfers validate distance but not authoritative visibility for every source action.** UI hides unseen objects, yet a crafted request can still name a physical ID. Investigate GM-side LOS checks against the requesting user's linked vision sources.
39. **[FOLLOW-UP · medium] Ground-container window mixes markup generation, pointer handling and transaction requests.** `apps/ground-container-window.js` remains a large coupling point; isolate renderer, hit testing and controller without replacing working DOM selectors.
40. **[FOLLOW-UP · medium] Inventory pointer interactions are concentrated in a large module.** Split `apps/inventory-controls.js` by drag lifecycle, hitmaps, destinations and mutations; preserve existing event ordering through tests.
41. **[FOLLOW-UP · medium] Physical transfer integration is oversized and mixes socket policy, document writes and inventory placement.** Split `integrations/physical-item-transfers.js` into authority, transfer journal, container and Actor placement modules, with no protocol changes in the first refactor.
42. **[FOLLOW-UP · medium] Several renderer updates build whole grids using HTML strings.** Investigate keyed/differential updates in `apps/ground-container-window.js` so modifying one stack does not replace all cells and listeners.
43. **[FOLLOW-UP · low] Storage footprints use a literal 58 px cell size in multiple rendering paths.** Centralize that value so the compact viewport, drag ghost, hit target and CSS cannot drift when scale customization is added.
44. **[FOLLOW-UP · medium] Native keyboard support for the ground-container cell grid is limited.** The window uses pointer-first DOM controls; add focusable cells, keyboard selection and accessible drop feedback without changing pointer behavior.
45. **[FOLLOW-UP · low] The UI and integration files still exceed soft architecture size targets.** The architecture checker reports eight soft warnings; reduce only through narrow, test-backed extractions instead of broad rewrites.

## What this release deliberately did not change

- All v0.13.27 storage tooltip fields and item-sheet sections.
- Compact floating ground-container window markup, saved slot IDs, pointer stacking and current drag behavior.
- Item display artwork, rarity effects, loot labels and resource-HUD styles.
- The world-setting persistence format or Actor inventory data schema.

## Suggested follow-up sequence

**Priority 1:** authenticated socket sender identity, idempotent requests, delayed-commit reconciliation. **Priority 2:** safer Actor-backpack rollback and authoritative vision authorization. **Priority 3:** measured performance improvements to large world settings and nested content traversal. **Priority 4:** incremental UI module decomposition and keyboard accessibility.

All 45 findings are categorized. Only items 1–22 were implemented here. Automated tests do not replace a real Foundry V14 world backup and multiplayer acceptance run.
