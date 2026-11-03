# Buxa Framework v0.17.24 — Native-Sized Sidebar Folder Buttons

## Fixed
- Folder flyout buttons now inherit their pixel dimensions from a live Foundry sidebar tab, using Settings as the stable reference even if other buttons are assigned to folders.
- Folder button icons adopt the native tab's computed icon size, including Foundry UI scaling and supported theme changes.
- Supports button wrappers around a smaller clickable surface; keeps a bounded 32px fallback for unrendered/empty test environments.
- Flyout row height now derives from the native tab height. Square corners, horizontal layout, animation, placement, permissions, and the existing user/world save model remain unchanged.

## Console warning
- The Chromium/WebGPU `powerPreference` warning shown in the user's screenshot originates from Chromium's Windows GPU adapter selection; there are no `requestAdapter` or `powerPreference` calls in Buxa's source. This is not a module runtime failure and cannot be corrected from the sidebar feature without interfering with the host browser/renderer.

## Verification
- Sidebar native-size regression tests cover standard tabs, wrapped buttons, hidden tabs, changing tab dimensions, and square styling.
- Full Node suite and architecture check run as part of release verification.
- Live Foundry integration should still be checked on the user's desktop.
