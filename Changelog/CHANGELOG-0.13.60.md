# Buxa Framework v0.13.60 — Deep source audit fixes

- Prevent automatic or manual stack merging when Item configurations, rarity, Buxa bonuses, or other saved system data differ, even when the identity/stack key matches. Respect each Item's maximum stack capacity.
- Correct Image Library In Use status for current per-scene board items, custom stack artwork image rules/compositions and packed backpack children; ignore stale legacy Scene items after partition migration.
- Fix rotated Complex inventory equipment-swap collision validation to use the saved rotation.
- Three regression tests initially failed against v0.13.59 and now pass.
- Full suite: 635/635 passed. See `AUDIT-0.13.60.md` for remaining runtime risks.

---

