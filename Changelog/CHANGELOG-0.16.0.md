# Buxa Framework 0.16.0 — Rarity visual overhaul

- One shared visual resolver for all twelve default rarities, with distinct engraved crests, corner geometry, materials, motion profiles and beam silhouettes. Custom rarity colors and existing visual controls remain supported.
- Reworked item cards, hover cards, inventory and equipment frames, shaped-item backdrops, quantity plates, and item action accents. Explicitly selected tooltip-effect rarities receive their own full visual theme; hidden and locked effects retain neutral presentation.
- Reworked scene loot nameplates, DOM preview beams and canvas beams with per-rarity linework and particle travel. Contact shadows, scene interaction, item transfers and inventory rules remain unchanged.
- Hotbar slots inherit item themes. The surrounding metalwork and resource-orb crests follow the highest active equipped rarity while resource colors and fill amounts remain intact.
- Level-up controls and scene celebrations follow equipped rarity. Rebirth gates and celebrations resolve the attribute's configured rebirth color to its corresponding rarity identity, preserving custom colors.
- New original SVG crests are generated locally. Reduced-motion support disables ambient animations. No remote assets, new dependencies or per-frame document writes.

Validation: 1,937 Node tests passed. Architecture check passed (existing soft-size warnings only). Browser/Foundry visual and multiplayer smoke testing remains outstanding because the browser test connection was unavailable.

Install: close Foundry, replace the existing buxaframework module folder with this archive's buxaframework folder, then restart Foundry and refresh the client.
