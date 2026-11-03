# Buxa Framework v0.13.89 — Inventory Rarity Hover Reliability

- Fixed Complex inventory and Complex pouch rarity-hover feedback: shape artwork is intentionally pointer-transparent, so CSS `:hover` on the item could not work. Delegate pointer highlighting through the existing occupied-cell map, including L/T shapes.
- Clear highlights over empty/disabled shape cells, while leaving the board, during drag start, or on pointer cancellation; do not activate touch highlights.
- Strengthened rarity-colored visual response for Simple inventory, Simple storage and Overflow. Complex outlines and artwork glow using item rarity colors, including custom colors.
- Kept drag/drop, stacks, shape geometry, item flags and inventory persistence unchanged; no per-frame Actor writes or sheet re-renders.
- Added tests for pointer transitions, irregular holes, storage, dragged items, and real Chromium CSS/DOM behavior.
