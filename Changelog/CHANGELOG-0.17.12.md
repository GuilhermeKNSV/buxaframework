# Buxa Framework 0.17.12 — Additional reliability fixes

Continuation of the v0.17.11 audit. No world-schema migration or intentional gameplay-rule changes. Back up the world before updating.

## NPC deaths / corpse loot
- Prevent identical NPC drop-table entry IDs from producing duplicate physical ground-record IDs. The first occurrence preserves its previous stable ID; subsequent copies use deterministic suffixes. Saving again after a late Foundry hook failure does not mint duplicates.
- Stamp each transferred corpse Item with a source receipt and recover it when item creation completed but a post-save hook threw. Retry finishes the pending corpse transfer without creating another copy.
- Verify token loot removal after the Actor Item is tracked. If the token save persisted then threw, acknowledge success instead of deleting the legitimately transferred Item.
- Compensate failed inventory tracking by deleting only the newly created Item. Failure to restore source and destination is reported for GM reconciliation rather than allowing blind retries.
- Recover interrupted transfer attempts only for a uniquely identified recipient Item. Report conflicting prior recipients/copies for manual GM inspection.
- Validate corpse Item snapshots and quantities before Item creation; tolerate malformed legacy system/flag objects and unreadable Item flags without silently importing invalid data.
- Bound pending non-GM corpse loot requests, clean up pending state on socket send failure, and warn users to verify inventory on an uncertain timeout. Handle GM result-emission failures without generating an unhandled promise rejection.

## Image library
- Prevent an older asynchronous source change from overwriting the latest folder/source selection.
- Cancel pending scans, deferred search updates, and in-flight folder changes when the image picker closes; an old scan can no longer re-open the closed window.
- Filter encoded and repeatedly encoded directory-traversal paths from recursive scans, tree rows and folder favorites, while permitting valid FilePicker roots and encoded spaces.

## GM physical-transfer request channel
- Bound queued authority requests and client-side pending transfers so sustained bursts cannot grow without limit.
- Release pending requests immediately if socket emission throws and preserve clear do-not-blindly-retry messages for ambiguous operations.
- Safely handle response socket failures; completed transfer receipts remain available in the transaction journal for status/reconciliation.

## Sheet interaction safety
- Different Items/rows with identical action IDs or tooltips now receive independent per-control rate-limit buckets; rapid automated clicking still triggers the existing per-sheet guard.

## Verification
- 2,851 automated tests passed; includes new tests for post-save Item/Token hooks, duplicate NPC drops, corpse compensation, asset-folder traversal, source-navigation races, socket failures and sheet-button identity.
- Architecture check passed, with 11 existing nonfatal source-size warnings.
- JavaScript syntax and ZIP integrity checked.

## Remaining limitations
- A per-client queue and receipt-based compensation cannot guarantee atomic transactions across simultaneously active GM processes or an abrupt server/client crash between multi-document writes.
- Real Foundry V14, D&D5e 6.x gameplay and multi-client socket behavior still need live verification.
