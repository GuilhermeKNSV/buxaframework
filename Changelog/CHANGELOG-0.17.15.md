# Buxa Framework v0.17.15 — Additional audit fixes

Continues from **v0.17.14**. Full installable module, not a patch. No game/world migration or intentional UI redesign.

## Fixed / source-verified

1. **N005 / N035:** `changeAttribute` and `changeProficiency` now apply validated signed integer deltas of more than one point, with correct pool spending/refunds. Invalid/non-integer amounts are rejected. Bulk requests at a ready-to-claim Rebirth do not silently claim only one point; the owner must claim that Rebirth first.
2. **N012:** Nested ground-container parent-chain validation now caches validated ancestry, avoiding quadratic walks of deeply nested bundles while keeping duplicate, missing-parent and cycle rejection.
3. **N026:** Inverse item-bonus calculation rejects effective values under a `-100%` (or lower) modifier instead of guessing a permanent base and silently writing a wrong value. Users must remove that effect before directly editing the affected base.
4. **N027:** Portable storage provider identity uses the last compartment-ID delimiter; imported Item IDs containing colons are no longer misidentified in storage, grants or cycle prevention.
5. **N056:** Searchable Increase/Dice selectors show the next 160 options on demand. All configured entries remain reachable without rendering enormous lists at once.
6. **N069:** Player-sheet FX coalesces recent pulses by target, bounds the recent event list to 48, uses independent animation identities, and replaces stale cleanup timers on rapid updates.
7. **N095:** Search normalization is independent of browser locale; Turkish dotted/dotless `I` queries are handled consistently. Added coverage.

## Data-loss protection (partial mitigations)

8. **N078 / N079 / N082 / N083 / N084:** Saving Item rules now checks *both the current saved Item* and the edited input for unsupported counts: 40 dice, 40 decorations, 60 Increase effects, 12 storage compartments, 32 resource effects. Instead of silently truncating imported rules when the Item Config or Control sheet saves, the operation fails with an explicit, actionable message **before any Item write**. Oversized documents are not automatically repaired; export/repair them first.

## Verification

- 2,879 automated Node tests passed at release time.
- Architecture checker passed (11 existing nonfatal source-size warnings).
- Archive CRC and module root verified.

## Still open

Multi-GM transaction recovery, cross-client ground-storage revision control, legacy oversized-rule repair tools, and browser/Foundry V14 integration tests remain unsolved. These changes were validated by Node tests, not a running Foundry world. Back up your world before upgrading.
