# Buxa Framework v0.14.01 — Hotbar visual refinement

- Rebuilt the attribute roll tray as a compact, centered cluster of dark-metal RPG keys instead of a full-width empty window.
- Anchored the expand/collapse arrow directly to the hotbar top rail with a 3px separation from the tray.
- Improved type hierarchy: small attribute abbreviations, prominent signed modifiers, and unobtrusive multi-die indicators. Full roll details remain accessible via tooltips.
- Automatically balance large numbers of attributes into rows and keep small mobile trays tight to their contents.
- Only play the roll-tray entrance animation when opening it; routine item/resource re-renders do not replay it.
- Keep all existing roll, advantage/disadvantage, right-click, tabs, customization, item-use, and storage integrations intact.
- Add visual layout regression tests; verify responsive tray dimensions and centering in Chromium at desktop/mobile sizes.
