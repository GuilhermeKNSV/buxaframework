# Buxa Framework 0.17.32 — Module Configuration control repair

- Fixed the shared button selector: generic 38px button dimensions no longer apply to the 16px up/down numeric stepper buttons.
- Kept number inputs and stepper rails within their parents, with non-shrinking stepper columns and 0-padding buttons.
- Rebirth numeric settings now use two columns within each narrow card; rarity beam opacity numbers have enough space for their stepper buttons.
- Fixed an incorrectly scoped Resource form-row selector and stabilized compact rarity slider/value sizing.
- Restored zero-radius tokens, square switch tracks and knobs, square slider thumbs, square dropdowns, and square input/button surfaces throughout Module Configuration.
- Removed the no-longer-needed forced-radius overrides, avoiding another styling specificity chain.
- Preserved all data attributes, templates, native input values, save/reset logic, and widget handlers.
- Added regression checks for numeric button sizing, card layouts, and square components.

This update addresses Module Configuration styling/geometry. Native Foundry runtime rendering should still be checked in-game.
