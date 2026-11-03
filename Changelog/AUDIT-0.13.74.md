# Buxa Framework v0.13.74 — Deep audit and regression hardening

## Scope and honest counting

This pass examined the latest v0.13.73 source across inventory geometry, external and ground storage, stacking, Item Recharge/Use/Limits, combat lifecycle, image browser, stack-artwork composites, and GM-authoritative transfer replay records. It also ran the full pre-existing test suite and architecture/syntax checks.

**49 separately reproduced regression scenarios failed on the untouched v0.13.73 ZIP and passed with these changes.** The new test file contains **70 test scenarios**; 21 already worked and were retained as non-regression checks. Some failures share an underlying cause (for instance, multiple malformed input types incorrectly selecting grid cell zero). **Do not interpret 49 cases as 49 unrelated architectural root causes.**

The changes cover **16 existing JavaScript files** and add `tests/deep-audit-v01374.test.mjs`. No saved data was migrated or removed, and no UI redesign or gameplay rebalance was attempted.

## Reproduced failure scenarios (old v0.13.73 failed, new version passed)

1. inventory geometry rejects null origin without phantom occupancy.
2. inventory geometry rejects empty origin without phantom occupancy.
3. inventory geometry rejects whitespace origin without phantom occupancy.
4. inventory geometry rejects boolean origin without phantom occupancy.
5. inventory ignores placements in capacity-disabled tail cells.
6. inventory ignores shapes partly crossing into inactive cells.
7. storage rejects invalid rotation -2 before saving.
8. storage rejects invalid rotation -1 before saving.
9. storage rejects invalid rotation 4 before saving.
10. storage rejects invalid rotation 5 before saving.
11. pointer mapping rejects nonfinite x NaN.
12. pointer mapping rejects nonfinite y NaN.
13. incomplete viewport rectangle cannot create a virtual drop cell.
14. explicit chest drop tries later compartments when the first masks the cell.
15. manual chest placement rejects malformed index .
16. manual chest placement rejects malformed index false.
17. manual chest placement rejects malformed index  .
18. chest placement refuses a corrupt contents bundle rather than hiding it.
19. chest addition rejects rotations that would be corrupt on the next read.
20. auto-drop on another item rotates a tall shape to fit a wide-only pouch.
21. stack planning rejects invalid transfer quantity -2.
22. stack planning rejects invalid transfer quantity 1.5.
23. stack planning rejects invalid transfer quantity Infinity.
24. stack planning rejects invalid transfer quantity NaN.
25. stack planner ignores a duplicate target ID instead of double-spending room.
26. combat recharge rejects corrupt progress NaN.
27. combat recharge rejects corrupt progress Infinity.
28. combat recharge rejects corrupt progress -3.
29. combat recharge rejects corrupt progress 3.5.
30. combat recharge normalizes invalid rule (2,NaN).
31. combat recharge normalizes invalid rule (Infinity,Infinity).
32. combat invalid delta cannot add charges.
33. recharge does not charge a decreased Max Uses limit as an invisible debt.
34. resource-effect normalized duplicate IDs remain unique and bounded.
35. recursive gallery excludes sibling files and attempted parent traversal.
36. folder tree safely handles an unloaded listing without a dirs property.
37. folder tree cannot follow a parent reference into another branch.
38. image composite cache distinguishes distinct fallbacks for identical missing layers.
39. corrupt image layer drawing falls back instead of caching a permanent rejection.
40. two target Items cannot concurrently consume the same recharge material.
41. World Item templates cannot be treated as owned recharge targets.
42. a changed resource maximum invalidates payment and rolls back charges.
43. material changing mid-recharge cannot be charged twice.
44. recharge reports only visible charges gained after Max Uses is lowered.
45. transaction IDs that resemble prototype keys are treated as new requests.
46. transaction reconciliation cannot acknowledge an inherited object property.
47. final item use cannot destroy a chest holding other Actor Items.
48. partial GM save failure does not recharge earlier successful Items twice.
49. changing combatant count does not reset historical high round and grant replay charges.

## Major implementation corrections

- Stop malformed or inactive inventory origins from creating phantom occupied cells, without changing legitimate tight-fit placements.
- Validate storage rotation values consistently before committing them to persistent container contents, and prevent writes if nested contents metadata is corrupt.
- Make automatic item-on-backpack drops search legal rotations; make explicit board chest drops resolve the correct compartment.
- Reject unsafe stack quantities and duplicate targets instead of silently generating a misleading transfer plan.
- Make resource and material recharge transactions mutually exclusive per Actor, revalidate ownership and payment inputs, and distinguish our own committed consumption from another concurrent edit.
- Safely normalize corrupted combat recharge counters, maintain item-specific high-water marks, stage the initial encounter cursor before a partial batch, and preserve the encounter high round across combatant-list changes.
- Stop an exhausted, filled backpack from being destroyed/transformed while its children would become orphaned.
- Normalize renamed resource-effect IDs and stale usage counters without creating unbounded identifiers or invisible charge debt.
- Filter the gallery/tree to the selected folder's descendant paths; never traverse relative-parent paths from malformed file-provider listings.
- Isolate stack composite fallbacks in the cache and survive a failing individual image layer.
- Reject inherited JavaScript prototype properties as real GM transaction journal entries.

## Testing

- Original v0.13.73 full suite: **711 passed**.
- New isolated audit suite run against original v0.13.73: **21 passed, 49 failed**.
- New isolated audit suite after updates: **70 passed**.
- Final comprehensive suite: **781 passed, 0 failed**.
- All JavaScript source syntax checks, architecture validator, and complete ZIP integrity: passing.
- Architecture still reports **8 pre-existing soft size warnings** (not hard failures); risky controller splitting was deliberately deferred.

## Remaining risks / not proven in this environment

1. Live Foundry V14 drag/drop across overlapping PIXI canvas and ApplicationV2 windows still needs interactive validation.
2. Cross-client GM/Player concurrent Item updates are not a distributed transaction; the in-process locks prevent local recharge races, but do not replace authoritative server-side locking.
3. Combat order changes, initiative re-sorting and paused/rejoined multiplayer sessions warrant live tests even though the deterministic turn tests pass.
4. The eight existing oversized files still need careful modular refactoring with targeted integration testing.

Back up the Foundry world before installation. Test on a copy first, particularly with backpacks containing several shaped Items and complex recharge configurations.
