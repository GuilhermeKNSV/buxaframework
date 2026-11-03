# Buxa Framework 0.15.7

- Inventory R rotation now turns the complete ghost artwork and footprint over 180 ms. Pointer tracking and placement validation remain immediate.
- Rapid R presses continue from the current visible angle rather than snapping or reversing at the fourth turn.
- Dropping an inventory item into a visible equipment slot carries the ghost into the saved slot artwork over 300 ms, including the configured artwork size, offset, rotation and composite stacks.
- Flights survive sheet content redraws, reveal the equipped item at arrival, and clean up after rejected saves, cancelled animations, closed sheets, scrolling or window resizing.
- Reduced-motion preferences skip both effects. No gameplay flags or migration changes.

Validation: Node regression suite, architecture checker, and standalone browser animation checks. Live Foundry gameplay has not been tested in this environment.
