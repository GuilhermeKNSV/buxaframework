# Buxa Framework v0.13.56 — Second integrity audit

## Confirmed source-level failures addressed

1. **Malformed Scene items disappearing on unrelated transfers.** `scenePhysicalItems()` filters invalid and duplicate records for display. A later Scene write or migration could commit just that filtered list, deleting the bad originals. Every Scene write and explicit partition migration now validates *the authoritative unfiltered source* and refuses to overwrite it if any record is corrupt. Outgoing records are also validated before persistence. No existing records are edited or discarded.
2. **Orphaned native-import stacks after failing Foundry hooks.** A Foundry `createEmbeddedDocuments()` hook can persist an Item, then throw before returning. `makeStack()` formerly had no Item reference in its catch block and could leak a second stack. It now finds and removes only newly created Items with the transfer's unique instance ID, checks the delete was persisted, and reports failures requiring manual reconciliation.
3. **Unstack creating duplicates after a post-create hook error.** `splitItemStack()` now finds and safely removes the split Item even when an error occurs after Foundry saved the new embedded Item.
4. **Unstack losing units after a post-update hook error.** A quantity reduction may persist before a hook throws. Rollback now checks the actual source quantity rather than a `reducedSource` boolean set after `await`; it restores the original quantity before removing the newly split Item.

## Tests and limitations

- Added seven regression cases: corrupt/duplicate world/legacy Scene data, invalid new Scene writes, stack creation cleanup (including cleanup failure), split post-create and post-update failures.
- The complete suite and architecture validator must pass before release. No world/Item/Actor migration or broad placement changes.
- Remaining live Foundry risks: canvas-window pointer capture, shaped storage hitboxes, item transfers under disconnects or failing hooks, and concurrent GM writes. Node mocks do not establish in-game behavior.
