# Buxa Framework 0.17.21 — Sidebar editor square-corner fix

- Removed rounded corner values from the last-loaded sidebar dock CSS (v0.17.20 had overridden the existing square rules).
- Squared the dock, save and reset menus, popup action buttons, launcher, folders, drawer, side cards, tooltips, toggles, and drag preview.
- Kept dock geometry, animations, layout saving, permissions, and interaction behavior unchanged.
- Added a regression test to prevent nonzero `border-radius` values returning to the sidebar editor stylesheet.
