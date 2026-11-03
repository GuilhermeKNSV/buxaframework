# Buxa Framework v0.13.76 — Final pre-feature integrity audit

## Scope and counting

Based on the **complete v0.13.75 module ZIP**, not a historical handoff. This audit focused on actor progression, simultaneous database writes, resource persistence, document quantities, configuration round-trips, observer error isolation and scene artwork authorization. Earlier audits already focused extensively on inventory geometry and malformed Item rules.

**73 new, individually reproduced failing test scenarios**, not 73 independent root causes. The 100 new regression tests include 27 compatible/previously working cases. The same tests pass after the fix. We do not claim a full interactive Foundry V14 verification.

## Issues corrected

1. **Attribute point balance fallback:** Imported/saved empty, null, boolean or nonnumeric values cannot incorrectly reset a character's configured starting points to zero.
2. **Proficiency point balance fallback:** The same recovery applies to proficiency pools.
3. **Level fallback:** Corrupted or blank saved levels use the configured starting level instead of silently becoming level zero.
4. **Custom resource readback:** Blank/null/boolean HP/MP values and maxima no longer become zero instead of the configured starting maximum.
5. **D&D-linked resource readback:** The same checks apply when reading linked D&D 5e resource fields.
6. **Stack quantity readback:** Malformed persisted quantity fields do not silently interpret an Item as having zero units. Explicit numeric zero remains valid.
7. **Progression double-click race:** All basic progression actions share a per-Actor lock: attribute allocation, direct editing, rebirth, proficiency allocation, leveling and resource input changes. A second request cannot read/spend the same point balance while a first write is in flight. Locks release after failure.
8. **Post-save observer exceptions:** A faulty external Hook listener no longer makes a successful attribute, proficiency, rebirth, level or resource write appear to have failed and invite a duplicate retry. The observer exception is logged.
9. **World Configuration text booleans:** Saved string values such as `"false"`, `"off"`, `"0"` no longer enable permission or gameplay switches due to JavaScript's truthiness; `"true"`, `"on"` and `"1"` are accepted where appropriate. Explicit real booleans and defaults retain their established behavior. This covers levels, points, rebirth, modifiers, addon toggles, DR/initiative, resource synchronization, proficiency features, weight, snap and auto-sort.
10. **Scene artwork identity:** A caller without an authenticated viewer object cannot display dropped Items merely because scene token vision is disabled. Existing visualization tests were updated to pass explicit viewer IDs.

## Verification methodology

- Original untouched v0.13.75: **928 / 928 existing tests pass**.
- New progression/authorization suite against original: **43 failures among 65 cases**.
- New configuration suite against original: **30 failures among 35 cases**.
- New suites on v0.13.76: **100 / 100 pass**.
- Entire v0.13.76 test suite: **1028 / 1028 pass**.
- JavaScript `node --check` for **184** source scripts: clean.
- `node check-architecture.mjs`: passed with **8 pre-existing soft warnings**, no hard violations.
- Complete installable ZIP archive validated.
- No destructive flag or Item migration.

## All 73 previously failing test cases

1. **progression:** attribute point balance restores configured start instead of corrupted empty
2. **progression:** proficiency point balance restores configured start instead of corrupted empty
3. **progression:** Actor level restores configured start instead of corrupted empty
4. **progression:** custom resource value restores starting max for empty
5. **progression:** custom resource max restores starting max for empty
6. **progression:** D&D resource value restores starting max for empty
7. **progression:** D&D resource max restores starting max for empty
8. **progression:** quantity defaults to 1 instead of losing an item for empty
9. **progression:** attribute point balance restores configured start instead of corrupted whitespace
10. **progression:** proficiency point balance restores configured start instead of corrupted whitespace
11. **progression:** Actor level restores configured start instead of corrupted whitespace
12. **progression:** custom resource value restores starting max for whitespace
13. **progression:** custom resource max restores starting max for whitespace
14. **progression:** D&D resource value restores starting max for whitespace
15. **progression:** D&D resource max restores starting max for whitespace
16. **progression:** quantity defaults to 1 instead of losing an item for whitespace
17. **progression:** attribute point balance restores configured start instead of corrupted null
18. **progression:** proficiency point balance restores configured start instead of corrupted null
19. **progression:** Actor level restores configured start instead of corrupted null
20. **progression:** custom resource value restores starting max for null
21. **progression:** custom resource max restores starting max for null
22. **progression:** D&D resource value restores starting max for null
23. **progression:** D&D resource max restores starting max for null
24. **progression:** quantity defaults to 1 instead of losing an item for null
25. **progression:** attribute point balance restores configured start instead of corrupted false
26. **progression:** proficiency point balance restores configured start instead of corrupted false
27. **progression:** Actor level restores configured start instead of corrupted false
28. **progression:** custom resource value restores starting max for false
29. **progression:** custom resource max restores starting max for false
30. **progression:** D&D resource value restores starting max for false
31. **progression:** D&D resource max restores starting max for false
32. **progression:** quantity defaults to 1 instead of losing an item for false
33. **progression:** attribute point spending stays successful when an unrelated post-save hook throws
34. **progression:** attribute point spending cannot be double-spent while the first database write is pending
35. **progression:** rebirth stays successful when an unrelated post-save hook throws
36. **progression:** rebirth cannot be double-spent while the first database write is pending
37. **progression:** proficiency spending stays successful when an unrelated post-save hook throws
38. **progression:** proficiency spending cannot be double-spent while the first database write is pending
39. **progression:** level gain stays successful when an unrelated post-save hook throws
40. **progression:** level gain cannot be double-spent while the first database write is pending
41. **progression:** resource adjustment stays successful when an unrelated post-save hook throws
42. **progression:** resource adjustment cannot be double-spent while the first database write is pending
43. **progression:** scene artwork remains concealed if no authenticated viewer exists, even when token vision is disabled
44. **configuration:** saved world settings respect the player-sheet make-default permission checkbox
45. **configuration:** saved world settings respect the level system disabled checkbox
46. **configuration:** saved world settings respect the attribute minimization disabled checkbox
47. **configuration:** saved world settings respect the attribute points disabled checkbox
48. **configuration:** saved world settings respect the attribute point refunds disabled checkbox
49. **configuration:** saved world settings respect the attribute direct entry disabled checkbox
50. **configuration:** saved world settings respect the attribute negatives disabled checkbox
51. **configuration:** saved world settings respect the attribute modifier disabled checkbox
52. **configuration:** saved world settings respect the rebirth disabled checkbox
53. **configuration:** saved world settings respect the rebirth modifier cap disabled checkbox
54. **configuration:** saved world settings respect the attribute icon disabled checkbox
55. **configuration:** saved world settings respect the SVG addon disabled checkbox
56. **configuration:** saved world settings respect the carousel addon disabled checkbox
57. **configuration:** saved world settings respect the DR stat disabled checkbox
58. **configuration:** saved world settings respect the initiative stat disabled checkbox
59. **configuration:** saved world settings respect the HP current/max synchronization disabled checkbox
60. **configuration:** saved world settings respect the custom resource current/max synchronization disabled checkbox
61. **configuration:** saved world settings respect the proficiency system disabled checkbox
62. **configuration:** saved world settings respect the proficiency points disabled checkbox
63. **configuration:** saved world settings respect the proficiency refunds disabled checkbox
64. **configuration:** saved world settings respect the proficiency negatives disabled checkbox
65. **configuration:** saved world settings respect the proficiency entry disabled checkbox
66. **configuration:** saved world settings respect the proficiency icon disabled checkbox
67. **configuration:** saved world settings respect the proficiency dice disabled checkbox
68. **configuration:** saved world settings respect the proficiency reroll disabled checkbox
69. **configuration:** saved world settings respect the proficiency number disabled checkbox
70. **configuration:** saved world settings respect the proficiency modifier disabled checkbox
71. **configuration:** saved world settings respect the weight capacity disabled checkbox
72. **configuration:** saved world settings respect the equipment snap disabled checkbox
73. **configuration:** saved world settings respect the Complex auto-sort enabled checkbox

## Remaining risks (not marked fixed)

- Live Foundry V14 pointer/canvas transfers, multiplayer GM ownership and combat events still require testing in an actual world.
- Cross-feature concurrent mutations that bypass the progress-action lock (e.g., Item resource use during a manual resource edit) are outside the atomicity guarantee of this patch.
- Foundry itself may commit a database write before a hook throws; this audit isolates observer hooks after a confirmed progression write but does not replace all document transaction paths.
- Eight modules/templates exceed the project's soft size guidelines; changing them without functional coverage could create new regressions.

Before installing, back up the world; restart Foundry after replacing the module, and test progress allocation, saved configuration toggles and resource counters in a nonproduction world.
