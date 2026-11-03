# Buxa Framework v0.13.94 — NPC Sheets

- Dedicated Foundry V14 NPC Actor sheet, registered as the default for dnd5e npc type. Character and other Actor sheet registrations remain separate.
- NPC Settings (per Actor): Quick / Visual; default Quick. Visual uses the same layout and controls as the player sheet.
- Quick: compact, consistent attribute cards, no rebirth colors or sheet animations; Stats and proficiencies are displayed at the bottom of Basic. Inventory, storage and equipment use the existing player-sheet implementation without duplication.
- Quick: suppress local and socket-driven level/rebirth scene celebrations for that NPC. Visual retains the normal effects.
- GM right-click: Level / Attribute Points / Proficiency Points for direct integer adjustment without automatic level rewards or point spending.
- GM right-click any attribute: optionally override value, modifier and dice. Empty input clears a saved override; the calculated value becomes active again. Overrides affect dice rolls and dependent calculations, not the original invested points.
- Per-Actor persistent flags; existing Player Actors, equipment, Item instances, storage and world settings remain unchanged.
- Tests: NPC permissions, settings, overrides, validation, reset, persistence, template placement, and suppression of token progression hooks.
- Live Foundry V14 UI/inventory interactions still require validation in-game.
