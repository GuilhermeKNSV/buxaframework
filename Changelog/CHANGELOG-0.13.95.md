# Buxa Framework v0.13.95

- Fixed Foundry V14 init crash when registering Player/NPC sheets: preserved the static receiver required by DocumentSheetConfig.registerSheet.
- Actor creation now offers Player, NPC Visual, and NPC Quick as explicit choices. Each maps to the supported D&D 5e character/npc Actor type and uses the corresponding Buxa sheet. Other system types remain available under their own group.
- Persist NPC Visual/Quick selection on the new NPC Actor at creation, rather than relying on subsequent updates.
- Ensure NPCs receive Buxa resource/progression state in worlds with legacy character-only actor-type selections.
- Added registration regression test that reproduces Foundry's private-static (#pending) failure pattern and creation-preset tests.

Automated regression tests: 1,266 passed. Native Foundry runtime not available in test harness.
