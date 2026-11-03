# Buxa Framework v0.13.62 — Attribute Rebirth / Points

- A rebirth now requires 100 (or the configured cap) **invested** points. Temporary Item bonuses affect the displayed score but do not grant permanent rebirths.
- Rebirth cycle progress cannot fall below zero, including when the general Below Zero attribute option is enabled. Already-claimed rebirth cycles cannot be refunded through normal attribute decrement or direct entry.
- Direct score entry cannot bypass the next rebirth cap. The + button at the cap initiates the rebirth confirmation instead of spending past the cap.
- Legacy `null` progress flags correctly fall back to the original stored D&D ability score rather than silently treating progress as zero.
- Rebirth I has a visible rarity color. Unedited older default palettes migrate safely, while custom rebirth colors remain unchanged.
- Rebirth attribute cards now display rarity-colored borders, tinted backgrounds, subtle auras, and their rebirth tier label in the same visual direction as the Item Sheet rarity presentation.
- The new styles load after other attribute styles that previously forced neutral borders/backgrounds.
- Adds seven focused rebirth, points, legacy palette and UI regression tests; full suite 651/651 passing.

Compatibility: no destructive migration or changes to inventory/storage documents. Live Foundry V14 test pending.
