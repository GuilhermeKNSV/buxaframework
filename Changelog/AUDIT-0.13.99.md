# Buxa Framework v0.13.99 — Safety and Hotbar Audit

## Verification scope and how to interpret counts

**Input:** the complete v0.13.98 module archive, not a historical copy.
**Regression reproductions:** 183 new test scenarios in two suites; 179 fail in unchanged v0.13.98 and 179 pass after these fixes. The other four pass on the original, serving as protection against regressions.
**Important:** 179 reproduced failures are NOT 179 independent root causes. Many test cases exercise related edge inputs against the same broken assumption (for example dozens of different malformed tab layouts). The number demonstrates breadth of checks, not a claim of 179 unrelated defects.

### Major confirmed underlying faults corrected

1. **Tab truncation before validation:** malformed or duplicate tab entries could consume the 12-entry cap and hide valid tabs saved later in the configuration array.
2. **Invalid slot identifiers accepted:** overlong Item references survived assignment but were silently erased by normalization during reload.
3. **Empty shortcut identifiers accepted:** whitespace-only references could appear assigned and then vanish on save.
4. **Wrong-type Item references accepted:** numbers, booleans, arrays, objects, or other non-string values could silently remove an existing shortcut.
5. **Oversized Actor references accepted:** shortcuts could be associated with Actor IDs that normalization later discarded.
6. **Prototype-sensitive object keys:** `__proto__` as an Actor or tab identifier could corrupt shortcut lookup instead of acting like ordinary saved data.
7. **Inherited tab bindings:** values on an input object's prototype were considered legitimate saved shortcuts.
8. **Blank/boolean column fields:** `null`, blank text, and browser booleans could coerce to zero and unexpectedly shrink the hotbar from 10 slots to 4.
9. **Out-of-order settings writes:** rapid saves could execute in parallel and an older write could overwrite a newer one.
10. **Missing pending-write reads:** a rapid subsequent operation could read stale settings and drop the immediately preceding shortcut update.
11. **Stale configuration dialog:** saving a dialog could replace shortcuts added while the dialog was open.
12. **Configuration overwrote unrelated state:** stale dialog data could revert the GM's selected actor, lock state, or active tab.
13. **Deleted tab reconciliation:** when configuration removes a tab, only its bindings should be removed; other actors/tabs must remain intact.
14. **New tab selection:** tab creation via settings should select the new tab while preserving existing actor shortcuts.
15. **Configuration modal lifecycle:** reopening the modal could leave old keyboard listeners attached; duplicate Apply clicks could submit twice.
16. **Configuration save errors:** a failed save could leave rejected promises unhandled and prevent clean retry.
17. **Item activation error handling:** failures during rule resolution happened outside the existing try/catch.
18. **Hotbar context-menu authorization:** opening a menu now validates the actor's ownership and the item's current parent/identity.
19. **GM actor selection stability:** adding an item shortcut no longer silently discards the currently selected GM token.
20. **Drag Actor identity:** item pointer drops permit two in-memory Actor instances representing the same stable UUID.
21. **Player actor linkage:** adding a shortcut to a different owned NPC no longer creates a shortcut in an inaccessible player hotbar.
22. **Hotbar control errors:** failed toggle, tab switch, lock, item activation or shortcut save operations now surface a warning rather than an unhandled error.

### Regression scenarios

- **60 tab recovery cases**: duplicate/malformed leading tabs followed by valid configured tabs.
- **45 invalid item-ID cases**: overlong references and whitespace-only references.
- **20 wrong-type item-ID cases**: non-string browser/script values.
- **25 invalid Actor-ID cases**: oversized references that cannot persist.
- **3 prototype/inheritance cases**: special identifiers and forged inherited bindings.
- **12 malformed numeric layout cases**: blank text, booleans, null and similar values.
- **4 stale configuration/state merging cases**: live shortcuts, state preservation, tab deletion and new tab selection.
- **12 rapid-save ordering cases**: two edits inside the same settings-write window.
- **2 error/pending-write safety cases**: recovery after a failed commit and optimistic reads.

Total 183 new scenarios, 179 failing before the changes. Existing suite of 1,293 tests remains included. New total: 1,476 tests.

### Caveats

These tests run under Node with focused Foundry stubs. They exercise persistence, normalizers and event-state semantics, not a full interactive Foundry V14 world. In-game verification is still necessary for real hotbar pointer gestures, orb animations, context-menu placement, and multi-client settings interactions.

No world Actor/Item schema migration is required. The setting retains its existing name and scope.
