# Buxa Framework v0.13.86 — Item Configuration Categories

- Reorganized Item Configuration into four main categories: Overview, Function, Visuals, Access.
- Added 16 dedicated sub-tabs: Identity, Description, Properties; Dice, Resources, Increases, Limits & Recharge, Stacking, Equipment, Storage; Image, Size & Shape, Stack Artwork, Decorations; Discovery, Ground Rules.
- Moved existing live DOM controls, not clones: item values, image editing, dice rules, limits, storage configurations, and hidden templates continue to use existing save parsers and handlers.
- Preserved active sub-tab across application redraws; added arrow-key/Home/End navigation, responsive scrollable sub-tabs and reduced-motion styling.
- Added regression coverage for navigation, editor placement, unsaved changes, and runtime selector preservation.
