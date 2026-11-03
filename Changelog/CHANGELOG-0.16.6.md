# Buxa Framework v0.16.6 — Shared Main and Sidebar Tab Fixes

- Removed the redundant `ROOT — Drop to move outside Main` strip from Items.
- Main and its folder contents now remain visible alongside the active numbered tab in Items, Actors and Scenes.
- Clicking `+` immediately creates and opens the next available numbered tab (`1`, `2`, `3`, ...), with no naming popup.
- Right-click > Rename now edits the tab name inline in the sidebar, without a detached form that loses keyboard focus when another sheet is open.
- Tab bar updates do not destroy an in-progress rename input.
- Dragging onto Main or a numbered tab moves existing world documents/folders without copying or deleting them.
- Dropping onto empty directory space now goes to Main by default, or the selected tab when active.
- Folder's `Move folder` menu now lists Main instead of an unrelated world-root destination.
- Main and numbered tab roots are protected from accidental folder moves or deletion through ordinary folder menus. Tab deletion remains available via the intended tab context menu.
- Added regression coverage for shared Main contents, numbered tab names, and tab-root protections.
