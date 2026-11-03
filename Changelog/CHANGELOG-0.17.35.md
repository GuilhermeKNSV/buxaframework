# Buxa Framework 0.17.35 — Interface refinement

- Reworked the Effect editor with compact navigation, readable lifecycle controls, clear selected triggers, a live behavior summary, keyboard tab navigation, and layouts that respond to the window width.
- Passive effects hide timed controls and triggers; permanent effects disable the turn count while preserving its saved value. Removed inherited Item label and decoration controls that the Effect schema did not save. The footer now says Save Effect.
- Refined Effect HUD cards with an open-sheet action, remaining-duration bar, explicit permanent status, stack counts, keyboard/touch removal access, live rarity refresh, and compact placement when side space is limited. Replaced observers are disconnected and viewport listeners are cleaned up.
- Improved sidebar editing with quieter square controls, a direct Hidden Buttons action, labeled drag previews, shorter drop motion, clear open/active folder states, and keyboard navigation in save menus. Existing native tab dimensions, folder drop targets, personal/world layouts and GM panel layering are preserved.
- Fixed restoring a personally hidden button incorrectly requiring a world-wide save; suppressed the accidental click following a completed drag.
- Refined Item editor navigation, field focus and narrow layouts. Module Configuration now adapts to its own window width, and its content grid no longer expands beyond a narrow window.
- Preserved Item/Magic/Effect rarity heroes, inventory artwork, saved data, and gameplay rules. No new dependencies.

Validation: 2,985 Node tests passed; architecture checks passed; all 17 Handlebars templates compiled. Browser previews used the production styles, templates and interaction modules to check wide/narrow layouts, passive controls, folder opening, sidebar reorder, hidden-button restoration, save menus and Effect HUD opening. Live Foundry world integration remains to be verified.
