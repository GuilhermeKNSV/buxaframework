# Buxa Framework v0.13.79 — SVG scene celebrations and rebirth cap correction

- Replaced fragile PIXI Graphics-only scene progression effects with modular SVG/CSS effects positioned over a Token on Foundry V14. Includes distinct golden level-up visuals and configurable rebirth rarity coloring.
- Added bundled SVG level burst, rebirth sigil and crown art; visual effects do not depend on chained PIXI Graphics APIs.
- The large progression number/badge floats above the Token, while animated rings and energy particles surround it. Animations track canvas pan/zoom and token movement, do not block clicks and are removed on timeout/canvas teardown. Reduced-motion supported.
- The fallback floating-text position remains above the Token if the SVG/DOM scene overlay cannot initialize.
- Fixed the event deduplication key so two different levels or rebirth tiers cannot accidentally suppress each other.
- **Direct rebirth attribute editing now targets permanent invested points**, not the temporarily item-boosted display value, so manually setting the cap spends only missing permanent points and properly allows rebirth.
- Updated the direct attribute editor to show permanent invested cycle points, avoiding misleading boosted numbers.
- Added regression tests for cap editing with item bonuses, repeated progression-event identities, SVG effect positioning and lifecycle.

No saved-data migration.
