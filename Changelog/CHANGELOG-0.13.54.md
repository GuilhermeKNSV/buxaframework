# Buxa Framework v0.13.54 — Ground-storage drop targeting and footprint feedback

- Recalculate the actual ground-container placement at pointer release instead of accepting cached drag-hover decisions. Covers Scene → chest, Actor inventory → chest, and native Item Directory → chest drops.
- Preserve the shared occupied-cell collision validator, automatic valid rotations, original target indices, and the already-working chest pickup/round-trip transfer behavior.
- When a configured Item footprint cannot fit, show its real footprint in red over the chest rather than silently clearing the preview; explain the configured width, height and occupied-cell count, rather than inaccurately stating that the entire chest is full.
- Add three focused regressions for the pictured 5×4 chest layout, its tightly packed axe/gloves/coin cells, the 2×3 sword placement, and honest invalid-footprint feedback.
- 602 Node tests pass, syntax checks and ZIP integrity verified. Live Foundry V14 integration remains unverified. No Item or Actor data migrations.
