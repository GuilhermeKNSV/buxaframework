# Buxa Framework 0.15.9 — NPC Dropping

- NPC-only always-simple Drop tab with independent capacity from NPC Settings.
- NPC > Dropping module defaults: capacity and HP resource selection.
- NPC-specific HP resource override and Drop capacity via NPC Settings.
- Drag Item documents into NPC Drop slots without removing them from their original inventory.
- Configure drop probability, quantity range, quantity weights and Inventory/Ground per item.
- GM-only Kill control appears over NPC tokens at 0 HP; per-token death state with persistent skull marker.
- Roll loot once, remove that token from combat, save results with the token, and prevent duplicate rolls.
- Inventory loot stays on a visible corpse token and is accessible via token double-click; clicking an item transfers to a nearby linked player character through the GM.
- Ground drops use existing Buxa physical-item records and are distributed around the token; ground-only kills hide the token after successful publication.
- Ground publishing is idempotent on retry and preserves saved rolls if publication fails.
- Added focused drop/configuration/probability, kill/combat, ground publication and authorization tests.

Live Foundry V14 interaction and multiplayer checks are required before production use.
