# Buxa Framework v0.13.70 — Item Sheet Visual Consistency

- Removed the boxed exhausted-item lock over the Item Sheet artwork. Exhaustion is now conveyed by the Uses text and counter, while artwork remains unobstructed.
- Rebuilt the Uses display as an unboxed, rarity-tinted charge meter with restrained typography.
- Restyled resource effects to match the other RPG-stat effect lines. Dice formulas remain numerical (e.g. `1d4 + 0`), without duplicate leading signs; restore/drain is communicated separately.
- Replaced the full-width generic `USE ITEM` button with a subtle rarity-accented inline action. Depleted items show a noninteractive status instead of a dead button.
- Matched inventory hover typography to the Item Sheet and replaced the red boxed inventory lock emoji with a subtle Font Awesome lock.
- Kept the same Item use/roll handlers, saved rules, resource processing, and uses counters. No data migration.
- Added focused presentation regression tests. Live Foundry UI check remains outstanding.
