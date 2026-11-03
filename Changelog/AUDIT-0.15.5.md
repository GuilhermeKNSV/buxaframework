# Buxa Framework v0.15.5 — Regression & source audit

## Audit scope and counting

Starting point: user-supplied complete v0.15.4 module (1,590 existing automated tests passing before changes).

**120 individually parameterized, reproducible failing editor interaction scenarios** were added in `tests/visual-editor-audit-v0155.test.mjs`. Every one failed against the original v0.15.4 build with a redraw recursion; every one now passes. These are **120 user input variations of a shared underlying defect, NOT 120 unrelated code defects**. Tests vary image size, rotation, opacity, previously saved beam/nameplate transforms, name edits, preview toggles, and active layer selection. Four additional integration / structural tests were added for real equipment artwork rendering, preview CSS, template fallback, and hit testing.

## Confirmed underlying defects addressed

1. Image Preview `syncSelection()` dispatched a custom event on every redraw.
2. Board Image editor listened for that same event and redrew / refreshed the preview, causing infinite feedback and a frozen item configuration window.
3. Preview layer selection was being treated as a synthetic input change instead of a presentation state update; now there is no redundant event dispatch or loop.
4. Scene preview overlays were painted in a lower stacking context than the image, so selected beam and nameplate handles could become unclickable. Active overlay now temporarily receives the interactive layer.
5. Editing the beam/label could cause mouse events to be swallowed by the underlying image. Image hit testing is disabled when the corresponding effect layer is being edited.
6. Equipment-size previews inherited a more specific global `overflow:hidden !important` rule, cropping rotated/translated/resized artwork in the editor.
7. Equipment-size preview wrappers inherited normal inventory hover transforms, disrupting calibration. The editor now suppresses those effects.
8. Equipment preview inherited the actual equipment slot grid positioning CSS; the editor now explicitly owns its preview slot geometry.
9. Unsupported remembered equipment size could leave all editor panels unselected. The editor now chooses the valid Small default.
10. Unsupported remembered Image preview target could leave a panel with no editable layer. The editor now defaults to Image.
11. Equip Size rotation used horizontal pointer distance only, making circular rotation gestures incorrect. Rotation now follows the pointer angle around each slot center, with optional Shift 15° snapping.
12. Equip Size width resizing used `max(dx,dy)`, which could enlarge on a drag mostly to the left; now the right-side handle follows horizontal movement.
13. Beam and nameplate corner resizing used `max(dx,dy)`, preventing consistent diagonal reduction; now it uses average diagonal displacement.
14. `templates/item-config.hbs` exceeded the project's architectural hard size limit. The legacy tab button fallback is preserved while markup is compacted to pass the validator.

## Verification

- New regression cases: 120 original-failing scenarios, now passing.
- New runtime integration cases: actual 5 equipment sizes / saved transforms, editor clipping CSS, layer hit testing, and legacy navigation fallback.
- Original suite retained: 1,590 passing before changes; final count is confirmed in release checks.
- No Actor/item data migration. Existing saved artwork and VFX layout are preserved.

## Live verification to complete inside Foundry V14

Open Visuals > Image, turn preview on/off repeatedly, select Image/Beam/Nametag, drag and resize each, save/reopen. Equip and edit artwork in all five slot sizes and compare the displayed values with the preview. Verify reduced-motion and narrow-screen layouts. Chromium in this container did not complete the visual preview, so do not treat CSS appearance as visually verified here.
