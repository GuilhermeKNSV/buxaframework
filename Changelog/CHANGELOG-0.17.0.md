# Buxa Framework 0.17.0 — Combat encounter manager

- GM Combat sidebar: create/open native Combat records and stage repeated NPCs as separate roster entries.
- Actor picker opens beside the sidebar, with image, name, HP, level/CR, sheet shortcut, and draggable/quick-add actor cards.
- Player actors appear at most once per combat and use global Actor resources. NPC copies require independent unlinked Scene tokens.
- Place NPCs: ghost previews of the full group, grid-aware collision protection, hidden tokens, and one-click placement.
- Refuse to start combat until every NPC is on the current Scene. Start uses native Foundry Combatants.
- Roll NPC initiative without touching players, drag initiative order, and use next/previous combat turns.
- Expand combatants for Buxa attribute rolls, configured actor resources, and actor hotbar shortcuts/items.
- Actor drag visual reduced to a thin feet ruler; removed duplicate token-art preview and ornamental frame.

## Testing notes
This first implementation needs live Foundry V14 checks for the Combat sidebar hook, token creation, multi-client updates, and mouse interactions. Other modules replacing CombatTracker might affect visual placement.
