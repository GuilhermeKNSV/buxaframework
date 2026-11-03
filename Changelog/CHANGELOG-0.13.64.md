# Buxa Framework v0.13.64 — Sources and Scene Progression

- **Module Configuration → Player Sheet → Attributes:** added **Allow attribute minimize / maximize** (enabled by default). When switched off, every attribute always renders expanded and its collapse button is hidden. Previous per-client collapse selections remain stored and are available if the setting is re-enabled.
- **Sources UI:** wider, higher rows with improved artwork, readable item names, colored item rarity accents and clear value columns. Long source lists scroll within their panel.
- **Item source navigation:** clicking a source Item uses its exact Actor-embedded Item ID to switch to Inventory and highlight the item briefly. Supports equipment tabs and reveals closed storage compartments when possible, without changing Item documents.
- **Scene progression VFX:** level-up creates an ascending blue/gold ring, rays, particles and a level banner over matching visible Tokens; rebirth creates a rarity-tinted sigil and outward orbiting shards, labeled with the attribute and tier. Effects play only following successful progression, run briefly, and clean up their PIXI/Ticker objects.
- **Multiplayer:** the progression effect is sent through the module socket to other users viewing the same scene; the sender does not play it twice. Effects are purely visual, not persisted gameplay state. Reduced-motion clients see a shortened and simplified effect.
- No saved Actor/Item/Scene migration, no changes to inventory placement or backpack transfers.

**Verification:** 664 automated tests including 7 targeted tests, JS syntax validation, CSS parsing and architecture check. Scene VFX still require live Foundry V14 verification for canvas rendering and multiplayer timing.
