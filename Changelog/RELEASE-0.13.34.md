# Buxa Framework 0.13.34 — Unified Ground-Storage Drops

Built from **0.13.33**, preserving the existing GM-authoritative scene and Actor transfer mechanisms.

## Improvements

- A shared pure placement planner resolves the precise storage origin and rotation for items arriving from the board, Actor inventories, or the Item Directory.
- The grabbed occupied cell is used as the pointer anchor; a secondary cell under the cursor no longer forces the item's upper-left corner to that cell.
- If the preferred footprint cannot fit, the preview chooses the closest actual free placement, checking available rotations, before saving. The server validates that exact location again; full storage still rejects safely.
- Dragged board artwork has a real DOM ghost above the ground-storage window instead of disappearing behind it; all ghosts have `pointer-events: none` so actual cells receive input.
- Cropped compartments hit-test against visible viewports while retaining their original uncropped slot indices.
- Native Item Directory drag rotation/grip is captured before async UUID resolution and isn't cleared by the Actor-sheet listener.
- Drag previews are removed on cancellation, scene teardown, native drag end, and window close.
- The same target result is used for inventory, board, and world-template transfer payloads; existing Actor backpack and nested-item contents are preserved.

## Verification

Run `node --test tests/*.test.mjs` and `node check-architecture.mjs` from the module folder.
Automated integration and pure geometry tests cover footprint origin, rotation, full storage, cropped cells, and UI routing. Live Foundry V14 cross-window interaction remains to be checked.

## Manual smoke checks

1. Drag a complex item from Actor inventory onto an open ground chest. The ghost should snap **above** the chest and the item should appear at that same occupied footprint.
2. Drag an item from the board into the open chest window; the preview should appear above the window instead of behind it.
3. Drag a world Item Directory template into a chest. The world template remains in the directory; the chest receives a copy.
4. Drag items out of the chest into Actor inventory, onto the board, and into Item Directory.
5. Try a completely full compartment: placement should be rejected while the source remains intact.
6. Press R when supported to rotate and confirm the saved footprint agrees with the preview.
