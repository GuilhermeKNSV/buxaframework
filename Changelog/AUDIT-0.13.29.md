# Buxa Framework v0.13.29 — Work on the 23 Audit Follow-ups

**Baseline:** v0.13.28; preserves the existing inventory/ground-container data schema and compact storage window.
**Scope:** All 23 outstanding findings (23–45) were evaluated against the source. The statuses below distinguish finished code changes from partial risk mitigations and work requiring live Foundry/server validation. This is not a claim that all 23 were safely closed.

## Completed in this release — 11

- **24. Retry idempotency:** Added `physicalTransferLedger` (world setting) keyed by request nonce, claimant and payload. A finished request returns the stored result and does not repeat its mutation. Limited, bounded journal history.
- **25. Late commit / timeout:** When the original request times out, the client queries its transaction status. A confirmed receipt resolves it; an ambiguous request returns an explicit ID and instruction **not to retry blindly**.
- **26. Backpack rollback:** Restoration cleanup now recognizes only children created by the current transfer's unique instance IDs; it never deletes unrelated Actor Items created after the snapshot.
- **29. Save confirmation:** `sameStoredValue()` deep-compares confirmed structured entries without allocating two potentially large serialized JSON strings; incomplete saves still fail closed.
- **31. Ground branch traversal:** One parent→children index replaces iterative scans through the entire bundle for each nesting depth.
- **32. Actor backpack traversal:** `captureBackpackContents()` indexes children by storage provider once.
- **33. Nested restore writes:** Preflight ancestry and placements, then create siblings in batches ordered by dependency depth. No parent is created after its child.
- **35. Storage read failure:** A registered setting that throws during a live read now raises a clear error, rather than allowing an apparently empty store.
- **40. Inventory UI decomposition:** Occupied-cell hitmap listeners moved to `apps/inventory-board-hit-bindings.js`. Capture order and selectors remain unchanged.
- **41. Network UI separation:** Physical network request/status handling moved to `integrations/physical-item-request-channel.js`. Mutations remain in `physical-item-transfers.js`; protocol names and public functions are preserved.
- **44. Ground-container accessibility:** Focusable cells/items, arrow navigation over legal masked cells, Enter/Space lift and place, Escape cancel, and spoken status feedback. Pointer flow remains untouched.

## Partially mitigated — 6

- **27. Reconciliation journal:** Pending/done/interrupted records are persisted and queryable. `game.buxaframework.inspectPhysicalTransactions()` exposes a read-only GM diagnostic and `game.buxaframework.acknowledgePhysicalTransaction(id, note)` marks a manually verified interruption as reconciled without moving any Item. **Automatic rollback/roll-forward after power loss is not implemented**; a GM must check both locations first.
- **30. Clone pressure:** `packedContentsCount()` avoids deep-cloning packed descendants for quantity-only checks. Large bundle transformations still intentionally clone their snapshots to preserve source isolation.
- **34. GM handover:** A new GM returns stored successful results, and will not repeat an interrupted request. A true distributed GM lock and in-flight takeover protocol still require live testing.
- **36. Duplicate scene IDs:** Added `diagnosePhysicalSceneItems(scene)` for non-destructive diagnostics; duplicate/missing IDs are now refused during world writes. Deliberate automatic repair is omitted because blindly reassigning IDs could duplicate or orphan items.
- **43. Cell-size centralization:** Ground-container rendering derives ghost, viewport and hit coordinates from `GROUND_STORAGE_CELL_PX`, passed into the ground CSS variable. Other Actor-sheet styles still contain legacy 58 px rules; no world-wide scaling customization was introduced.
- **45. Soft-size warnings:** Extracted network and complex hitmap modules. Eight pre-existing/related soft warnings remain; hard-size and bootstrap limits pass.

## Not closed / intentionally deferred — 6

- **23. Authenticated socket sender:** Raw `game.socket` module broadcasts expose a *client-supplied* `from`, not a documented authenticated user context in the receiving handler. Permissions are checked for the claimed User, but that does not protect against intentional sender spoofing by a malicious client. An authenticated transport/backend mechanism is required before calling this resolved. Do not deploy on an adversarial public world assuming full transaction isolation.
- **28. Split physical world storage by scene:** Current world setting is one JSON object across Scenes. Per-scene settings, migration, and multi-GM coordination would change persistence format and need in-world data migration tests, so not attempted in this safe release.
- **37. Exact native fog masking:** Five-point visibility gating remains an approximation. Correct match to Foundry's actual clipping mask requires live V14 scene and wall/vision tests.
- **38. GM-side authoritative vision:** Client-side invisibility is not a security boundary. A robust requester-specific, GM-verified LOS check needs verified vision-source semantics on the GM's canvas. This has not been represented as secure yet.
- **39. Full ground-container controller decomposition:** Kept the working compact markup and pointer targets intact. Larger renderer/controller separation can follow tested Foundry UI screenshots.
- **42. Differential ground-grid DOM updates:** Still reconstructs cells on major update. Keyed updates would benefit large chests but risk stale listeners and incorrect transfer previews without a real-browser integration suite.

## New verification

- Tests include: persisted request replay across simulated GM handover; interrupted request replay refusal; live-store failure reporting; malformed scene-ID diagnostics; unrelated concurrent Item surviving restore rollback; nested branch traversal; keyboard navigation; deep value confirmation.
- Browser layout check with Chromium: compact 3×3 centered window **176×218 px**; cropped slot 6 remains hit-testable, preview z-index remains above the window, and each rendered cell now measures **58×58 px** rather than 60×60 from border expansion.
- Existing Inventory→Board/Backpack, Board→Actor/Chest, storage window, item-sheet/tooltip, and world storage formats remain unchanged.

**Limitations:** Node tests cannot validate live multiplayer sender identity, server failure semantics, Foundry token vision clipping or full native application drag events. Back up your world and verify GM/player interactions before rolling out.
