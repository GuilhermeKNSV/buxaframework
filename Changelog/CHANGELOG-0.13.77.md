# Buxa Framework v0.13.77 — Scene level-up and rebirth animation reliability

- Scene celebrations listen to **committed Actor updates** as well as the existing local Buxa progression hooks. The two event sources are deduplicated, preventing missed animations when custom hook observers throw or never fire.
- Compatible with Foundry V14 flattened and nested Actor update payloads. Only Buxa's own runtime progression writes trigger effects, so Actor setup and migrations do not accidentally fire level-up animations.
- Multiplayer updates render locally for receiving clients without rebroadcast loops; duplicate custom-hook, Actor-update and socket deliveries do not stack the same animation.
- Fixed token matching for Actor-linked and synthetic/unlinked Tokens and excluded hidden or invisible Tokens for non-GMs.
- When PIXI initialization or drawing fails, gracefully show Foundry's native `canvas.interface.createScrollingText` instead of silently dropping the effect. The main PIXI animation still uses rarity colors for rebirths.
- GM-only local visual diagnostics: `game.buxaframework.previewProgressionFx(canvas.tokens.controlled[0]?.actor, "level")` or `..., "rebirth")`. Does not spend points, write documents, or send effects to other players.
- Added scene regression tests for updates without custom hooks, duplicate prevention, socket authorization, fallback rendering, multiple Tokens, rebirth identity, and local preview.

No character data, item rules, or saved settings migrations.

**Note:** Source-level regression tests cannot replace a real Foundry V14 PIXI/canvas visual check.
