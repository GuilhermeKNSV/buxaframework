# Buxa Framework 0.16.7 — Regression hardening

- Reject malformed numeric inputs in NPC dropping settings, loot chances, inventory and equipment layout dimensions, complex-grid rotation, and saved Actor numeric fields.
- Keep NPC HP tracking on the configured world resource when an Actor override is missing or invalid.
- Skip malformed loot rolls and invalid legacy Item snapshots instead of generating guaranteed drops or interrupting NPC kill handling.
- Ignore stale/cross-type directory-tab drop targets before presenting an accepted drag.
- Preserve legacy inventory default handling and the rest of the UI/rarity presentation without modifications.
- Add 768 test cases (the new cases include shared underlying causes; they are not independent bugs).
