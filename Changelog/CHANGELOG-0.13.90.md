# Buxa Framework v0.13.90 — Rarity Hover & Drag Feedback

- Avoid the red first frame of spectrum rarity animations while hovering an item; pointer feedback immediately uses the item's configured rarity color.
- Keep the item highlight active on pointer press until an actual drag begins.
- Moving inventory drag previews inherit resolved rarity color/accent/background parameters before being attached to the DOM.
- Carry rarity-colored highlights on Simple ghost tiles, Complex SVG outlines, equipment and mixed-mode storage previews.
- Preserve distinct invalid-drop and merge feedback, no Actor or Item document migration.
- Add regression tests for ghost rarity inheritance, press-to-drag lifecycle and inventory/store CSS.
