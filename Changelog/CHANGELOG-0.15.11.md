# Buxa Framework v0.15.11 — NPC Drop editor

- Fixed Quick/Visual NPC Settings layout clipping and overlapping descriptions; rows now grow to fit their text.
- Added NPC Drop capacity slider paired with an editable numeric field; both share validation and persistence.
- Redesigned NPC Drop rules dialog with a drop-chance slider and exact number, minimum/maximum quantity sliders and exact numbers, and a scrollable quantity-odds editor.
- Replaced cryptic `1:70, 2:20, 3:10` manual input with a live chance breakdown and presets: Equal, Prefer fewer, Prefer more, Only minimum. All quantity odds remain editable individually.
- Preserved backward compatibility with NPC drop-table `weights` strings and existing kill/drop logic.
- Serialized per-item drop rule saves with pending NPC Drop additions to avoid overwriting newly dragged items.
- Added regression tests covering legacy odds and quantity drop simulations.

Automated checks pass; live Foundry V14 UI testing remains required.
