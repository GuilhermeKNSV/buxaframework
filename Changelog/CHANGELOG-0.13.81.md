# Buxa Framework v0.13.81

- Removed the “POWER ASCENDED” line from the level-up scene badge.
- Subsequent level-ups while an effect is active update the badge number without restarting entrance effects, and reset its dismissal timer. The centered SVG sigil remains in a gentle rotating idle state until dismissal.
- Clicking an attribute value now opens an empty **Add points** amount field. Each positive integer entry adds to existing permanent investment in a single Actor update and charges the proper points, rather than replacing the value.
- Rebirth tier reveal uses one sheet render rather than double-rendering and interrupting the animation.
- Rebirth becomes available at the score visibly reaching its cap, including item-increased values, even when base investment is lower and no unspent points remain. Bonuses stay temporary: item-assisted rebirth tiers become inactive if their support is removed until invested progress catches up.
- Bulk point spending now stops at the visible rebirth threshold, accounting for flat/percent item increases and display rounding; no hidden spending into later cycles.
- Regression tests added for repeated level-ups, additive point entry, zero-points item-assisted rebirth, percent bonuses, and anti-overspending safeguards.
