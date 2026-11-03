# Buxa Framework v0.14.05 — Hotbar finishing details

- Restored the attribute drawer handle to its fixed gold and blue-metal appearance; it no longer follows the Actor's strongest rebirth rarity. Individual attribute tiles still use their rebirth colors.
- Squared all hotbar tabs and added a slim accent underline to the selected tab.
- Added direction-aware horizontal page transitions: shortcut slots exit towards the selected tab and the new page enters from the opposite side. Uses the existing serialized settings writer, prevents overlapping rapid tab switches, and respects reduced-motion preferences.
- Replaced rectangular orb labels with curved SVG inscriptions along the lower edge of each liquid resource orb. The orb tooltip and numeric display are unchanged. A plain, box-free text fallback is available for environments without SVG creation.
- Added regression tests for the SVG inscriptions, fixed handle color, transitions, reduced motion, and rapid click safety.

Full release baseline: 1,499/1,499 automated tests passed; architecture check passed (8 pre-existing soft file-size warnings). Desktop Chromium visual inspection confirmed flat tab corners, gold handle, and curved resource inscriptions. Live Foundry V14 verification is still recommended.
