# Buxa Framework v0.17.28 — Folder insertion drawer

- In **Edit Buttons** mode, dragging a normal tab reveals a native-button-sized empty insertion slot that slides out from behind each folder, toward the center of the screen.
- **Drop over the empty slot** to add the tab to the corresponding folder. The slot highlights only when targeted.
- **Drop over the folder button or between sidebar buttons** for normal reorder behavior. Hovering the folder button no longer auto-nests the dragged tab.
- Slot uses the actual native Foundry tab geometry and stays within the viewport, remains visible even when the sidebar clips overflow, and disappears when the drag ends or is cancelled.
- Fast square-cornered slide animation with reduced-motion support. No layout storage, folder data model, or tab behavior changes.
- Added five targeted drag/drop regression tests; full suite verified.
