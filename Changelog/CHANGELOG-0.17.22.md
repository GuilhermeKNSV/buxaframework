# Buxa Framework v0.17.22 — Opposite-edge Edit Buttons dock

- The **Edit Buttons** floating dock now appears on the **opposite edge** of the screen from Foundry's sidebar (normally the far left, when the sidebar is on the right).
- It detects active Foundry interface elements: sidebar, scene controls, navigation, player list, hotbar, notifications, dialogs, and open app windows. Positioning searches for a free viewport location and automatically uses the compact dock when necessary.
- The dock repositions when Foundry applications/scene controls render or close, or when the viewport resizes. It never moves or resizes Foundry's native UI.
- Save/Reset menus now open toward the screen center from the dock's new position, while button-context bubbles, Hide/Restore cards, folders, and the hidden drawer **remain anchored to the native sidebar buttons**.
- Fixes a small-screen CSS override that pinned the dock to the top-left despite JavaScript positioning.
- Preserves the square-corner styling, native tab behavior, animations and accessibility settings, and all existing layout persistence/permissions.
- Adds seven placement and source regression tests, including left/right layout, Foundry UI avoidance, narrow screens, and popout anchoring.

Verification: 2,926/2,926 automated tests passed; architecture passed (12 pre-existing soft file-size warnings); ZIP integrity checked. Actual Foundry UI testing is recommended, especially with third-party UI modules.
