# v0.13.69 — Item dice tooltip notation

- Use the actual Item dice resolver when rendering Resource effect amounts; attribute-derived dice and modifier values now display numerically for the owning Actor.
- Normalize the Item Sheet and inventory-hover dice text to readable `XdY + N` / `XdY - N`, including zero modifiers.
- Item Configuration roll previews use dice notation and keep dynamically selected attribute sources identified outside the formula.
- Unowned world Item previews use base attribute dice and keep unresolved modifier names explicit instead of pretending to know an Actor's stats.
- Kept Foundry Roll formulas, advantage/disadvantage, range settings, item use, resources, and saved rule data unchanged.
- Added regression coverage for a zero-modifier potion, ordinary damage dice, negative/decimal bonuses, world previews, and fallback formatting.
