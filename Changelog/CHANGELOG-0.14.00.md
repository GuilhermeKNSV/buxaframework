# Buxa Framework v0.14.00

## Hotbar shortcut menu
- Inventory context menus offer **Add to Hotbar** when the Actor Item is not bound to any tab, or **Remove Shortcut** when already bound. Never both.
- Hotbar context menus hide physical **Drop**, **Unequip**, and **Equip** options. Existing rolls, uses, recharge, and shortcut removal remain available.
- Removing a shortcut from the inventory menu clears its references across the Actor’s tabs, including currently hidden rows, without modifying or deleting the Item.
- Hotbar lock disables shortcut deletion; layout and item use remain intact.

## Attribute quick-roll tray
- Small center-top arrow toggles a floating row of square roll tiles without moving the resource orbs or action bar.
- Each tile shows an abbreviated label, the real modifier (including NPC overrides), and dice count. Full name and details are in its tooltip.
- Left click rolls normally using the sheet’s existing attribute roll implementation.
- Right click opens an Advantage / Disadvantage menu; it reuses the established attribute roll logic.
- Added keyboard-accessible buttons and reduced-motion support.

## Validation
- New regression tests cover tab-wide presence/removal, lock, real context-menu actions and tray data.
- Native Foundry V14 visual verification remains required.
