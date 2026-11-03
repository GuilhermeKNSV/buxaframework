# Buxa Framework v0.13.87 — Item Editor Performance & Storage Mode UI

- Optimized the Dice/Increases rule editor: typing updates only the affected row's summary rather than rebuilding every source picker and rule card per keystroke. New/removed rows still trigger full picker discovery.
- Optimized Item Configuration navigation: switching tabs now touches only the previous/current panel and visible group buttons, avoiding repeated hidden-panel DOM invalidation.
- Moved each pouch's independent `itemMode` selection into a conspicuous **Storage Inventory Mode** section inside Function → Storage → External Compartments. Available options remain Follow inventory, Simple (1 slot/item), Complex (original footprint).
- Added guidance when no pouch exists and mode-specific hints; item shapes and existing persisted flags remain unchanged.
- Added regression tests for hot-path input updates and the per-pouch mode selector.
- Full Node test suite: 1079/1079 passed. In-Foundry visual validation is still recommended.
