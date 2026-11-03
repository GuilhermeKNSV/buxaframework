# Buxa Framework 0.13.58 — Stacking Artwork

- Moved the existing stackable/individual mode and Max Stack out of Basic into a dedicated **Stacking** tab.
- Added configurable quantity thresholds (e.g. 2+, 4+, 10+). The highest matching threshold selects the artwork; quantity 1 uses the original image.
- Each threshold can use a separate chosen image or a custom layered composition.
- Added a composition editor: add the current item image as many times as desired, browse for other layers, select individual layers, drag to move, drag handles to rotate/resize, and adjust size/rotation/opacity. Artwork paths and layer transforms are saved per Item; no generated image files are written to disk.
- Integrated threshold artwork into Actor inventory (Simple and Complex), external storage compartments, item sheet, ground containers, and scene sprite rendering. Dragging from inventory copies custom artwork to the preview.
- Maintained older item rules without stack art and preserved existing Max Stack values.
- Added tests for quantities, normalization, old-item compatibility, custom layers, markup escaping and tab separation.

**Limitations:** For composed artwork rendered on the scene canvas, source image assets must be readable from Foundry's current origin for browser Canvas composition. Broken/unreadable source layers fall back to the ordinary item image. A real Foundry V14 interactive smoke test has not been performed; this build has Node regression coverage and source checks.
