# Buxa Framework v0.15.6 — Independent follow-up audit

## Baseline and counting

- Based directly on the user's **v0.15.5 complete module**.
- The baseline passes its existing 1,714 tests.
- New regression suite: `tests/audit-v0156-new-regressions.test.mjs`.
- **153 of the 168 new scenarios FAIL on the unmodified v0.15.5 source.**
- **168 of 168 pass after the patches**; complete regression suite: **1,882 / 1,882 passing**.
- There are **12 underlying root-cause groups**, not 153 unrelated defects. The counts below are separate input scenarios, not a count of independent bugs.

## Confirmed defects and fixes

| Group | Original failing cases | Fixed issue |
| --- | ---: | --- |
| Rarity settings | 18 | Unicode/symbol-only custom rarity IDs used random fallbacks. Re-normalization could change an ID and strand item rarity references. IDs now get stable deterministic fallbacks. |
| Hotbar configuration races | 9 | Saving a previously opened hotbar config could discard tabs and shortcuts created elsewhere while the dialog stayed open. The dialog now submits a baseline so concurrent new tabs can be preserved without undoing explicit removals. |
| Complex inventory grid | 32 | Blank/null/checkbox active-cell values were converted into numeric zero, reducing a full grid to a single active cell. Invalid values now use full grid capacity; deliberate numeric zero still clamps to one. |
| Ground scene FX normalization | 6 | Boolean values in beam or label offset/scale fields could turn into unexpected zoom/position values. Invalid types now restore defaults. |
| Equipped artwork normalization | 20 | Boolean values in size-specific rotation, position, or zoom were accepted as numbers, distorting slot artwork. Numeric fields now exclude booleans and nonscalar types. |
| Scene storage rotation | 23 | Corrupt, fractional, or out-of-range rotation could be persisted from a drop request. Rotations now normalize to one of 0, 1, 2, 3 quarter turns. |
| Gameplay number display | 10 | Missing/blank/non-numeric display inputs were silently converted to zero or one instead of using their configured fallback. |
| Imported shape cells | 2 | Boolean cell coordinates could create phantom shape cells. Invalid coordinates now fall back to origin values. |
| Equipment unlock IDs | 7 | Invalid slot ID types became strings such as `null`, `undefined`, `true` and `[object Object]`. Only nonblank string IDs are retained. |
| Tiny ground FX footprint | 7 | Empty, null, and boolean dimensions could incorrectly shrink an effect to tiny-item scale instead of using the normal fallback dimensions. |
| Dropped item board artwork | 16 | Boolean size/opacity/rotation caused tiny images or unwanted transparency. Invalid inputs now retain the configured default. |
| Imported shape rotation | 3 | Boolean rotation could rotate item artwork by a stray degree. It now uses the same validated numeric conversion as the other shape fields. |
| **Total** | **153** | **12 shared causes** |

### Safeguards maintained

- Existing Item and Actor flag formats are unchanged; no world migration is required.
- Valid numeric values, including zero where meaningful, remain valid.
- Hotbar shortcuts remain Actor-scoped and do not move or copy Items.
- Existing explicit hotbar tab deletions still delete their shortcuts.
- The five saved equipment-artwork profiles and the scene FX preview layout remain compatible.
- Complex inventory, Simple inventory, storage, NPC, progression, scene VFX, and hotbar regression suites all pass.

## Verification

1. Run `node --test tests/audit-v0156-new-regressions.test.mjs` against the unmodified v0.15.5 ZIP to reproduce the 153 failures.
2. Run the same test against v0.15.6 to confirm all 168 scenarios pass.
3. Run `node --test tests/*.test.mjs` for the full 1,882-test suite.
4. Run `node check-architecture.mjs` and check module ZIP structure/version.

**Limitations:** Automated tests don't replace live UI verification inside Foundry V14. The architecture checker retains eight pre-existing *soft* file-size warnings; there are no hard architecture failures.
