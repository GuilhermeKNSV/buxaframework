# Buxa Framework v0.17.14 — 107-Finding Audit Repair Pass

Starting point: full v0.17.13 release. The audit listed 107 **candidate findings** (29 source limitations, 62 hypotheses and 16 testing gaps), not 107 proven bugs. This pass addresses 36 implementation findings, partially mitigates 6, and documents 3 safeguards already present. The remaining entries have not been marked fixed without reproduction or compatible migration rules. See `AUDIT-STATUS-0.17.14.md` for every finding by ID.

## Combat and scenes

- Combat panel now resolves staged NPCs, expanded sheets, dead actors, and revive token references from the encounter's own scene rather than whichever scene the GM happens to be viewing; placement remains gated to the proper scene.
- GM combat actor detail has an explicit all-items toggle when hotbar shortcuts hide other items.
- NPC placement reserves every occupied off-grid cell; rejects unsupported oversized footprints instead of silently truncating them; and searches farther on large scenes using bounded perimeter traversal.
- Scene progression effects use scene-scoped identities and clean up after scene changes.
- Dead-drawer timestamps explicitly distinguish null/blank from numeric values.

## Inventory, equipment and storage

- Bound the Actor inventory mutation queue to 128 concurrent/pending operations, with recovery after overload.
- Cycle equipment positions from inside the serialized Actor mutation to prevent duplicate slot selections from rapid calls.
- Invalid saved equipment positions no longer silently default to position zero.
- Block capacity-granting equipment removal when remaining inventory occupancy would exceed the new capacity; warn on displaced items entering overflow.
- Preserves Actor autosort when moving individual items into storage.
- Stacking rejects equipped items, unmatched third-party flags and zero-quantity **source** transfers; zero-quantity persisted stacks remain supported.
- Detect visible nested storage compartments iteratively, preventing recursion blowup and cycles.

## Dice, item actions and UI

- Guard ownership before item-dice resolution and cap constructed/previewed dice batches at 100.
- Notify when chat publication fails after a legitimate item-use commit, preventing silent success.
- Attribute and proficiency chat messages now serialize rolls as Foundry roll-data objects rather than JSON strings.
- Create dice, tooltip decoration and Increase rule IDs using collision-safe random IDs.
- Recover hotbar tabs/bindings after longer malformed prefixes, coalesce redundant settings writes, preserve pending state and confirm destructive populated-tab deletion.
- Debounce image-library hover previews; serialize favorites writes across browser windows; add traversal folder/file budgets and visible partial-results warnings.
- Preserve the configured numeric slider max; handle blank stack-artwork inputs and cancel pointer drags on blur.
- Guard dynamic HUD resource update paths and bound viewer whitelists; expand preferences retention.
- Clamp narrow-screen custom pickers and fire both input and change events.

## Verification

- Added 11 focused regressions for stacking, zero quantity, NPC occupancy, queue overload, gallery limits, hotbar normalization, rule IDs, resource caps, editor sliders, serialized chat rolls and nested-container cycles.
- Ran full module unit/source suite, JavaScript syntax checks, architecture checker and ZIP integrity check.

## Still requires specialized verification

- Multi-GM write ordering, crash/reconnect recovery, cross-client revision checks and idempotent transaction replay need a dedicated Foundry integration plan.
- A number of audit findings are hypotheses, intentional capacity/product contracts or browser interaction testing gaps; changing those without reproducing them could break existing worlds.
- Back up your Foundry world before upgrading and test with your Foundry version and integrations.
