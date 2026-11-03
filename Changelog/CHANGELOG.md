# Buxa Framework 0.17.35 — Interface refinement

See [CHANGELOG-0.17.35.md](CHANGELOG-0.17.35.md) for the current release and validation details.

# Buxa Framework v0.13.87 — Item Editor Performance & Storage Mode UI

- Optimized the Dice/Increases rule editor: typing updates only the affected row's summary rather than rebuilding every source picker and rule card per keystroke. New/removed rows still trigger full picker discovery.
- Optimized Item Configuration navigation: switching tabs now touches only the previous/current panel and visible group buttons, avoiding repeated hidden-panel DOM invalidation.
- Moved each pouch's independent `itemMode` selection into a conspicuous **Storage Inventory Mode** section inside Function → Storage → External Compartments. Available options remain Follow inventory, Simple (1 slot/item), Complex (original footprint).
- Added guidance when no pouch exists and mode-specific hints; item shapes and existing persisted flags remain unchanged.
- Added regression tests for hot-path input updates and the per-pouch mode selector.
- Full Node test suite: 1079/1079 passed. In-Foundry visual validation is still recommended.

# v0.13.83 — Simple inventory and external storage reliability

- Fixed dragging and picking up items from a Simple-mode external storage compartment. Even if an Item has a large Complex footprint, its Simple pouch placement uses exactly one tile.
- Dropping on a pouch header now automatically chooses a valid free cell (respecting the custom mask) rather than failing on the first occupied/disabled tile. The same behavior is available through the inventory move runtime.
- Compatible stacks can now merge when dropped onto occupied Simple storage cells; incompatible items remain in place without overlap.
- Moved pointer storage resolution and validation into a focused helper to keep the large inventory drag controller bounded.
- Added 10 regression tests for Simple storage pickup, masks, capacity, swaps, unequip, sort, mode switching, auto target, and pouch stacking; pre-existing tests retained.
- Test result: 1056/1056 Node tests pass, architecture guard passes. Live Foundry V14 interaction remains to be verified by the user.

# v0.13.79 — Scene FX and rebirth direct-entry correction

- Distinct animated SVG scene celebrations above Tokens (gold level-up and rarity-colored rebirth) replace failing PIXI-only effects.
- Rebirth direct-value entry now edits invested points instead of temporary item-boosted display values.
- Fixed consecutive progression-event deduplication and added regression tests.

# 0.13.78 — Scene progression visual rework

- Reworked the in-scene level-up and rebirth celebrations so the main badge appears above the token, with a more visual gold level-up effect and rarity-colored rebirth effect.
- Added richer aura, burst and badge treatment while keeping the fallback floating text above the token as well.

# 0.13.77 — Scene progression animation reliability

- Restored level-up and rebirth token celebrations using committed Actor progression updates, reliable scene-token matching, multiplayer deduplication and native Foundry floating-text fallback.
- Added GM-only in-scene visual preview for both effects, without spending progression points.

# Buxa Framework 0.13.76 — Pre-feature stability pass

- 73 reproducible failing cases corrected across progression safety, Resource reads, text checkbox persistence and scene viewing identity.
- Added per-Actor progression mutation guard and observer hook error isolation.
- 1028 tests pass; see `AUDIT-0.13.76.md`.

# Buxa Framework 0.13.75 — Additional source audit

- Introduces a shared safe numeric/boolean input parser to stop blank Foundry form values and serialized string checkboxes from altering mechanics unexpectedly.
- Corrects dice, resource, limit, storage and stack artwork normalization.
- Hardens storage clipping, invalid mask and item occupancy, token-based quick drops, scene bounds and visibility authorization.
- Enforces actual Item ownership and World Item source identity for uses and material recharge.
- Validates nested chest IDs and invalid rotations while retaining compatible legacy numeric rotation strings.
- Adds 147 focused regression cases, of which 129 fail on untouched 0.13.74.
- 928 total tests pass; see AUDIT-0.13.75.md.

# 0.13.74

See [CHANGELOG-0.13.74.md](CHANGELOG-0.13.74.md) and [AUDIT-0.13.74.md](AUDIT-0.13.74.md).

# 0.13.73

See [CHANGELOG-0.13.73.md](CHANGELOG-0.13.73.md) for the compact drag-and-drop Recharge Item selector.

# 0.13.72

See [CHANGELOG-0.13.72.md](CHANGELOG-0.13.72.md) for Item Recharge changes.

## 0.13.71 — Exhausted item icon polish

- Replaced the missing-glyph lock square with an unboxed SVG lock on exhausted inventory items, without changing item-use logic.

# v0.13.70 — Item Sheet visual consistency

See `CHANGELOG-0.13.70.md`.

## v0.13.69 — Readable dice formulas in Item tooltips

- Shared numeric dice display (`1d4 + 0`) for Item dice, Resource effects and configuration summaries.
- Roll mechanics and saved configurations unchanged.

# Buxa Framework v0.13.68 — Item Use Presentation Polish

- Redesign the Item Sheet's Resource Effects and Item Uses sections to match the existing fantasy item-card presentation rather than generic blue control boxes.
- Replace the large use-count row with a compact, rarity-colored charge indicator and a visible progress meter. Exhausted Items remain visually marked.
- Show resource amount/formula first, followed by the configured resource, restore/drain action and before/after roll timing. Make dice modifiers and advantage/disadvantage easier to read.
- Apply the same typography and restrained rarity accents to inventory hover tooltips, with smaller spacing appropriate for hover previews.
- Keep the original Item Use, dice-roll, resource updates, use limits, transformations, and persistence mechanisms intact. No Actor/Item data migration.

**Verification:** 689/689 Node tests passed (2 new presentation tests), JavaScript syntax, CSS parsing and architecture validation passed. Visual integration still needs testing within Foundry V14; the Chromium smoke check was unavailable in this environment.

# 0.13.67 — Resource & Limits Reliability Audit

- Apply advantage/disadvantage to non-d20 Item and Resource dice (for example, 2d10 advantage now evaluates as `4d10kh2`, instead of ignoring advantage).
- Resource effects check configured attribute-dice and modifier references before spending resources; missing sources produce a clear error rather than silently omitting their effects.
- Validate the Actor's current resource amount before each before/after effect write. If another operation changed HP/MP during an async roll, do not overwrite it with stale values.
- Track only the resources actually written by an Item use and roll back only those values. Do not wipe out unrelated HP/MP updates when a use fails.
- Keep independent Item use-counter changes intact when another operation updated the count while a roll was pending.
- Handle Foundry post-save hook errors carefully: verify the actual committed state before treating a rollback as failed.
- Existing Resource/Limits flags and saved Item instances are unchanged. No migrations.

**Validation:** 687/687 automated tests pass, including new coverage for resource conflicts, usage-counter conflicts, non-d20 advantage, deleted modifier sources and post-save failures. Architecture and JavaScript syntax checks pass. Actual Foundry V14 interaction testing is still needed.

# 0.13.66 — Item Resource Effects and Use Limits

- **Item Configuration → RESOURCE**: multiple independently configured HP/MP and other configured resource drain/restore effects. Each triggers before or after an Item use/roll and supports a flat amount, a percentage of maximum, or Foundry dice. Resource dice use the same fixed/attribute source, flat bonus, modifier and advantage/disadvantage rules as Item Dice.
- **Item Configuration → LIMITS**: max uses per embedded Item instance (tracked in `flags.buxaframework.itemUsage`), and exhaustion behavior: Disable (visible lock), Destroy, or Transform into a chosen World Item of the same Foundry type. A GM may manually edit/reset the spent uses on owned Items.
- Item context actions and Item Sheet rolls invoke the resource/limits checks. A **USE ITEM** action supports limited-use or resource-only Items with no configured dice.
- The Item Sheet and inventory hover tooltip display resource charges/restoration and remaining uses. Exhausted inventory tiles and Item Sheets are visually marked as locked. Resource-only uses show results in Chat.
- Insufficient resource amounts prevent a roll and do not consume uses. Failed use operations attempt to restore paid resources and spent-use flags. Foundry resource document writes are batched by phase.
- Safety: limited-use Items never auto-merge and discard independent use counters. Destroying a stacked item consumes a single unit (then resets its counter); transformation requires unstacking first and preserves the embedded Item ID and inventory placement.
- Legacy Items have Resource/Limits disabled by default. No destructive migration of existing settings or items.

**Verification:** 681 tests pass (14 new targeted tests), syntax and architecture validation pass. Browser navigation for visual smoke checks was blocked in the test environment; Foundry V14 runtime verification remains necessary.

# 0.13.65 — Module Configuration UI Polish

- Compact, aligned controls throughout Resource, Attribute, Stats and Proficiencies configuration; less nesting, consistent checkbox alignment, responsive layout inside Foundry windows.
- CSS-only change; saved settings and game mechanics are untouched.

# Buxa Framework v0.13.64 — Sources and Scene Progression

- **Module Configuration → Player Sheet → Attributes:** added **Allow attribute minimize / maximize** (enabled by default). When switched off, every attribute always renders expanded and its collapse button is hidden. Previous per-client collapse selections remain stored and are available if the setting is re-enabled.
- **Sources UI:** wider, higher rows with improved artwork, readable item names, colored item rarity accents and clear value columns. Long source lists scroll within their panel.
- **Item source navigation:** clicking a source Item uses its exact Actor-embedded Item ID to switch to Inventory and highlight the item briefly. Supports equipment tabs and reveals closed storage compartments when possible, without changing Item documents.
- **Scene progression VFX:** level-up creates an ascending blue/gold ring, rays, particles and a level banner over matching visible Tokens; rebirth creates a rarity-tinted sigil and outward orbiting shards, labeled with the attribute and tier. Effects play only following successful progression, run briefly, and clean up their PIXI/Ticker objects.
- **Multiplayer:** the progression effect is sent through the module socket to other users viewing the same scene; the sender does not play it twice. Effects are purely visual, not persisted gameplay state. Reduced-motion clients see a shortened and simplified effect.
- No saved Actor/Item/Scene migration, no changes to inventory placement or backpack transfers.

**Verification:** 664 automated tests including 7 targeted tests, JS syntax validation, CSS parsing and architecture check. Scene VFX still require live Foundry V14 verification for canvas rendering and multiplayer timing.

---

# Buxa Framework 0.13.63 — Full-bar Rebirth Unlock

- Widened the responsive attribute score control to accommodate three and more digits without squeezing the controls or the name. Includes a two-row fallback for narrower sheet windows.
- Replaced the tiny rebirth icon and readiness label with a full-attribute-bar lock gate, using the next rarity color as an accent.
- After confirmation, the gate charges before committing the rebirth. On successful persistence the new rarity palette appears with a lock-shatter/sweep/glow reveal. Failed/cancelled rebirths do not reveal a new tier.
- Blocked double-submission from rapid clicks, kept keyboard focus via a native button, and honored reduced-motion preferences.
- Added interaction tests for confirmation, duplicate clicks, failed saves, lock-break overlays, and Source/CSS layout checks.
- No change to Actor flag schemas, attribute point accounting, or item/inventory behavior.

Automated and DOM layout tests run locally; real Foundry V14 gameplay testing remains necessary.

---

# Buxa Framework v0.13.61 — Storage, Editor and Transfer Safety

**Based on 0.13.60; no changes to persisted Actor, Scene or Item schemas.**

- **Ground storage drag performance:** Introduce immutable, cached occupied-cell snapshots. The open-container pointer drag checks its prospective cells without cloning the entire packed Item bundle per pointer move. The cross-surface placement planner now builds one footprint checker for its full location/rotation search; the final authoritative GM operation still validates the current saved data. Existing invalid/masked legacy entries remain recoverable rather than blocking visibly empty cells.
- **Stack image editor:** Layer additions, removal, movement, rotation, size, and opacity now stay in a temporary editing session. **Apply** commits the composition to Item Configuration; **Cancel**, **×**, backdrop click, and **Escape** discard the pending edit. Pointer listeners and the Escape listener are detached on close. Late image-picker responses do not change canceled work.
- **World export rollback safety:** Exporting an Item out of ground storage to the Item Directory now verifies whether the scene actually persisted the removal before deleting a new world copy after a hook error. Avoids deleting the only copy when a scene write succeeds but its Promise rejects. Failed compensating deletes are reported explicitly.
- **Module organization:** Extracted pure ground-cell hit testing and the reusable occupancy checker into focused core modules; extracted export recovery handling into a small integration module. Reduced `ground-container-window.js` beneath the 500-line soft guideline. Existing module APIs and import paths remain compatible.

**Tests:** 644/644 Node tests passed (including 9 new tests), plus syntax/architecture and ZIP checks. The existing repeated backpack round-trip and cross-surface tests also pass. Testing was source-side/mock-side only: a running Foundry V14/D&D 5e 6.0.x integration test is still required for real canvas/window hit testing and native Actor document hooks.

---

# Buxa Framework v0.13.60 — Deep source audit fixes

- Prevent automatic or manual stack merging when Item configurations, rarity, Buxa bonuses, or other saved system data differ, even when the identity/stack key matches. Respect each Item's maximum stack capacity.
- Correct Image Library In Use status for current per-scene board items, custom stack artwork image rules/compositions and packed backpack children; ignore stale legacy Scene items after partition migration.
- Fix rotated Complex inventory equipment-swap collision validation to use the saved rotation.
- Three regression tests initially failed against v0.13.59 and now pass.
- Full suite: 635/635 passed. See `AUDIT-0.13.60.md` for remaining runtime risks.

---

# Buxa Framework 0.13.59 — Board-to-crate auto-placement fix

- Fix scene Item -> crate sprite drops incorrectly rejecting usable storage with "No compatible space for this item's configured footprint". The sprite target has no `valid` flag because it does not identify a specific storage cell; the old handler treated that as an invalid manual grid placement.
- Distinguish **explicit grid drops** from **automatic crate-sprite drops**. Grid drops still require a valid planned target; sprite drops let the authoritative GM placement resolver find free cells and item rotations across compartments.
- Added an integration regression using the pictured 5×4 chest layout with two axes and a stack of coins: a 2×3 sword now enters at index 5, with all previous contents intact. The regression fails against the v0.13.58 source and passes with this fix.
- No item flag migrations, shape changes, or automatic movement of existing chest contents.
- Automated tests: 632/632 passed. JavaScript syntax and architecture checks passed. Live Foundry V14 validation still required.

---

# Buxa Framework 0.13.58 — Stacking Artwork

- Moved the existing stackable/individual mode and Max Stack out of Basic into a dedicated **Stacking** tab.
- Added configurable quantity thresholds (e.g. 2+, 4+, 10+). The highest matching threshold selects the artwork; quantity 1 uses the original image.
- Each threshold can use a separate chosen image or a custom layered composition.
- Added a composition editor: add the current item image as many times as desired, browse for other layers, select individual layers, drag to move, drag handles to rotate/resize, and adjust size/rotation/opacity. Artwork paths and layer transforms are saved per Item; no generated image files are written to disk.
- Integrated threshold artwork into Actor inventory (Simple and Complex), external storage compartments, item sheet, ground containers, and scene sprite rendering. Dragging from inventory copies custom artwork to the preview.
- Maintained older item rules without stack art and preserved existing Max Stack values.
- Added tests for quantities, normalization, old-item compatibility, custom layers, markup escaping and tab separation.

**Limitations:** For composed artwork rendered on the scene canvas, source image assets must be readable from Foundry's current origin for browser Canvas composition. Broken/unreadable source layers fall back to the ordinary item image. A real Foundry V14 interactive smoke test has not been performed; this build has Node regression coverage and source checks.

---

# Buxa Framework — Changelog

## 0.13.57

- Inventory items can be dropped directly onto backpack tiles to store them inside, with exact occupied-cell hit testing and full-container protection.

# Buxa Framework v0.13.56 — Second audit

- Fail closed on corrupt/duplicate Scene physical-item metadata; block unrelated writes and migrations from silently losing hidden bad records. Validate incoming records too.
- Recover newly created stack Items from a Foundry post-create hook error; never delete existing Items with the same appearance.
- Repair Unstack's post-create and post-update hook rollback so unsuccessful operations do not leave duplicate stacks or lose quantity.
- No change to item geometry, normal drop routing, existing flags, or default inventory behavior. Seven regression tests added.
- See `AUDIT-0.13.56.md` for the review, safety guarantees and remaining runtime risks.

# Buxa Framework v0.13.55 — Code audit and transfer-safety hardening

- **Fresh Foundry operation options:** Stacking, native Item import, moved-item auto-stacking, and manual merge/rollback now generate a separate options object for each embedded Item action. This prevents Foundry-added `parent` and `pack` fields from leaking between document operations.
- **Do not silently discard corrupted chest contents:** Non-array `backpackContents` metadata is now rejected instead of interpreted as an empty chest. Such a transfer remains blocked until the GM repairs the saved data.
- **Ground storage validation:** Nested bundle rotations must use supported quarter-turns (0–3); invalid metadata is rejected before persistence.
- **Pointer accuracy:** A chest drop on window chrome, a scrollbar, or a masked-out/unusable grid cell cannot silently auto-place an Item somewhere else. Legitimate drops inside grid cells still run the existing validated placement planner.
- **Repair transparency:** If the Actor rejects a repaired backpack placement and the rollback also fails, the module reports that rollback failure explicitly rather than swallowing it and claiming nothing changed.
- Five new regression tests cover Item-option mutation during create/update/delete/rollback, malformed packed metadata, and invalid rotations. 607/607 automated tests pass; all 161 JS files pass `node --check`; architecture validation passes with nine pre-existing soft-size warnings.
- No migration, saved Item flags changes, or feature removal. Actual Foundry V14 interactions, especially ground-storage drag/drop and repeated backpack transfers, remain **unverified in a running Foundry world**.

# Buxa Framework v0.13.54 — Ground-storage drop targeting and footprint feedback

- Recalculate the actual ground-container placement at pointer release instead of accepting cached drag-hover decisions. Covers Scene → chest, Actor inventory → chest, and native Item Directory → chest drops.
- Preserve the shared occupied-cell collision validator, automatic valid rotations, original target indices, and the already-working chest pickup/round-trip transfer behavior.
- When a configured Item footprint cannot fit, show its real footprint in red over the chest rather than silently clearing the preview; explain the configured width, height and occupied-cell count, rather than inaccurately stating that the entire chest is full.
- Add three focused regressions for the pictured 5×4 chest layout, its tightly packed axe/gloves/coin cells, the 2×3 sword placement, and honest invalid-footprint feedback.
- 602 Node tests pass, syntax checks and ZIP integrity verified. Live Foundry V14 integration remains unverified. No Item or Actor data migrations.

# Buxa Framework v0.13.53 — Stop leaked Foundry embedded-document options

- Fix closed/open filled-storage pickups failing on the **second or later round trip** with `Actor is not a valid embedded Document within the Actor Document`.
- Root cause: `physical-item-transfers.js` shared one mutable `MUTATION_OPTION` object across Actor and embedded Item document operations. Foundry document methods can add `parent`/`pack` fields; subsequent Actor updates inherited the stale embedded-document parent and failed.
- Every physical-transfer document operation now receives a fresh, isolated options object. Backpack restoration additionally discards any leaked `parent`/`pack` fields before writing the Actor or creating children.
- Preserve previously implemented pre-root inventory staging, storage geometry, shape rotations, and transaction rollback; no migration required.
- New regression first reproduced the exact error on v0.13.52 after a successful pickup followed by a drop and second pickup. Added a three-cycle round-trip test with deliberately mutated `parent`/`pack` on every embedded Item operation; all contents and original compartments persist.
- Tests: 599/599 passed; module syntax and architecture check passed. This is not yet verified in a live Foundry V14 world.

# Buxa Framework v0.13.52 — Atomic pre-root backpack placement staging

- Correct the regression introduced by the v0.13.51 root-scoped Actor.updateDocuments workaround; restore the normal Actor.update persistence mechanism used by working inventory operations.
- When picking up a **filled** chest from the board (open OR closed), first reserve IDs for the chest and every contained item, validate the complete projected Actor storage geometry and save all placements *before creating even the chest's embedded Item document*.
- Create the chest and nested Items in parent-before-child order using those reserved IDs. No Actor inventory flag write occurs after the chest Item exists during this transfer, avoiding the Foundry V14 embedded-Actor document-context exception.
- Ensure all child positions/rotations are kept and preserve rollback on failed flag writes or partial Item creation. Empty storage and regular item paths stay unchanged.
- Add a regression that throws the exact previous error on any Actor inventory update after the root chest is created (the earlier tests only blocked updates after its children were created). Include tests for rollback, nested contents and shaped containers.
- This is a code/tested change, not a confirmed Foundry runtime fix. Back up the world and test both open and closed filled chests.

# Buxa Framework v0.13.51 — Root-scoped closed-storage Actor save

- Addresses the v0.13.50 failure at `restoreBackpackContents` where `Actor5e.update()` routes a world Actor inventory flag update through an invalid embedded Actor context (`Actor is not a valid embedded Document within the Actor Document`).
- World Actor backpack placement/repair writes now use `Actor.implementation.updateDocuments` with an explicit `parent: null` and a world Actor `_id`. This uses Foundry's documented top-level document update path instead of `actor.update()` for that operation.
- Synthetic token Actors keep using their instance update path to avoid writing their world template.
- Confirms committed inventory placements before creating backpack children. The existing transaction keeps the chest on the board and rolls back the destination if a save fails.
- Regression test reproduces the exact error on the previous v0.13.50 code; the new root-scoped update route passes. A second test verifies scene contents remain when the root document write fails.
- 597 automated tests passed, architecture and ZIP checks passed. Real Foundry V14 testing still required.

## 0.13.50 — Closed storage pickup transaction
- Stage positions and Item IDs before embedding children, avoiding post-child Actor.update; atomic rollback safeguards.

## 0.13.49 — Closed chest pickup: validate before saving Actor inventory

- Fix the reproduced Foundry V14 `Actor is not a valid embedded Document within the Actor Document` error triggered by the **second** Actor inventory update while restoring a closed chest with conflicting child placement metadata.
- Preflight the complete restored backpack, its nested compartments, saved positions, rotations and actual embedded Item shapes using the existing Actor inventory geometry, **before** writing any new child placements to the Actor document.
- Preserve every legal cell exactly. Only if a saved placement is invalid, try a legal location inside the **same** compartment. Abort safely without consuming the scene chest if none exists. Avoid the previous write-invalid-flags-then-rewrite repair path.
- Commit validated child placements in **one Actor update** after item creation. Confirm final accepted placements before removing the ground source.
- New regression tests reproduce the original v0.13.48 failure text, verify this build avoids it, and confirm a rejected final Actor update leaves the chest and all contents on the ground without embedded Item duplication.
- No migration or destructive cleanup. Live Foundry V14 validation still required.

## 0.13.48 — Match closed-chest pickup to visible storage cell geometry

- Fix the underlying mismatch between open scene chests and Actor storage: shaped items are positioned by the bounding-box origin, which may be an *empty* cell outside the storage mask. The Actor's `validLocation` wrongly demanded that origin be a valid storage square, even when every occupied footprint cell was legal. This rejected legitimate axe/sword/glove arrangements during closed-chest pickup.
- Keep exact occupied-cell geometry authoritative through `fitsExternalStorage` for all Actor storage movement and reconciliation. Cells actually outside the mask, overlapping other items or off-grid are still rejected; only the unnecessary bounding-origin rule was removed.
- Closed-chest pickup now preserves valid irregular/rotated item placements without repacking, repair, Overflow, or an unnecessary transaction rollback. The restored backpack remains movable after pickup.
- Add an end-to-end board-chest pickup test with four closely packed items, including a masked-out top-left origin, and three parity tests comparing open ground storage with Actor storage for all four rotations, neighbor collisions, and forbidden cells.
- No data migration or modified contents are required; previously saved valid positions remain as-is. Foundry V14 runtime testing still required.

## 0.13.47 — Closed backpack transfer recovery without Overflow

- Prevent Buxa's Item lifecycle hooks from re-running Actor inventory reconciliation in the middle of GM-authoritative physical transfers, or after an internal Item snapshot update.
- Keep valid board-container item positions and rotations when restoring into an Actor. If a previously saved child no longer fits its original position, find a safe cell within its own compartment (not the Actor main inventory or Overflow); preserve unrelated Items.
- If the contained item cannot fit anywhere in its original compartment, abort the pickup and roll back created embedded Items. The chest and its contents remain on the board, instead of producing a false successful transfer and a broken backpack.
- Repair older Actor backpack placements still pointing at invalid storage coordinates when the owner tries to transfer the backpack. Contained Items are included in the transfer rather than dropped/left behind in Overflow.
- Add regression coverage for legacy placements, no-fit rollback, hooked transaction guards, closed chests with rotated/shaped contents, and moving/retransferring the repaired backpack.
- Automated tests and syntax/architecture checks passed; live Foundry V14 behavior still requires confirmation.

## 0.13.46 — Preserve legal shared-origin Complex inventory placements

- Fixed the root cause of unexpectedly sending valid shaped items from board chests into Actor Inventory Overflow: the inventory reconciler rejected two Items whose *bounding-box origins* shared an index, even when their actual occupied cells did not overlap. L/T/irregular shapes may leave that bounding-box corner empty, making shared origins legal.
- Complex main inventory and external storage now validate actual occupied shape cells, rather than rejecting legal placements merely because the origins are equal. Simple inventory and equipment retain their exclusive-per-slot behavior.
- Board-to-Actor container pickups retain every valid saved compartment index and rotation without moving other Items or triggering false Overflow warnings. Existing false Overflow placements with their original storage coordinates in Actor flags can reappear in place on inventory refresh.
- Added 4 regression tests: legal shared-origin placements in main inventory and external storage, a shaped board-chest round-trip, and multi-case rotated/irregular-shape chest transfers. Preserved the v0.13.45 recovery behavior for genuinely invalid historical placements.

## 0.13.45 — Closed ground-container backpack pickup recovery

- Fix a blocked board-to-Actor transfer when a closed container has saved child cells that no longer pass Actor inventory geometry checks (e.g. stale overlapping cells or changed shapes).
- Restore **all** contained Item documents and preserve valid compartment positions and rotations. Any incompatible child remains tracked and recoverable through the Actor Inventory Overflow, retaining its original saved compartment coordinates instead of being silently deleted or automatically repacked.
- Show a one-time warning if any contents need manual placement. A genuine malformed bundle still fails validation with source and rollback protection intact.
- Add two board-to-Actor regression tests for closed chests with stale overlapping and out-of-bounds placements. Preserve ground-storage drag, pointer hits, and backpack rotation fixes from v0.13.44.

## 0.13.44 — Restore ground-storage drag/drop hitboxes

- Restore pointer hits on **occupied item cells** inside an open board storage window. The v0.13.41 inventory-specific CSS pointer filter accidentally disabled every chest item's interactive piece, without installing the Actor inventory's replacement cell-routing handler in this window.
- Keep item artwork and empty/irregular-shape portions noninteractive so pointers still reach the correct underlying storage squares. Ground container cells remain available as destinations for Actor, board and World Item drags.
- Preserve the v0.13.42 nested-backpack transfer fix and v0.13.43 ground drag lifecycle fix, including rotation and GM-authoritative writes. No data migration.
- Add regression test for the CSS interaction contract and run a real Chromium DOM hit-test: item pointerdown receives the event and an empty neighboring cell remains independently targetable.

## 0.13.43 — Ground storage item drag regression

- Fixed a drag-start ReferenceError preventing pickup of items inside open board storage.
- Added event-lifecycle regression coverage for ground storage pointer dragging and cleanup.

## 0.13.42 — Ground backpack pickup and drag fixes

- Restore packed board-container contents using the 0–3 quarter-turn rotation format shared by Complex inventory and ground storage; rotated items no longer produce an invalid metadata error.
- Preserve the original nested parent, compartment, slot index and rotation for all restored items. Existing strict validation and rollback continue to protect contents on failed transfers.
- Fix ground-container drag-start crashing when the pointerdown event has ended (`event.currentTarget` becomes null). Remove drag styling reliably when the gesture ends.
- Include regression tests for rotated multi-item transfers, malformed rotations and persistent source data after a failed restore.

## 0.13.41 — Item UI, tooltip and precise Complex inventory hitboxes

- Double-click image selection; choice of any rarity for storage tooltip accents.
- Case-sensitive item titles, configured stat colors, off-by-default equipment and storage tooltip.
- Fixed stack controls layout, shape hitboxes and unexpected invalid-placement relocation.

## 0.13.40 — Recursive Image Library

Recursive descendant galleries and a top-bar default-folder shortcut.

## v0.13.36 — Restore World Item drag to Scene

- Allow copy-to-board and copy-to-Actor drops from the main Item Directory and nested folder panels, while preserving move-to-folder reordering.
- Fix the native HTML5 drag operation mismatch that prevented the Scene canvas from accepting directory Items.
- Added native drag/drop compatibility regression tests.

## 0.13.29 — Audit Follow-ups: Reliable Transfers & Maintainability

- Added a GM-owned world transaction ledger with persisted request receipts, safe replay suppression, interruption diagnostics, and a status query for late socket replies. No automatic retry of ambiguous commits.
- Restores packed backpacks by nesting depth in batches and rolls back only child Items positively tagged with this transfer's identity; unrelated concurrent Items remain safe.
- Indexed nested backpack and ground-container traversals to avoid repeated full-list scans.
- Prevented live world-storage read errors from masquerading as empty Scenes; added non-destructive duplicate-ID diagnostics and duplicate-write rejection.
- Replaced duplicate full JSON-string equality comparisons during world-save confirmation with a deep structured-value comparison.
- Reduced extra clone work for simple packed-child count checks.
- Extracted occupied-cell pointer-hit listeners and the physical socket/request queue into focused modules, preserving existing drag selectors and message shapes.
- Added focusable ground-container slots, arrow navigation, Enter/Space pick-and-place, Escape cancel, and accessible status text.
- Shared the ground window's 58-pixel geometry constant with CSS layout, fixed cell box sizing, and verified the compact 176×218 viewport in Chromium.
- This is not a security guarantee for raw socket sender identity: Foundry direct module broadcasts do not expose a documented authenticated sender to the receiving callback. Proper transport-level authentication remains open.
- No automatic reconciliation of interrupted transactions. GM inspection is available through `game.buxaframework.inspectPhysicalTransactions()`, `game.buxaframework.acknowledgePhysicalTransaction(id, note)` and `game.buxaframework.diagnosePhysicalSceneItems(scene)`; review suspicious transactions manually before repeating a request.

## v0.13.28 — Stability audit and integrity hardening

- Reviewed source and documented 45 findings in `AUDIT-0.13.28.md` (22 implemented, 23 follow-ups).
- Hardened source-item permissions when importing ground loot into nearby containers, and player drop limits when exporting contents onto the board.
- Rejected invalid/hidden linked-token coordinates and out-of-scene artwork footprints.
- Validated nested ground-container ancestry and collision-free unique identity remapping.
- Prevented parent-to-descendant backpack cycles and storage footprint row-wrap hitbox issues.
- Normalized duplicate tooltip and maximum-length compartment IDs, and preserved coordinates in partial artwork edits.
- Left UI layout, transfer storage format, rarity visuals, and user item data unchanged.

## 0.13.26 — Cropped ground storage and drag-layer repair
- Ground container windows now crop to the actual visible storage cells, not the underlying saved grid dimensions. A centered 3×3 shaped pouch on a 5×5 grid renders as a compact 3×3 viewport.
- Preserve original storage slot indices and item placements while cropping, so transfers and positions remain stable.
- Inventory, directory, and ground-container drag ghosts render above floating ground storage windows without capturing pointer hits.
- Drop targeting rejects disabled/hidden cells instead of accepting an invalid empty-looking area.
- Added regression coverage for crop geometry, pointer-to-slot mapping, and preview layering.

## v0.12.7 — Crisp Player Settings controls

- Replace long HUD style and visibility button text with short, readable labels; keep full meanings in accessible descriptions/tooltips.
- Constrain segmented control options to responsive grid cells with one-line text, overriding Foundry's global button min-width/typography.
- Remove rounded corners from Player Settings surfaces, buttons, toggles, slider thumbs, status badges and resource tracking button.
- Preserve existing resource settings, Actor data and HUD mechanics.

## v0.12.5 — Remove radial token HUD style

- Remove radial token resource rendering and remove the radial option from Player Settings.
- Keep SAO, Classic, and Vertical HUD styles, including zoom responsiveness and customization.
- Previously saved radial resources render as Classic bars without changing Actor flags; an explicit Player Settings Save converts the obsolete style setting to Classic.
- Preserve existing resource values, tracking, visibility, numbers, colors, offsets and other settings.

## 0.12.2 — Zoom-responsive token resource bars

- Token resource HUD automatically compensates for zooming out, keeping its health/resource bars and numbers readable without changing saved Actor settings.
- Limit enlargement to a gentle maximum factor and approximately 31% of the canvas width (up to 380 screen pixels), preventing oversized bars at high zoom/custom scales.
- Keep all four styles centered on their own token while scaling, rather than drifting toward the canvas origin.
- Apply zoom scaling via a lightweight PIXI transform on `canvasPan`; ordinary panning and token movement do not rebuild bar graphics. No timers or per-frame tracking loops.
- Add regression tests for zoom math, size caps, pivot alignment, missing camera info, and zero graphics rebuilds during zoom.

## 0.12.1 — Player Settings saving and HUD visuals

- Fix Player Settings save failing due to native form validation of unnamed controls and an invalid 0.96 opacity step. Save and cancel now work via explicit actions.
- Close the popup after successful save, retain it on errors, and prevent duplicate saves.
- Remove Actor names from overhead resource bars; show only optional resource labels.
- Correct the beveled SAO fill geometry to keep the color within the bar.
- Prevent overlaps when multiple tracked resources mix SAO/classic or left/right side layouts at different thicknesses.

## 0.12.0 — Per-resource canvas tracking, visibility, and Player Settings

- New per-resource tracking icon in the Buxa Actor sheet. Toggle a resource's on-canvas display without touching system HP/MP bar configuration.
- New actor-scoped Player Settings popup replaces the one-item sheet gear menu; includes GM-only Link Player and expandable HUD controls for every resource.
- Four canvas styles: SAO-inspired beveled overhead bar, concentric radial token rings, top/bottom classic bar, and left/right vertical gauge.
- Customize color, scale, thickness, opacity, placement, X/Y offsets, display of label and current/maximum numbers, and number position.
- Viewer visibility: everyone, Actor owners, or specifically selected players; GM always sees configured overlays; normal Token visibility still applies.
- PIXI graphics are attached to the actual Token container for zero-lag movement and camera zoom; overlay rendering skips movement-only refreshes and redundant settings writes.
- Resource display settings persist to Actor flags and do not migrate or rewrite preexisting inventory, Item or Actor data.
- Added core permission/normalization/batch-write regression tests and a PIXI token lifecycle smoke test for all four styles.

## 0.11.31 — Custom display labels instead of Item types

- Remove the Item Type dropdown from Buxa's Create Item form; retain the internal Foundry system type required for valid documents.
- Item Configuration → Info → Item Label controls the optional, cosmetic text displayed in the item sheet, inventory tooltip, and item directory.
- Stop exposing Foundry's internal type (such as `tool`) when the display label is empty or disabled; no false label or extra directory separator.
- World Item directory search finds custom labels, not implementation-only system types.
- Preserve all existing item flags, system types, and world/Actor item data. No migration is required.

## v0.11.30 — Inventory integrity and equipment/storage swaps

- Stack merging now rolls back target quantities when an embedded source Item cannot be deleted, including failures raised by Foundry document hooks; missing source stacks are checked after deletion.
- Guard against post-update hook failures and zero-quantity sources manufacturing extra units when stacking.
- Storage providers must occupy a currently existing equipment slot within its valid loadout position; stale slot references no longer grant phantom space or compartments.
- Swapping an item out of an external pouch into occupied equipment can move the displaced item back into the vacated pouch cell, provided its full footprint fits the mask and existing contents.
- Added focused regression tests for failed writes/deletions, invalid equipment grants, pouch swaps, irregular footprints and prior edge-fit behavior. No saved inventory migration required.
- Automated verification covers document/geometry simulation; in-world Foundry V14 interaction still needs user testing.

## v0.11.29 — Complex item pickup and grid alignment

- Item dragging now anchors to the exact **occupied tile** clicked, including irregular and rotated footprints, rather than approximating the clicked tile from the item's overall bounding box.
- The grid's actual cell width and row height are measured independently for pointer hit testing and drag ghost positioning; this prevents visual/saved-cell disagreements in distorted or resized board layouts.
- Pointer-up without a real drag cleans up temporary scroll listeners.
- Added a tight-gap regression suite for 1×1 items beside L-shaped items, rotated items, occupied-square hitboxes, non-square grid measurements, and persistence without auto-packing.
- No inventory flag migration; existing item positions remain intact.

## 0.11.28 — Compact external storage panels

- Crop invisible outer rows and columns of custom-shaped pouches when displaying them inside Inventory, leaving only the visible slot footprint and a narrow frame.
- Keep each stored item's original slot index and placement geometry unchanged, preventing position shifts or item loss when existing compartments are trimmed visually.
- Automatically size all external compartment panels to their visible slot count while allowing scrolling on narrow sheets.
- Constrain pointer hit testing to visible storage cells; blank clipped space cannot accept item drops.
- Keep compartment titles compact and truncate long names rather than widening the entire pouch.
- Added regression checks for rectangular storage, irregular custom shapes, one-cell pouches and cropped-area placement.

## 0.11.27 — External storage positioning and editor fixes

- Fixed Complex pouch items rendering outside their assigned cells due to overridden absolute coordinates.
- External compartments now follow the parent inventory mode: Simple uses one cell per item; Complex uses full item footprints and rotation.
- Custom outlines remain available as editable slot masks, independent of inventory mode.
- Matched external compartment cell size to the 58px Complex inventory grid; wider compartments can scroll rather than shrink their cells.
- Removed item artwork from the custom storage shape editor. Left-click adds connected cells; right-click removes cells without disconnecting the outline.
- Cleared stale main-grid placement highlights when dragging over an external compartment.
- Added tests for global-mode inheritance, masked placement, visual geometry, and editor interactions.

## 0.11.26 — External storage shape editor
- Replace disconnected strip-like cells with a contiguous square grid based on the Item Size painter.
- Enable adjacent-cell painting for custom L/T/irregular compartments, plus reset and centered initial tile.
- Display one masked item icon above the footprint, rather than separate image pieces.
- Preserve selected cells correctly when grid dimensions change.

## 0.11.25 — Equipped storage and external inventory compartments

- Hide the equipment tab selector automatically when only one equipment tab exists.
- Equipment Layout slots can be marked Hidden. Hidden slots appear only after an equipped item explicitly grants their slot IDs.
- Item Configuration → Basic → Storage lets equipped items unlock hidden equipment slots and grant additional Simple/Complex inventory cells.
- Add removable external compartments that appear inside the Inventory page, not in an extra tab. Each compartment has its own title, grid, optional irregular shape mask, and item drag/drop positions.
- Configure a compartment to be Simple (rectangular grid) or Complex (paint cells to form arbitrary pouch outlines such as L shapes), with rarity-derived, neutral, or custom accent colors, optional border and background.
- Extra Complex capacity grants exactly the configured number of cells; unused tail cells in a partial row are blocked from packing and placement.
- Items whose storage provider is removed or unequipped remain on the Actor: inaccessible contents appear in Overflow until placed again. No item documents are deleted by the storage feature.
- Added modular core geometry, persistence, and integration tests. Existing item flags are normalized without a migration.

**Live validation:** Browser/Foundry V14 in-world drag/drop testing remains necessary. Storage is based on the actor's selected Buxa equipment loadout.

## 0.11.23 — Enlarged equipment artwork without stretching

- Fixed the regression where proportional `contain` artwork stayed tiny in elongated equipment slots: long weapon/tool artwork now receives an aspect-preserving zoom up to 1.8x.
- Scaling uses a **single uniform transform**. No X/Y distortion or stretching; excess transparent icon margins can be clipped by the slot.
- Size-aware eligibility prevents 1×1 coins and other small objects from becoming oversized or clipped in long offhand slots.
- Simple backpack icons and complex inventory artwork remain unchanged; slot backgrounds, rarity effects, drag, and equipment layout are preserved.

## 0.11.22 — Proportional equipment artwork (regression fix)

- Removed forced non-uniform scaling of tall/wide equipped item images introduced in 0.11.21. Square art is no longer stretched into unnaturally long weapons and tools.
- Item icons use aspect-preserving `contain` rendering with centered alignment for Simple inventory and equipped slots, regardless of slot dimensions.
- Removed the image-load DOM manipulation and dead artwork-stretch module. This also eliminates per-render image load handlers for equipment artwork.
- Unchanged: complex shape masks and artwork controls, rarity borders, equipped slot layouts, item footprints, drag-and-drop and document data.

## 0.11.21 — Adaptive inventory artwork sizing

- Non-square equipment slots now fit elongated items to the full slot area instead of confining their icons to a square.
- Square/round items retain their proportions, even in long equipment slots.
- Reduced wasted image padding in Simple inventory. The shared equipment artwork rule applies to both Simple and Complex modes.
- Left the Complex Size-tab artwork transforms, shape collision, borders, and drag anchors intact.

## 0.11.20 — Predictable complex inventory placement
- Dragging now anchors to the *occupied grid cell* grabbed by the cursor, instead of a fractional pixel position that could offset items unpredictably.
- Rotation carries that same grabbed cell through all four orientations, so items do not drift relative to the pointer.
- Placement previews, collision highlights and the saved drop all share one deterministic grid-cell origin; crowded spots are either valid exactly where shown or visibly rejected, with no silent neighbor relocation.
- Improved L-shape hit testing and edge validation; preserved stacking, rarity borders, artwork, and Simple inventory.
- Added focused tests for tight adjacent placements, incomplete/invalid cells, all rotations, occupied neighbours and 1×1 items.

## 0.11.19 — Complex rarity frame and decoration repair

- Replaced per-tile borders and rectangular-only rim elements with one reusable SVG outline renderer for every Complex inventory footprint.
- Rarity outlines, corner accents and ornament dots now follow real L, T, tall, wide and rectangular shapes, including 90-degree rotations; no inner grid seams.
- Preserved custom rarity colors, full/glint backgrounds, glows and spectrum/animated borders on settled items and drag previews.
- Invalid drop ghosts correctly turn red without changing the underlying rarity presentation.
- Reused pure perimeter geometry in the Player Sheet and drag ghost, removed legacy rim DOM and edge-style work from occupied hit cells.
- Added shape-and-rarity regression coverage and checked the rendered result in a browser.

## 0.11.18 — Complex inventory drag & tight-slot placement stability

- Removed the doubled artwork while dragging: one ghost now shows the exact saved destination inside the grid, while the source item is fully hidden.
- Fixed awkward near-item drops by searching only immediately adjacent valid origins for larger shapes when the grabbed footprint is blocked. Single-cell items stay directly under the pointer.
- Restored a clear invalid red ghost for genuinely blocked spots instead of silently placing items somewhere unrelated.
- Shared collision-aware placement resolution between pointer movement, rotation, grid highlighting, and release; retained stack-target hover behavior.
- Removed unused second-ghost implementation and added focused regression tests for cramped spaces, rotations, board edges and source visibility.

## 0.11.17 — Complex inventory placement clarity
- Align a light destination artwork preview exactly to saved grid cells while keeping the cursor ghost fluid.
- One-cell items now always target the cell under the pointer, regardless of the pickup location.
- Keep stack merging and multi-cell collision/rotation behavior intact.

## v0.11.16 — Complex Inventory Stack & Cursor Responsiveness

- Restore compatible stack merging in Complex inventory, with the actual occupied pointer cell used as the target even on multi-cell shapes.
- Keep footprint collision protection for normal item placement; merging is deliberate when releasing over a compatible stack.
- Display a distinct stack highlight when hovering a compatible stack, and clear it on exit/cancel.
- Make complex drag artwork follow every pointer movement; the separate snapped footprint preview still shows the exact drop cells.
- Recognize complex occupied hit cells in Foundry native item drops as stack targets.
- Extract stack-hover bookkeeping and pointer-cell mapping into small reusable modules.
- Add runtime stack-merge and pointer-hover regression coverage.

## v0.11.15 — Complex Inventory Rim & Immediate Drag Feedback

- Fixed missing rectangular rarity outline: legacy inventory CSS disabled the `::after` decoration; use a dedicated rim element and low-cost corner accent instead.
- Restored a subtle, continuous rarity border, while keeping internal item-cell lines hidden.
- Complex drag updates snapped ghost coordinates on pointer input without waiting for animation frames; only updates footprint states when the grid origin changes.
- Cached board geometry for the duration of a drag to avoid layout reads on every pointer movement.
- Preserved release alignment and the existing rotation grip behavior.

## v0.11.14 — Accurate Complex Inventory Drag & Polished Item Footprints

- Complex drag previews snap the **entire ghost** to the identical destination origin used by the eventual drop, rather than displaying a free-floating artwork with a different selected cell.
- Cursor/grip math is centralized in `scripts/core/complex-drag-geometry.js`. Press R to rotate around the exact grabbed point; release always calculates the destination from the final pointer event, even if no animation frame has run yet.
- Fixed a major relocation bug: manual Complex inventory placement disables automatic repacking; otherwise the item could be instantly sorted into a different slot after an apparently successful drop. Re-enable auto-sort explicitly to pack again.
- Complex mode no longer silently stacks an item when the pointer happens to be over another stack while dragging a shaped item. Full-shape collision prevention wins.
- Complete rectangular items have only rarity-colored corner indicators instead of internal grid borders. Non-rectangular L/custom shapes have an exterior outline without seams between occupied tiles.
- Restored masked dark-blue item backgrounds, gentle rarity tint, and a matching ghost backdrop. Original item artwork remains single-image, clipped to the occupied shape.
- Escape cancels a drag, final placement is collision-checked, and the original item stays where it was on an invalid release.
- Added pure-geometry regression tests and a headless browser rendering check. No item migration required.

## v0.11.13 — Inventory stability and additional performance fixes

- Keep complex drag-preview validity stable when the pointer stays on the same cell; unchanged highlights no longer cause an invalid ghost state.
- Protect occupied-cell scans from partially off-grid corrupted saved shapes, eliminating phantom collisions.
- Honor the configured complex inventory row count when calculating drop positions, including CSS rounding/borders.
- Ignore unrelated pointer movement and release events during a drag (multi-touch/pen safety).
- Keep the selected equipment tab visible across Foundry sheet redraws instead of briefly returning to the first tab.
- Skip generating unused Simple inventory slot views while in Complex mode.
- Eliminate duplicate shape packing during Actor inventory reconciliation when auto-sort is active.
- Guard empty-shape bounding-box calculations.
- Separate shared inventory drop hit testing from DOM drag handlers into `scripts/apps/inventory-drop-target.js`.
- Added focused regression tests for these cases. No flag or item data migration required.

## v0.11.12 — Complex inventory drag footprint

- Moving shaped items shows their full rotated footprint in the inventory, not a single target cell.
- Blue drop highlighting covers every occupied square; collisions and out-of-bounds placements turn red.
- The drag ghost stays sized to the entire item, and avoids the old square aspect-ratio CSS override.
- Invalid ghost origins cannot silently drop into the single square below the pointer.
- Preview cleanup is incremental and always removes highlighting on drop/cancel.

## v0.11.11 — Inventory safety and rendering fixes

- Fixed a complex-inventory Unstack collision: checking for a new stack no longer treats the source stack's occupied cells as available. Every cell of the original shape must remain blocked.
- New split stacks must receive a real inventory placement; if an intervening change consumes the free space, the operation rolls back instead of silently making an invisible stack.
- Complex inventory grid cells now carry a render-scoped item hit map, allowing every occupied cell to start a drag without rescanning and normalizing the entire Actor inventory on pointerdown.
- Normalized the footprint hit-map builder into a pure independent module and ignored out-of-range origins when compiling occupied cells.
- Resource edits with unchanged stored values no longer trigger unnecessary Actor updates or sheet redraws. Actual clamping and stat changes still persist normally.
- Simple inventory rendering skips complex artwork transforms, occupied-cell lookup construction and unused complex-grid template data.
- Added regression coverage for multi-cell splits, filled inventories, occupied-cell hit detection, invalid geometry and no-op resource writes.
- Existing Actor, Item and world data remain compatible; no migration required.

## v0.11.10 — Performance & Modularity Audit

- Cached the normalized world configuration by the underlying Foundry settings value; invalidation on world setting changes and explicit saves prevents stale rules.
- Reworked complex-inventory packing and collision testing to compile cell footprints once and keep a shared occupancy map instead of repeatedly rebuilding it for every candidate cell.
- Inventory drag collisions now reuse a per-drag occupancy scanner. Simple item clicks and double-clicks do not compute the actor's entire shape map.
- Rebuilt inventory placement validation to incrementally stamp already occupied cells, preserving item rotation and no-overlap guarantees.
- Skip unchanged auto-sort/sort-mode writes and unchanged inventory flag updates, avoiding unnecessary full Actor sheet redraws.
- Folder panels now reconcile individual folder DOM sections. Unchanged open panels, scroll states and drag interactions survive unrelated document updates.
- Paused expensive rarity animations during active inventory dragging; existing animations remain on outside a drag.
- Extracted Item Configuration view mapping and image browsing, Layout Configuration synchronization, and shared folder panel DOM reconciliation into independent application modules.
- Added performance/geometry/DOM regression checks. No Actor, Item, or world data migration required.
- Remaining template size warnings are non-blocking; further template splitting needs Foundry-specific partial registration validation.

## v0.11.9 — Direct Artwork Editor & Complex Inventory Drag Fix

- Replaced the separated squares with a continuous 8×8 item footprint grid.
- Direct artwork controls: select by clicking, drag to move, pull edges/corners to scale, drag rotation handle to rotate (Shift snaps to 15°).
- Removed the secondary artwork slider panel and duplicate rotation buttons.
- Square-proportioned image geometry is shared by inventory items, editor and drag previews; image stretching from narrow/wide shapes is eliminated.
- Hit-test every occupied cell when grabbing complex inventory items, even when the item artwork has transparent pixels.
- Existing item cells, image offsets, scale, rotation and inventory configuration are kept intact.

## v0.11.8 — Connected Shape Editor and Complex Artwork Fix

- Rebuilt the Size editor as a connected 8×8 inventory-style grid with the real item artwork overlaid.
- Move artwork by dragging it in the editor, Shift-drag to rotate; precision rotation slider added.
- Use one image for the entire item and clip it to occupied cells instead of stretching one copy per cell.
- Corrected complex item drag previews to render the entire footprint and preserve the grab position during drag/rotation.
- Kept collision checking tied to all occupied cells. Old item shapes and artwork settings remain compatible.
- Extracted the footprint editor and image renderer into separate modules.

## 0.11.7 — Item Footprint & Stable Player-Sheet Tabs

- Replaced the detached 8×8 painter and duplicate preview with a single artwork-in-grid footprint editor. Start with the item itself; add only neighboring cells. Keep the shape connected when removing cells, and expand the editor grid as needed.
- Kept artwork scale and horizontal/vertical controls in a collapsible panel; preserve existing saved shapes, image offsets, and inventory placement rules.
- Fix Player Sheet flicker by restoring the active tab before template rendering. Inventory changes no longer briefly render the Basic tab before switching back.
- Removed panel activation transitions during redraws. No item migration required.

## 0.11.4 — Foundry V14 actor editor compatibility

- Fixed the crash when the Actor editor reads detection modes as Foundry collection, map, or keyed object instead of a plain array.
- Detection edits normalize the existing collection before updating it, preserving other modes and avoiding redundant updates.
- Fixed a possible null-field error when reading selected editor controls.
- Scene directory cards now use scene thumbnails and no longer read deprecated Scene.background.
- Browser/Chromium powerPreference warnings originate outside the module and are not affected by this update.

## 0.11.3 — Actor Token Editor & Selective Batch Editing

- Actor directory right-click now includes **Edit actor & token**, opening a custom Buxa tabbed editor with Actor, Token, Vision, Detection and Light pages.
- Edit actor name, portrait and D&D 5e creature size; prototype token image, dimensions, scale, opacity, rotation, bar attributes, linkage and display modes; token sight enable/range/angle/type; detection modes; light settings and animation.
- **Multi edit** mode in world Actor and Item directories. Select documents with clicks (including entries in left folder panels), then apply only the fields explicitly enabled in the editor. Actor vision enabled + range 30 can be set on a group without touching token dimensions, lighting or other details.
- Item batch fields include rarity, image, quantity, weight, stackable, equip allowed and equipped (when that item type supports it).
- Updates use native Foundry document batches and dotted field changes. Original flags, increases, dice, item descriptions and inventory identity are untouched unless their specific fields are selected.
- Actor vision, detection and light edits affect the **prototype token for future placements**, not tokens already placed on scenes.

## 0.11.2 — Animated Actor Token Placement Preview

- Dragging Actors from Buxa's Actor directory or left folder panels now shows a translucent animated prototype-token ghost on the Scene canvas.
- Preview follows the mouse, respects the actor token's grid footprint and canvas zoom, and snaps to Foundry's Token position where supported. Hold Shift for an unsnapped preview.
- Ghost is rendered as a lightweight pointer-events-none HTML overlay with per-frame throttling; native Foundry V14 Actor canvas-drop handles actual token creation, preventing duplicate tokens.
- Ghost fades on successful canvas release and cleans up on cancellation, window blur, and scene teardown.
- Actors owned by players can also be dragged to the canvas; world-directory folder sorting remains GM-only.

## 0.11.1 — Dark navy UI and item artwork fix

- Restored deeper, darker blue surfaces across the Figma-based sheets, directories, editors and popovers without reverting the updated layouts.
- Removed the unwanted solid artwork tile from the item sheet hero.
- Added lightweight, conservative background removal for solid-backed, monochrome icon PNGs in the item sheet only. Already-transparent PNGs and full-color art remain unchanged; failures safely fall back to the original image.
- No document migration, no inventory drag changes.

## 0.11.0 — UI-wide Figma V2 redesign

- Added editable Figma screens covering character, inventory and equipment, item sheet, item configuration, module configuration, document directories, asset browser, equipment designer, and dialogs/notifications.
- Unified interface surfaces, typography hierarchy, icon containers, inputs and buttons using modular design tokens.
- Reworked responsive window styling for Buxa player, item, rule, editor, inventory, directory, and utility interfaces.
- Preserved existing Foundry document APIs, drag behavior, item logic, rarity data, and accessibility preferences.
- Kept Foundry native window controls unchanged.
- Full live Foundry visual QA still required.

## v0.10.18 — Red Main Folders

- Main folders in Items, Actors and Scenes now use a deep red accent, including the pinned directory cards and left-opening folder panel headers.
- Existing Main folders are recolored on GM initialization without moving or modifying their contents.
- New Main folders are created red; regular folders retain their own customizable colors.

## v0.10.17 — Main Folder and Custom Actor / Scene Directories

- Added a persistent pinned Main folder to the Item, Actor, and Scene world directories. Existing root content is preserved; newly created world entries and folders default to Main. Reuses an existing root folder named Main to avoid duplicates.
- Main cannot be deleted, moved into another folder, or renamed. Regular folders can be colored, moved, nested, and deleted.
- Expanded the custom Buxa directory presentation to Actors and Scenes with contained artwork, metadata, quick search, and flat-corner cards.
- Added custom New Actor (name and type), New Scene (name), and New Folder (name and color) popovers and compact context/delete menus.
- Reused the optional open-folders-to-the-left setting in Actor and Scene directories, including nested panel navigation and folder drag targets.
- Added stable item-like drag guides, manual document sorting through Foundry's own sort field, and cross-folder moves for Actors/Scenes.
- Only world documents are auto-filed: embedded Actor items, compendium entries, and documents with an explicit folder are not modified. No migrations of existing data.

## v0.10.16 — Stable Item Directory Dragging

- Fixed fast up/down World Item drag-and-drop causing flashing rarity colors, unstable insertion targets, duplicate ghost gaps, and unexpected row movement.
- Replaced the layout-changing full-height reorder placeholder with a pointer-transparent, smoothly moving insertion guide. Uses no document writes while dragging.
- Introduced midpoint hysteresis to prevent the guide alternating rapidly at the same row boundary.
- Suppressed glint/hover color transitions only during active drag, retaining ordinary item rarity styling outside dragging.
- The directory defers item DOM redraws while its own drag is in progress; reorder animations run after dropping instead of changing hit targets during the drag.
- Applied the same stable insertion guide and targeted folder highlights to left-opening folder panels.
- Preserved existing manual/name/rarity sorting and native Foundry sort/Folder documents. No data migration.

## v0.10.15 — Item Directory Stability, Sorting & Flat UI

- Fixed Buxa's Items sidebar forcing itself visible under other Foundry tabs (e.g. Settings). Native tab visibility now remains in control of Foundry.
- Removed rounded corners from Buxa item directory rows, controls, forms, nested folder panels and context menus.
- Added document-backed manual item sorting by dragging above/below other items, with animated displacement previews and a visual drop location. Dragging within a folder panel also reorders its items.
- Sort control cycles Manual / Name / Rarity; manual order is the default for drag sorting. Uses native Foundry Item.sort fields, not separate module flags.
- Replaced native Foundry Item/Folder delete confirmations from Buxa's context menus with small anchored Buxa confirmation popovers.
- Preserved folder colors, context actions, world item drag data, and left-opening nested folder panels.

## v0.10.14 — Custom World Item Directory

- Replace native World Item directory visuals with lightweight Buxa-owned toolbar, search, item cards, and folder rows.
- Item cards show correctly fitted thumbnail, name, rarity badge, item type, stack size, and any configured level requirement. Rarity colors tint borders and hover states; highlighted rarities animate only on hover.
- Apply the same item cards inside optional nested, left-opening folder panels.
- Keep create item/folder popovers, folder color editing, and compact right-click menus. Drag World Items into folders or back to the root without migrating documents.
- Batch directory redraws on Foundry document changes and preserve search, expansion, and scroll state.

## 0.10.13 — World item directory overhaul

- Fixed Buxa Item sheets becoming difficult to restore when minimized: custom resize grip is hidden until maximized.
- Replaced core Create Item and Create Folder prompts with compact non-modal Buxa forms; item creation includes type, name, and rarity.
- Added folder colors and a compact right-click menu for world Items and Item folders; removed Import/Export from Buxa's actions.
- New Module Configuration > UI > Item UI option to open Item directory folders as animated side panels attached left; nested folders create additional panels.
- Panels support dragging world Items between folders and back to the native root directory using Foundry documents and drag data.
- Kept left-opening mode disabled by default for existing worlds and preserved existing notification settings.

## v0.10.12 — Mutually exclusive item dice sources

- Attribute dice now **replace** the configured fixed dice rather than adding to them. Modifiers and flat bonuses continue working for either source.
- Added an explicit Fixed Dice / Attribute Dice choice in item configuration. Inactive dice inputs are disabled, but their values are preserved when switching back.
- Corrected formula, displayed formula, min–max range, and roll-card summaries to use only the selected source.
- Added a guard against rolling from a missing attribute source instead of silently rolling an incorrect flat-only formula.
- Existing item rules are compatible; no migration required.

## v0.10.11 — Inventory drag stability

- Replaced the animated inventory-element clone with a lightweight image-only drag preview. Its animation/transition reset works when mounted under the document body, preventing preview-position conflicts.
- Prevented the browser's native HTML drag from competing with Buxa's pointer-based inventory drag, which can otherwise show two drag images and lose the pointerup event.
- Removed forced second sheet renders after inventory moves, sorts and drops. Foundry's Actor/Item document updates already refresh attached sheets.
- Reverted the animation-pausing CSS from v0.10.10: inventory rarity animations behave normally again.
- Canceled active inventory dragging if the window loses focus or the dragged element is detached.
- Silent Unstack is preserved, along with v0.10.10's render-scoped item calculation cache.

## v0.10.10 — Silent Unstack and Inventory Performance

- Unstack now completes silently; only actual failures display warnings.
- Index active item bonuses once per player-sheet render instead of rebuilding them for each attribute, resource, and proficiency.
- Prepare inventory item rules, rarity visuals, requirements and weights once per item and reuse them for slot rendering and weight totals.
- Throttle inventory drag updates to one frame; position the ghost with GPU-friendly transforms and only update highlighting when the destination changes.
- Pause expensive rarity shadow animations on idle inventory tiles and resume them on hover or drop target, preserving interactive animations.
- No item migration or configuration changes required.

# Buxa Framework changelog

## 0.10.9 — Minimal floating split control

- Replaced the full-screen stack-splitting modal with a tiny non-modal quantity popover next to the clicked Unstack action.
- Only quantity, minus, plus and one split button remain. Removed duplicate item name, stack preview, slider, presets, explanations, and backdrop.
- The popup stays within screen edges, dismisses on outside click/Escape/scroll/resize, and keeps number validation and keyboard submission.
- Retained the original split-stack item/inventory logic and saved data unchanged.

## 0.10.8 — Compact item actions and split stacks

- Inventory actions now open on the **first right-click**, with a lightweight action-only popover. Removed redundant item artwork, name, and written rarity from the right-click menu; empty menus show a quiet one-line state.
- Added **Unstack** to the right-click menu for a stackable Item with quantity above one. The new quantity dialog offers number entry, stepper controls, a slider, Half and Max shortcuts, and a live preview of the two resulting quantities.
- Split quantities must be whole numbers from **1** through **current quantity − 1**, ensuring the original always retains an item. Empty inventory space is required; splitting into hidden overflow is blocked.
- A successful split creates an **independent embedded Item** with a new ID and Buxa instance identity while preserving source name, image, rarity, rules, discovery status and lore. The copied stack starts unequipped, is placed in a free inventory cell and can be merged back by dragging onto its source.
- Foundry item mutations are ordered to avoid premature quantity loss: new stack creation precedes reducing the source; a failed source update removes the new copy. Special split document options also avoid competing item-hook reconciliation until both documents are ready.
- Kept the implementation modular: `core/item-stacks.js` owns the operation, `apps/unstack-dialog.js` owns the modal, and `styles/115-unstack-menu.css` owns the interaction design. Existing inventory/item data requires no migration.

## 0.10.7 — Item Configuration Control, description modes and stack badges

- Item sheets are now a single presentation view: no Item / Control tabs. The GM-only **Control** tab is in Item Configuration next to Info, Basic, Increase and Dice.
- Control actions update saved discovery state immediately, refresh actor bonuses and sync the matching editor controls without discarding unsaved field edits. Save brand-new fields before using Control.
- Description supports **Standard text** or **Modular fields** under Info, with an independent enable switch. Switching modes preserves both the standard paragraph and modular discovery/replacement fields.
- Stack quantities on inventory/equipment slots are now readable **×N** corner pills, never faded on hover. Existing quantities and item data are unchanged.


## 0.10.6 — Item discovery, GM Control and compact action menu

- Fixed the inventory right-click menu: removed the duplicate item artwork and replaced the vertically broken “NO USE ACTION” button with a properly sized empty-state label. Compact hover previews no longer repeat item art either.
- Added **Revealed, Locked, Hidden, and DM Only** visibility to Increase and Dice rules. Locked rules appear desaturated with a lock icon and do not activate; Hidden rules appear as animated `???` and do not activate; DM Only rules have no player-facing line or action.
- Added a **GM-only Control tab on item sheets** for instant reveal, lock, hide or DM-only changes. Actor effects refresh after the item is updated.
- Added modular description fields. Each field has initial text, optional revealed replacement, visibility, and how it joins the previous field. Legacy descriptions migrate to one public field without losing their text.
- Added reveal actions: optional rarity upgrades; merging compatible increases into one displayed value without losing their separate mechanical totals; display label, color and icon overrides.
- Stopped locked/hidden/DM-only dice entries from appearing as usable context-menu rolls and blocked direct Buxa roll requests for those states.
- Kept existing item, rarity and inventory data backward-compatible. Added discovery regression tests and isolated styling in a new module stylesheet.
- **Limitation:** DM-only is a presentation and gameplay restriction, not secure encryption. Players with access to an Item document may inspect its raw flags using browser tools. Store truly secret information in a GM-only Foundry document until it is time to reveal it.


## 0.10.5 — Value-first item effects

- Full item sheets now read left to right as **icon → value/formula → label** (for example, `🎲 1d20 DAMAGE` and `◆ +20% HP Maximum`).
- Inventory hover previews use the same ordering while retaining individually configured rarity/custom colors.
- Passive activation is indicated by a small badge after the label instead of leading the description.
- Long dice formulas and labels wrap inside resizable sheets instead of pinning values to the opposite edge.
- Item rule data, existing values, custom icons, decoration groups, and rolls are unchanged; no migration needed.

## 0.10.4 — Increase & Dice editor redesign

- Rebuilt the Increase and Dice configuration panels as legible, responsive rule cards with clear sections, live summaries, and collapsible cards.
- Moved optional tooltip color/icon controls into collapsible **Item display** sections instead of squeezing every field into one oversized row.
- Replaced long native modifier/attribute/target lists with searchable, categorized option menus; the menus escape the scroll container and support mouse and keyboard.
- Differentiated identically named proficiency entries by their configuration ID without merging or deleting them.
- Preserved selections referencing removed stat sources rather than silently switching an item to a different stat when saved.
- Kept all original stored item fields/semantics and the original non-editor tooltip colors; no migration required.
- Added UI and regression coverage for searching, picking, duplicate names, card summaries, collapse/expand, and narrow windows.

## 0.10.3 — Resizable sheets and neutral item values

- Restored an explicit, accessible bottom-right resize grip across Buxa's player, item, item configuration, module configuration, equipment-layout and asset-browser windows. The grip uses the public Foundry ApplicationV2 positioning API, preserves saved player-sheet sizes, and works with mouse/touch/pen or arrow keys.
- Restored reliable resizing when elaborate Buxa window content obscures Foundry's native corner affordance, without imposing fixed CSS window dimensions.
- Made the dice and increase rows on full item sheets use neutral grayscale text and icons regardless of the item's rarity.
- New increases and dice use Neutral as their starting tooltip color option. Inventory hover tooltips retain existing per-line custom/rarity color choices.
- Added unit regression checks for resize gestures, listener cleanup, neutral presentation and configurability.

## 0.10.2 — Configurable warnings and notifications

- Fixed the missing-timeout bug which incorrectly made Buxa notifications permanent.
- Added Module Configuration > UI > Warning, with a configurable 0–60 second auto-dismiss timer (0 keeps notifications visible until closed).
- Added Left, Middle and Right screen placement with smooth directional animations.
- Applied shared notification settings to warnings, success, error and info messages so none pile up indefinitely by default.
- Added an interactive preview that respects unsaved form choices and a responsive settings layout for narrower screens.
- Updated existing toast placement when world configuration changes, without reloading.
- Preserved existing module configuration when saving the new UI options; old worlds receive safe defaults.

## 0.10.1 — Initial maintenance audit

- Fixed passive item increases not applying to actor items outside the Buxa-tracked grid.
- Ignored zero-quantity items when calculating passive and equipped item increases.
- Fixed resource clamping when an actor has no Buxa inventory tracking flag.
- Avoided unnecessary inventory flag rewrites during reconciliation and GM login.
- Improved synchronization after item creation, configuration and quantity updates.
- Fixed matching item IDs across the World and Actor collections preventing valid stacks.
- Fixed V14 roll messages storing a serialized string where the roll schema expects JSON data.
- Added tooltip composition to hover previews; improved compact readability and motion-sensitive behavior inherited from the UI.
- Added an automated regression suite for passive/equipped effects, stacking, no-op writes, bounds and item dice.

## 0.10.0

- Added passive/equipped item increases, item dice configurations, chat roll actions, custom tooltip decorations, and the item action menu.
## 0.11.5 — Visual token configuration and live preview

- Added a persistent live token preview inside the Actor editor with grid sizing, token artwork, image scaling, opacity, rotation, vision cone, and bright/dim light cones.
- Replaced raw numeric grids with interactive sliders plus independently editable exact values. The slider range automatically expands when a larger valid number is typed; no form submission happens during preview updates.
- Replaced checkbox lines with accessible square toggle switches and added image browsing, color swatches, and contextual field hints.
- Kept original Foundry-compatible prototype token fields and selective multi-edit behavior. Disabled batch fields never affect preview calculations or saved documents.
- Added responsive preview stacking for narrow windows and support for reduced-motion preferences.
- Preview is representative only and applies to prototype tokens; actual in-scene lighting and tokens remain Foundry-controlled.

## 0.11.6 — Complex Inventory & Equipment Tabs

- Actor canvas ghost respects Gridless scenes; grid-based scenes keep native snapping.
- Optional complex grid-based inventory with custom polyomino item shapes, no-overlap placement and animated cell-feedback.
- Press R while dragging an item to rotate its footprint. Item configuration now has a Size tab for painting cells, artwork scale and pan.
- Automatic shape-aware packing is optional per world; disabled in Complex by default. Simple inventory remains the default.
- Equipment designer can create, rename, resize and remove tabs; each tab has its own equipment slots and grid dimensions.
- Item stacks keep their shape when split, with free-space checking for the destination stack.

## 0.13.0 — Physical Items on the Scene

- Drag world Item templates to the canvas to place physical artwork instances; original templates are not consumed.
- Drag embedded Items from actor inventory to the board, choose quantity for stacks, and transfer the chosen amount rather than duplicating it.
- Physical Items persist in Scene flags, render as non-decorated artwork in a canvas-attached Pixi layer, and remain draggable.
- Right-click reveals a rarity-accented Loot action and quantity, plus available rule summary; clicking sends the item to an explicitly linked character with a nearby token.
- Compact GM left-edge panel → ITEM → LOOTING includes loot enable/range, player movement enable/range, and maximum movement per drag (feet).
- All document transfers are serialized through the active GM, use state checks and best-effort rollback; no Actor data migration.
- Cross-client canvas refresh reuses existing sprites to avoid flicker during item movement. Live Foundry V14 testing is still required.
