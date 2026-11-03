# Buxa Framework 0.17.11 — Reliability audit and fixes

This is a complete module release continuing the v0.17.8/0.17.9 code audit and the 0.17.10 follow-up. No world-data schema migration is required. Back up the world before updating and test live multi-GM behavior before using in an important session.

## Combat / NPC staging
- Recover partially created NPC Tokens if Foundry throws *after* creating some documents. Never remove pre-existing scene Tokens during staging rollback.
- If a post-save hook throws but the roster already saved all bindings, retain the committed Tokens instead of accidentally deleting them.
- Repair partially saved roster bindings when staging needs to roll back; provide an explicit GM-reconciliation error if cleanup cannot be confirmed.
- Match staged NPC Tokens to roster entries by saved `encounterEntryId` tags, not creation-result array order. Reject duplicate/missing identities.
- Removed silent 200-NPC staging truncation; reject unsupported requests above the explicit 2000-NPC safety limit.
- Optimize placement on crowded grids with perimeter-only candidate scanning.
- Regression tests for partial creation, post-save hook failures, duplicate/ordered identities, and larger NPC groups.

## Inventory / stack transfer safety
- During incoming stack imports, revalidate the target stack's quantity just before applying each merge. If a concurrent edit changes the quantity during overflow-stack creation, abort and roll back only the newly imported copies.
- Rollback of merged quantities checks the expected live value; never overwrite a newer external edit with a stale snapshot. Flag unresolved conflicts for GM review.
- Imported stack deletion during compensation verifies that its quantity is still the originally created amount; do not delete a stack someone else has since changed.
- Regression tests for partial-stack refill races and late rollback conflicts.

## Physical scene-item data
- Use one shared record-validation predicate in scene rendering, save preflight, diagnostics, and transfer writes, preventing malformed records from being silently omitted and accidentally overwritten.
- Reject null, blank, boolean, array/object, hexadecimal, non-finite and malformed coordinates; continue accepting genuine finite numbers and legacy decimal-string positions.
- Preserve the module's existing validation-error wording contract.

## Item combat recharge
- Remember the combatant turn-order signature in the recharge cursor, not just the number of combatants. Initiative reorders with unchanged roster size cannot accidentally award turns from the previous order.
- Regression test covering same-size initiative reorder behavior.

## Image library
- Separate previewable external artwork URLs from source-relative FilePicker folders; reject URL-style, dot-segment and encoded directory traversal targets.
- A failed folder/source change restores the previous selection and gallery rather than mixing sources or leaving the gallery stuck loading.
- Bound the artwork-in-use scan and tolerate malformed stack-image arrays and unreadable Item flags rather than crashing the browser.
- New targeted regressions for malformed metadata, invalid folders, and failed reads.

## Verification
- Automated tests: **2839 passed / 2839 total**.
- Architecture checker: passed, with existing nonfatal source-size warnings.
- Modified JavaScript modules pass `node --check`.
- ZIP content integrity verified.

## Known remaining limitations
- A single-client queue or compensating rollback cannot guarantee atomicity between Actor, Scene, Item, and world-setting writes across a process crash or simultaneously active GM clients.
- No live multi-client Foundry V14 browser/game session was available for the automated run. UI gameplay, crash recovery and cross-GM reconciliation still need in-game verification.
- Large legacy modules and CSS rules were not deleted without proven safe call-graph coverage.
