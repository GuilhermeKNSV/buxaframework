# Buxa Framework — Architecture Rules

Buxa is split by responsibility. `main.js` only registers settings, sheets, hooks and the public API; feature logic does not belong there.

## JavaScript structure

```text
scripts/
├── main.js
├── apps/
│   ├── player-sheet.js
│   ├── player-sheet-context.js
│   ├── value-breakdown.js
│   ├── attribute-roll.js
│   ├── attribute-setter.js
│   ├── proficiency-roll.js
│   ├── proficiency-controls.js
│   ├── portrait-controls.js
│   ├── inventory-context.js
│   ├── inventory-controls.js
│   ├── inventory-drop-target.js     # pure drop geometry shared by pointer/native drag
│   ├── equipment-layout.js
│   ├── svg-picker.js
│   ├── asset-browser.js
│   ├── item-context-menu.js      # one-right-click lightweight actions
│   ├── unstack-dialog.js         # accessible amount picker
│   ├── item-sheet.js
│   ├── item-config.js
│   ├── rarity-config.js
│   ├── layout-config-icon.js
│   ├── image-picker.js
│   ├── actor-config.js
│   ├── layout-config.js
│   └── layout-config-helpers.js
├── core/
│   ├── actor-state.js
│   ├── attributes.js
│   ├── attribute-progress.js
│   ├── resources.js
│   ├── value-sources.js
│   ├── proficiencies.js
│   ├── proficiency-config.js
│   ├── inventory-config.js
│   ├── inventory.js
│   ├── item-config.js
│   ├── item-increase-config.js
│   ├── item-effects.js
│   ├── item-stacks.js            # validated inventory stack splits
│   ├── item-runtime.js
│   ├── other-stats.js
│   ├── leveling.js
│   ├── permissions.js
│   ├── config.js
│   ├── dnd5e.js
│   ├── sync.js
│   ├── attribute-ui.js
│   ├── ui-state.js
│   ├── icons.js
│   ├── constants.js
│   └── runtime.js             # compatibility re-export only
└── integrations/
    ├── combat-tracker-dock.js
    └── other-stats.js
```

## Style structure

Styles remain split by responsibility. Foundry loads the stable `styles/buxa.css` entrypoint, which imports the focused files below in cascade order.

```text
styles/
├── buxa.css                  # stable entrypoint; imports files below in order
├── 00-foundation.css
├── 10-player-sheet.css
├── 20-dialogs.css
├── 30-config.css
├── 31-config-navigation.css
├── 35-inventory-config.css
├── 36-equipment-layout.css
├── 37-addons.css
├── 38-svg-picker.css
├── 38-asset-browser.css
├── 39-items.css
├── 39-item-config-v2.css
├── 40-sheet-refresh.css
├── 50-sheet-compact.css
├── 60-sheet-polish.css
├── 65-progression.css
├── 70-rolls.css
├── 80-latest-polish.css
├── 90-inventory.css
├── 95-rarity-polish.css
├── 96-item-fantasy.css
├── 97-item-sheet-v3.css
├── 98-item-config-layout.css
└── 99-rarity-glint.css
```

Do not place feature rules in `buxa.css`; it is only the stable stylesheet entrypoint. When a feature grows, prefer moving its rules into a focused stylesheet/module over appending indefinitely to an unrelated file.

Bundled interface SVGs live in `assets/icons/`. They are module-local presentation assets and must not require an external Foundry package.

## Dependency direction

- `main.js` is bootstrap only.
- `apps/` may import `core/`.
- `core/` must not import application classes.
- `integrations/` may use core/public APIs but must not own sheet business rules.
- D&D 5e document paths belong in `core/dnd5e.js`.
- Actor/resource/attribute/Stats/proficiency/inventory rules belong in focused domain modules, not the sheet class.
- System-facing hooks that bridge Buxa rules into D&D 5e workflows belong in `integrations/`.
- `core/runtime.js` exists only as a compatibility barrel for older internal/external imports.

## Size rules

`node check-architecture.mjs` enforces limits for JavaScript, CSS and Handlebars files.

- JavaScript: soft 500 / hard 700 lines.
- CSS: soft 800 / hard 1000 lines.
- Handlebars: soft 350 / hard 500 lines.
- `scripts/main.js`: hard 250 lines.

A hard-limit failure means the file must be split before adding more functionality.

## Feature rule

A feature gets its own module when it has its own state, UI, rules, or integration boundary. Examples:

- Inventory schema/slot rules → `core/inventory-config.js`
- Inventory Actor placement/sort rules → `core/inventory.js`
- Equipped Item increase schema/target labels → `core/item-increase-config.js`; runtime aggregation → `core/item-effects.js`
- Inventory sheet UI/context → `apps/inventory-*.js` + dedicated style rules
- Equipment layout editor → `apps/equipment-layout.js` + `templates/equipment-layout.hbs` + `styles/36-equipment-layout.css`
- SVG selection UI → `apps/svg-picker.js` + `apps/layout-config-icon.js` + `templates/svg-picker.hbs` + `styles/38-svg-picker.css`
- Image/file selection launched by Buxa → `apps/asset-browser.js` + `templates/asset-browser.hbs` + `styles/38-asset-browser.css`; use Foundry public FilePicker browse/upload/create-directory APIs rather than filesystem assumptions
- New external module support → `integrations/<module>.js` + an explicit Addons configuration switch when the integration changes behavior
- New roll workflow → dedicated roll application/helper
- Stats domain math/state → `core/other-stats.js`
- Proficiency schema/rules → `core/proficiency-config.js` + `core/proficiencies.js`
- Proficiency sheet interactions/rolls → `apps/proficiency-controls.js` + `apps/proficiency-roll.js`
- D&D 5e hooks for Stats → `integrations/other-stats.js`

Do not solve growth by creating a new generic `utils.js` dumping ground.

## Persistence

- World configuration: Foundry world settings.
- Actor gameplay state: Actor flags / linked D&D 5e data. DR, proficiency values, proficiency points, tracked inventory placement and sorting mode are Actor gameplay state. Equipment slot definitions/positions are world configuration.
- Derived gameplay values: calculate from current Actor/config/equipped Item state when needed. Item increases are derived from the active equipment positions; Initiative is derived at roll time.
- Sheet presentation state: client setting handled by `core/ui-state.js`, including the selected sheet page.
- Temporary application state: application/helper instance only.

- Rebirth-enabled attribute lifetime progress and temporary-item rollback rules live in `core/attribute-progress.js`.

## Item action boundaries

- Passive/equipped item-effect aggregation lives in `core/item-effects.js`.
- Item dice definitions and formula/range resolution live in `core/item-dice-config.js` and `core/item-dice.js`.
- Shared item-sheet/hover presentation data lives in `core/item-presentation.js`.
- Inventory hover and context interactions live in `apps/item-tooltip.js` and `apps/item-context-menu.js`.
- Item configuration remains in `apps/item-config.js`; do not move dice runtime or inventory rules into it.

## v0.10.7 Item description and discovery boundaries

- `scripts/core/item-discovery.js` defines standard versus modular description presentation; inactive description content is retained for switching modes.
- `scripts/core/item-control.js` builds GM-only control rows from normalized item rules.
- `scripts/apps/item-control.js` binds immediate GM reveal/lock/hide actions **only inside Item Configuration**; it synchronizes the corresponding unsaved form fields to prevent a subsequent Save from reverting the state.
- `scripts/apps/item-sheet.js` remains presentation-only with no Control or other navigation tabs.
- `styles/114-item-control-polish.css` owns optional description mode selection, control grid presentation and inventory stack-count badges.

## v0.11.10 performance boundaries

- `core/inventory-shapes.js` is the pure geometry and shared occupancy scanner; it must not call Foundry APIs or read actor flags in per-pointer-frame computations.
- `core/config.js` normalizes a stable settings source once, then invalidates on `settings.set` and the Foundry world-settings `onChange` hook. Any other writer must either replace the source object or call `invalidateSheetConfigCache()`.
- `apps/inventory-controls.js` computes shape/occupancy maps only after an actual drag begins, and reuses the snapshot for pointer frames.
- `apps/folder-panel-dom.js` preserves unaffected folder nodes; directory containers should not replace their entire `innerHTML` on unrelated updates.
- `apps/item-config-views.js` owns Item editor view models, and `apps/layout-config-sync.js` owns world configuration presentation/synchronization helpers.
- Performance changes must preserve drag/touch/keyboard accessibility, item flags, and deterministic sorted placement.

### Complex inventory placement (v0.11.20)
`scripts/core/complex-grid-anchor.js` owns the pure grid-cell pickup, clockwise anchor rotation, and final pointer-to-origin mapping. `scripts/apps/inventory-controls.js` uses that same mapping for ghost, highlights and pointerup. The scanner validates the entire occupied footprint, not a single slot. Do not reintroduce pixel-based grab offsets or automatic neighboring-slot relocation.

## Item-granted storage (v0.11.25)

`core/item-storage.js` owns normalization, active equipment grants, and external compartment footprint collision. `core/storage-drop-geometry.js` owns pointer-to-cell hit testing. `apps/item-storage-editor.js` owns the Item Basic configuration editor. `core/inventory.js` persists external locations as `{area:"storage",storageId,index,rotation}` under the existing Actor inventory flag. The UI uses the same item presentation and handles inside the sheet Inventory panel; inactive compartments place contents in Overflow without document deletion.
