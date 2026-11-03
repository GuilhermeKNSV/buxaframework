# Buxa Framework v0.13.76 — Final regression audit

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


See `AUDIT-0.13.76.md` for reproduction cases, tests and remaining risks.
