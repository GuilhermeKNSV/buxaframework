# Buxa Framework 0.13.98 — Hotbar HUD visual redesign

- Replaced the large branded header and Actor dropdown with a thin icon rail and compact slot deck.
- Larger bevelled resource orbs now represent percentage fill as animated liquid with waves and rising bubbles. Values remain optional and follow resource colors.
- Minimal slot outlines and a forged-metal RPG action bar, preserving all tab, row, color, lock, drag and use behavior.
- Players always use their assigned `game.user.character`, or a sole owned Actor when no character is assigned; controlling unrelated scene tokens never changes shortcuts.
- GMs select a scene token using SELECT then a click on a token. The bar is linked to that token and keeps its per-Actor shortcut bindings. Escape cancels selection.
- Selection cleans up listeners when cancelled, on canvas teardown, or when switching back to native Foundry hotbar.
- Keeps backward compatibility with prior saved hotbar settings and item shortcut references.

Automated tests: player/GM Actor selection, canvas token hit-testing, selection lifecycle, presence of fluid orbs, shortcut persistence, legacy module regression suite. Live Foundry visual/interaction verification remains necessary.
