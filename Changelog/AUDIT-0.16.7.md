# Buxa Framework v0.16.7 — Code audit and regression report

## Scope and claims

Audited the complete v0.16.6 ZIP, prioritizing saved values, directory tabs, NPC dropping, inventory capacity, equipment configuration, and drag geometry. **The original 1,986 tests passed before changes.** Introduced 768 regression cases on top of that baseline. The bulk of the new cases intentionally exercise distinct invalid inputs through shared code paths. **Do not interpret the hundreds of cases as hundreds of unrelated underlying bugs.**

## Reproductions against the starting build

- 259 of 268 initial NPC/directory test cases failed before fixes.
- 167 of 198 initial complex-grid/rotation cases failed before fixes.
- 289 of 297 initial saved-configuration/Actor-number cases failed before fixes.
- Additional specific NPC legacy-data and resource tests added after the main reproductions.
- **At least 715 failures reproduced prior to patch** across multiple root causes. Some variants are ordinary defensive-input cases, not observed live crashes.

## Confirmed classes of defects corrected

1. **NPC world default slots:** numeric arrays/objects/boolean-like values silently coerced to slot counts.
2. **NPC actor capacity:** corrupt custom Actor overrides masked safe module defaults.
3. **NPC drop chance:** corrupt values silently became real probability percentages.
4. **NPC minimum quantity:** invalid saved quantity values became meaningful drop bounds.
5. **NPC maximum quantity:** invalid values could unexpectedly expand the quantity range.
6. **NPC HP resource override:** a stale per-Actor resource ID ignored a valid configured world resource.
7. **NPC resource ID parsing:** non-string values could become bogus IDs.
8. **NPC legacy Item system:** primitive/nonobject Item system data could interrupt loot generation.
9. **NPC legacy Item cloning:** a malformed uncloneable drop snapshot could throw while the drop list normalized.
10. **NPC RNG invalid results:** non-finite random input was silently converted to zero, biasing items toward guaranteed drops.
11. **NPC saved weight toggle:** string-encoded false was treated as on when weights existed.
12. **Directory tab type checking:** cross-collection folders were accepted as potential tab targets by the validation helper.
13. **Directory tab stale destination:** a deleted/missing tab could be accepted as a drag destination.
14. **Complex grid columns:** arrays/objects/booleans silently became columns instead of the configured default.
15. **Complex grid rows:** analogous numeric coercion created wrong capacities.
16. **Complex shape rotation:** malformed saved quarter turns could rotate an item unintentionally.
17. **Complex placement scanner rotation:** invalid persisted rotations changed collision footprints.
18. **Normal inventory slots:** malformed form values could collapse the slot capacity instead of falling back.
19. **Configured complex inventory columns and rows:** same coercion flaw at the module config layer.
20. **Inventory weight limit:** malformed numeric fields were coerced into incorrect values.
21. **Equipment layout columns/rows:** invalid saved inputs could create unintended equipment grids.
22. **Actor persisted numeric values:** arrays/objects and Symbol inputs could produce invalid numbers or throw.
23. **Legacy complex zero dimensions:** explicitly preserved existing zero-means-default semantics while hardening parsing.

## Files changed

- `scripts/core/npc-dropping.js`
- `scripts/apps/directory-tabs.js`
- `scripts/core/inventory-shapes.js`
- `scripts/core/inventory-config.js`
- `scripts/core/stored-values.js`
- `tests/audit-v0167-reproductions.test.mjs`
- `tests/audit-v0167-inventory-geometry.test.mjs`
- `tests/audit-v0167-persisted-settings.test.mjs`
- `module.json`
- this report and version changelog

## Safety boundaries

- No gameplay formulas, rarity beam renderer, NPC loot destinations, item transfer, actor sheets, hotbar appearance, or directory visuals were redesigned.
- Main and tab document contents are not mutated by the audit (folder validation only).
- Invalid random generation **skips** the attempted drop instead of creating a guaranteed drop.
- Invalid old Item snapshots are rejected individually instead of cancelling unrelated valid drops.
- Existing valid numeric string settings remain accepted.

## Validation

- `node --test tests/*.test.mjs`
- `node check-architecture.mjs`
- `node --check` for all JavaScript files
- ZIP integrity and installable `buxaframework/` root

All claims about tests refer to Node regressions. Live Foundry V14 UI and multiplayer interactions cannot be certified by these tests.
