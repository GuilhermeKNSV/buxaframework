# Buxa Framework v0.13.52 — Atomic pre-root backpack placement staging

- Correct the regression introduced by the v0.13.51 root-scoped Actor.updateDocuments workaround; restore the normal Actor.update persistence mechanism used by working inventory operations.
- When picking up a **filled** chest from the board (open OR closed), first reserve IDs for the chest and every contained item, validate the complete projected Actor storage geometry and save all placements *before creating even the chest's embedded Item document*.
- Create the chest and nested Items in parent-before-child order using those reserved IDs. No Actor inventory flag write occurs after the chest Item exists during this transfer, avoiding the Foundry V14 embedded-Actor document-context exception.
- Ensure all child positions/rotations are kept and preserve rollback on failed flag writes or partial Item creation. Empty storage and regular item paths stay unchanged.
- Add a regression that throws the exact previous error on any Actor inventory update after the root chest is created (the earlier tests only blocked updates after its children were created). Include tests for rollback, nested contents and shaped containers.
- This is a code/tested change, not a confirmed Foundry runtime fix. Back up the world and test both open and closed filled chests.
