# Buxa Framework v0.13.73 — Drag-and-drop Recharge Material Slot

- Replaced the `WORLD ITEM TO CONSUME` dropdown under Item Configuration → Limits → Recharge Item with a compact drop target.
- Drag a World Item from Foundry's Items sidebar or an opened folder panel onto the slot. The slot displays its icon and name; `×` clears the selection.
- The selection is persisted through the existing `recharge.item.templateId` field. The Item itself is not moved, deleted, or consumed during configuration.
- Invalid sources (Actor-embedded Items, compendium entries, folders, or missing templates) cannot replace the selected material. Existing missing template IDs are shown visibly instead of silently erased.
- The existing recharge mechanics, number of uses restored, and Item-instance material consumption are unchanged.
- Added drag-data and DOM event regressions for selection, replacement, clearing, rejected drops, and missing references.

**Verification:** Node suite, JS syntax, CSS parser, architecture guard and ZIP integrity checks. Live Foundry V14 drag/drop verification remains pending.
