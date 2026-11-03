# Buxa Framework 0.13.97 — Custom Hotbar

- New opt-in custom hotbar, toggled with a small button beside the Foundry hotbar. When active, the native `#hotbar` is hidden; switching back restores it without changing macros.
- Dark-navy, gold-accented dock with independently rendered inventory shortcut slots, rarity borders, responsive layout, subtle use and hover animations, three numbered tabs and one row of ten slots by default.
- Personal hotbar configuration: rename/add/delete up to twelve tabs, one to four rows, four to fourteen columns, accent color, and two optional resource orbs showing live resource fills and optional numbers. Config changes are saved per client.
- Hotbar lock protects shortcut positioning; clicking still uses the underlying Item.
- Actor-scoped shortcut bindings; currently controlled owned token takes precedence, otherwise selected Actor or assigned character. Shortcuts keep real item IDs and never clone/remove Item documents or alter their inventory placement.
- Drag Buxa inventory and storage items directly onto hotbar slots, or choose Add to Hotbar when right-clicking an equipped item. Items can be moved and swapped between slots when unlocked; the original inventory remains unchanged.
- Left-click actions reuse Buxa item dice, resource and limited-use systems; other items open their sheet. Right-click reuses normal item action menu with a Remove Shortcut action.
- Resource orb colors and current/max values come from the existing resource configuration and actual Actor data.
- Tests for shortcut assignment, locking, swapping, persistence, row changes, tabs, actor selection, native-hotbar visibility, inventory drop route, item use hooks, view markup, rarity colors and resource fills.
- No world-data migration. All customization is client-local; no existing Foundry macro shortcuts or Actor data are modified.

Live Foundry V14 visual and interaction verification is still necessary.
