# Buxa Framework v0.17.33 — Effects

## New capabilities

- World Items can be classified as Item, Magic, or Effect using `flags.buxaframework.itemKind`; Item and Magic keep their existing behavior.
- New Effect configuration, with Info, Behavior, Resource, Dice, Increases, and Description tabs; shared Item editors and dedicated segmented/trigger-card behavior controls.
- New Effect sheet with behavior, duration, triggers, rarity, active instance and stack presentation; excludes weight and equipment presentation.
- GM-authoritative active Effect instances on `flags.buxaframework.activeEffects` supporting replace, stack, refresh, duration, resources, dice, and lifecycle hooks.
- Combat lifecycle integration with turn-start/turn-end ticks, primary-GM selection, de-duplication, and cleanup after embedded condition deletion.
- Passive Effect Item drops attach conditions without grid placement; condition pills on the Player Sheet with GM removal.
- Floating Effect HUD next to Player Sheet with in-place card diffing, duration updates, rarity animation, optional GM removal, and observer cleanup.
- One new stylesheet, `styles/183-effects.css`. Existing stylesheets are unchanged.

## Files

**New:** `scripts/core/effect-config.js`, `scripts/core/effect-runtime.js`, `scripts/apps/effect-config.js`, `scripts/apps/effect-sheet.js`, `scripts/apps/effect-hud.js`, `scripts/integrations/effect-integration.js`, `templates/effect-config.hbs`, `templates/effect-sheet.hbs`, `styles/183-effects.css`, `tests/effects-system-v01733.test.mjs`.

**Updated:** `module.json`, `scripts/main.js`, `scripts/core/constants.js`, `scripts/core/inventory.js`, `scripts/core/item-effects.js`, `scripts/core/item-runtime.js`, `scripts/apps/item-directory-ui.js`, `scripts/apps/item-directory-cards.js`, `scripts/apps/item-config.js`, `scripts/apps/item-sheet.js`, `scripts/apps/player-sheet.js`, `scripts/apps/player-sheet-context.js`, `templates/item-config.hbs`, `templates/player-sheet.hbs`, `tests/item-directory.test.mjs`.

## Compatibility and verification

- No additional Foundry document types or sidebar tabs.
- Existing Item rules and storage are preserved for Item and Magic kinds.
- No existing stylesheet was edited; Effect CSS is loaded separately by `module.json`.
- Live Foundry V14 drag/drop, sheet positioning, and multi-GM integration still require in-world verification. Back up your world before upgrading.
