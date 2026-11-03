# Buxa Framework v0.17.18 — Sidebar Edit Buttons visibility fix

- Fixed the editor launcher not appearing when Foundry V14 sidebar tabs are nested inside wrappers, e.g. `li > button[data-tab]` rather than direct `button[data-tab]` entries.
- Expanded discovery to support unnamed tab containers and alternative navigation markup while leaving Foundry's actual tab nodes and navigation handlers untouched.
- Added a small DOM-observer backstop so re-rendered sidebar parts automatically restore the Edit Buttons launcher.
- Moved Edit Buttons to the very bottom of the tab column, **below Collapse**, with a more visible blue pencil control and forced visibility against native skin rules.
- Tested with Chromium DOM layouts for direct and wrapped tab buttons, unnamed menus, entering Edit Mode, and complete tab-navigation replacement.
- No changes to saved layouts, permissions, or game mechanics. Exact runtime validation within Foundry V14 is still recommended.
- Refactored navigation discovery into `scripts/apps/sidebar-edit-navigation.js` so the controller stays under the architecture hard limit.
