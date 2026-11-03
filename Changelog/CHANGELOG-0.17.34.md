# Buxa Framework v0.17.34 — Effects/rarity sheet restoration

- Effects now render their sheet with the **same fully configured Item rarity presentation** as ordinary Items and Magic (`rarityClass`, `rarityStyle`, `data-rarity-tier`), including animated/spectrum, name color, ornaments, background brightness and opacity. Previously the Effect sheet omitted these values and tried to call `applyRarityVisual` after render, which does not set the complete sheet rarity contract.
- Removed the redundant post-render Effect rarity mutation so the template and scene rarity rules have one source of truth.
- Replaced the solid blue boxed Behavior panel with an understated rarity-linked stat presentation matching the original Item sheet: dark transparent material, no extra box border, restrained crest/light accents, readable stats and trigger badges. The Effect status strip is also rarity-themed.
- Removed the extra full-width divider at the bottom of the Item/Magic/Effect hero. The original decorative hero separator remains.
- Switching Item/Magic to Effect and Effect back to Item/Magic now preserves the currently selected rarity across the separate config flag formats; other saved effect and item rules are untouched.
- Regression tests protect sheet rarity data, kind routing/conversions and the visual contract. No gameplay, runtime, combat, storage, item use, or document types changed.

## Verification
- Node syntax checks, full Node test suite, architecture and ZIP integrity checks passed.
- Live Foundry visual verification is still needed.
