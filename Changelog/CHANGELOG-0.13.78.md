# Buxa Framework v0.13.78 — Scene progression visual rework

- Reworked **level-up** and **rebirth** scene animations to read as visual celebrations instead of plain center-anchored text.
- Both effects now present their main badge **above the token**, keeping the token readable while the effect plays.
- **Level-up** now uses a warm gold palette, larger level numerals, brighter aura rings and a crown/burst treatment around the token.
- **Rebirth** now keeps the configured rarity color, shows a focused `R#` badge, and uses a matching rarity-colored burst/sigil treatment.
- Reduced the amount of large floating text and shifted emphasis to the numeric reward and aura feedback.
- Improved fallback floating-text placement so it also starts above the token instead of through its center.
- Regression tests updated for the new progression visual payload (`value`) and verified scene-FX rendering lifecycle.
