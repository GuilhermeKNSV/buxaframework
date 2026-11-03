## 0.13.45 — Closed ground-container backpack pickup recovery

- Fix a blocked board-to-Actor transfer when a closed container has saved child cells that no longer pass Actor inventory geometry checks (e.g. stale overlapping cells or changed shapes).
- Restore **all** contained Item documents and preserve valid compartment positions and rotations. Any incompatible child remains tracked and recoverable through the Actor Inventory Overflow, retaining its original saved compartment coordinates instead of being silently deleted or automatically repacked.
- Show a one-time warning if any contents need manual placement. A genuine malformed bundle still fails validation with source and rollback protection intact.
- Add two board-to-Actor regression tests for closed chests with stale overlapping and out-of-bounds placements. Preserve ground-storage drag, pointer hits, and backpack rotation fixes from v0.13.44.
