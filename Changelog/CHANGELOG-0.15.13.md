# Buxa Framework 0.15.13 — NPC death and loot recovery

- Replace Token5e/Pixi `getBounds()` calls for NPC kill-button positioning and corpse double-clicks with document geometry and camera transform, avoiding updateTransform null crashes.
- Stop attaching incorrectly constructed Pixi Text to NPC tokens; avoids `[object Object]` labels and render crashes. Per-token killed state remains saved as before.
- Harden NPC corpse loot socket authentication using sender identity supplied by Foundry, not the submitted userId.
- Prevent stale NPC corpse modal keydown listener leaks when opening another corpse.
- Tighten GM corpse recipient selection; do not silently transfer loot to unrelated actor inventories.
- Compact existing pending/review transfer fingerprints to SHA-256 during new writes when WebCrypto is available; increase bounded journal capacity and retain all unresolved records so interrupted transfers are never silently replayed.
- Remove redundant NPC-only explanations, simplify NPC settings and drop rules, and switch corpse looting to compact square artwork cards with hover names/quantity indicators.
- Add regression tests for transformed scene coordinates, marker regression, UI clutter, and transaction journal migration.

Validation: full Node regression suite and architecture check. Live Foundry V14 visuals/multiplayer remain unverified.
