# 0.15.0 — Rarity rework

- **Loot beam** (`scripts/apps/loot-beam.js`): tapered pillar with light pulses travelling up, white-hot core, ground bloom, expanding ripples, god-rays and drifting embers. Intensity scales with rarity tier (`core/rarity-tier.js`, 0-4). Spectrum rarities cycle hue. Looting plays a collect burst (shaft whips up, shockwave, fade) before cleanup. Beam still follows the item's on-screen base.
- **Pickup nameplate**: item name only, in rarity color; draws in with a glowing rule, ornament wings (tier 1+), hover shine sweep, press feedback, periodic shimmer on tier 2+, collect animation on loot.
- **Rarity cards v2** (`styles/165-rarity-slots.css`): inventory/equipment slots and complex items get a dark card with pooled rarity light, double frame, corner brackets (ornament), light sweep (hover / glint), working breathe (animated) and true-hue spectrum. Global opacity/brightness settings and Glint/Full-color modes still apply. Artwork gets a rarity rim-light.
- **Item sheet / hover card** (`styles/166-rarity-item-card.css`): glowing top rule, lit art pedestal, corner brackets, opening light sweep, rarity diamond.
- **Arrival pop** (`scripts/apps/rarity-pickup-flash.js`): a newly created Actor item flashes into its slot.
- Fix: previous animated/spectrum slot keyframes used `!important` inside `@keyframes`, which browsers ignore; animation now runs through registered custom properties.
