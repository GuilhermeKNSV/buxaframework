# Buxa Framework 0.17.35 — Interface refinement

See [CHANGELOG-0.17.35.md](CHANGELOG-0.17.35.md) for the current release and validation details.

# Buxa Framework v0.12.1

## v0.12.1 — Player Settings save and token HUD repair

- Replaced unreliable native settings form submission with explicit Save action and close on success.
- Fixed opacity input step validation; removed Actor names from SAO resource HUDs.
- Streamlined SAO bars and made resource labels opt-in; kept saved label preferences intact.

## v0.12.0 — Animated token resource HUD / Player Settings

Each resource on the Buxa Player Sheet has a tracking icon. Click it to show/hide that resource on the Actor's token. The sheet's gear button now opens a **Player Settings** window (the GM's Link Player controls have moved there).

Under Token Resource Tracking, choose **SAO-inspired angular bar**, **classic horizontal bar**, or **vertical gauge** independently for each resource. Controls include position, size, opacity, thickness, color, offsets, label, current/maximum numbers and number position. Visibility supports **Everyone**, **Actor owners**, or **Selected players**. GMs can always preview the HUD. Settings live on the Actor in `flags.buxaframework.resourceHud`. No migration or native token resource modifications are needed.

The HUD is attached to Foundry's PIXI Token container (not a tracking DOM overlay): token movement and canvas zoom are handled by Foundry's own transforms. Only actual resource/config/dimension changes rebuild graphics. A small one-shot fade animation does not require continuous per-frame work. Resource visibility is a presentation setting, not encryption of Foundry document flags. Test in a real Foundry V14 scene before relying on it during live sessions.

## v0.11.26 — Connected storage shape painter

- External compartments now share the Item Size editor’s continuous cell design, centered origin, connected-shape editing and single-image mask preview.
- Resizing a pouch’s columns/rows preserves selected cell coordinates.

## v0.11.25 — Equipment storage

Go to **Item Configuration → Basic → Storage** to allow an equipped item to grant capacity, hidden equipment slots, and extra in-inventory pouch compartments. External compartments may have rectangular or custom-shaped (Complex) grids, rarity-derived/custom colors, and optional border/background.

Go to **Module Equipment Configuration** to mark equipment slots Hidden. A slot appears only when an item in the active Buxa equipment loadout grants that slot ID. An equipped item can grant extra backpack cells. If an equipped container is removed, its contents are retained as Overflow instead of being deleted. Existing inventory data does not need a migration.

## v0.10.6 — Item discovery and GM controls

Open **Item Configuration → Increase or Dice → Discovery & reveal** to choose the rule's initial state:

- **Revealed:** shown and active (the normal behavior of existing items).
- **Locked:** shown as a muted locked bonus, but contributes no stats or usable rolls.
- **Hidden:** shown as animated `???`; values and labels are masked, and no stats/rolls activate.
- **DM only:** nothing is shown to the player on the item sheet, compact hover, or action menu. The GM can manage the entry under the Item Sheet → **Control** tab.

From **Item Sheet → Control**, the GM can **Reveal, Lock, Hide, or set DM only** with one click (no configuration window). Revealing can set a new rarity and an alternate tooltip label/color/icon. For Increase rules, **Merge on reveal** can combine a newly revealed +5 HP with a compatible existing +5 HP to display +10 HP in one row; mechanically both bonuses still contribute normally when active. Merge targets must have the same target stat, bonus type and activation mode.

**Modular descriptions** are configured under **Item Configuration → Info → Modular Description**. Add fields for fragments such as `This item belongs to` and `unknown`, then give the second field the replacement text `Loki`. A locked field displays the initial placeholder until revealed, when the replacement takes its place. Set how fields join (space, directly, new line).

**Important privacy limitation:** Foundry distributes flags belonging to documents players can access. DM Only hides from Buxa UI and blocks Buxa item actions; it does **not** cryptographically protect secret raw item flags from technically knowledgeable players. Keep highly confidential text or future unrevealed stats in a separate GM-only document until reveal.

## v0.10.1 — Stability and maintainability audit

- Passive item increases now apply to **any owned Actor item** with a positive quantity, even if it was added outside the Buxa inventory grid. Equipped increases still require the selected Buxa equipment position.
- Reconciliation checks passive resource bounds even on actors without a Buxa inventory flag, while skipping redundant Actor writes when the stored inventory is already valid.
- Quantity/configuration changes made through external Foundry forms and macros now trigger resource-bound reconciliation.
- Compatible World Items and embedded Items may stack despite coincidentally sharing a local document ID; stacking identity consistently uses the provided module configuration.
- Foundry V14 dice ChatMessage roll payloads are stored as JSON objects instead of legacy serialized strings.
- The floating inventory-item preview now shows configured decorative dividers, symbols, text and a compact item description, with bounded layout on small screens.
- Added automated regression coverage (`node --experimental-default-type=module --test tests/*.test.mjs`). No item/actor data migration is required.

**Testing:** automated unit tests and architecture checks are available without Foundry, but actual Foundry V14 / D&D 5e v6 UI interaction must also be tested in a world before relying on it in a session.

## v0.9.0 — Equipped item increases + item config tabs + automatic sort modes

- Reorganized Buxa Item Configuration into **Info**, **Basic**, and **Increase** tabs. Info owns identity/rarity/type/description; Basic owns level requirement, weight, equip rules, and stacking/quantity.
- Added equipped-item increases for Buxa Resources (maximum), Attributes (value/modifier/dice), Proficiencies (value/modifier), Damage Reduction, and Initiative.
- Increase rows support flat values and percentage increases/decreases. Flat values stack first, then the combined percentage is applied.
- Increase tooltip lines can use the Item rarity color, a selected configured rarity, a custom color, or neutral text, with an optional custom line label.
- Item increases are derived from the active equipment/loadout position instead of permanently rewriting Actor stats, so removing/switching equipment removes the bonus without drift. Resource Current is safely clamped if removing an item lowers its effective maximum.
- Inventory sort mode is now part of **AUTO** sorting. The Quantity / Alphabetical / Rarity selector appears only while AUTO is enabled and remains the continuous automatic sort rule.
- Existing v0.8.x Items migrate through normalization with no increase entries until configured. Existing inventory AUTO state defaults to Alphabetical sorting.

## v0.8.13 — Item sizing fix + inventory sorting

- Fixed Full Color rarity backgrounds changing the positioning box of inventory/equipment item artwork. Occupied items keep their original absolute inset and `object-fit: contain`, so tall, wide and large equipment slots scale artwork correctly again.
- Added a compact **SORT** menu to the Inventory header with **Quantity**, **Alphabetical**, and **Rarity** actions.
- Quantity sorts highest stack quantity first; Alphabetical sorts A–Z; Rarity follows the configured rarity order with the highest rarity first.
- Sorting only rearranges bag/overflow items and never moves equipped items or changes active equipment loadouts.
- AUTO/MANUAL remains independent: sorting is a one-shot organization action and does not force automatic sorting on.


## v0.8.10 — Rarity glint + slot atmosphere

- Moved item weight out of the metadata list into the bottom-right corner of the Buxa Item Sheet.
- Added an optional **Name glint** rarity setting. Legendary and higher default rarities enable it automatically; custom rarities can toggle it independently.
- The glint is a narrow rarity-colored/white enchantment sweep over the item name rather than a full-text recolor.
- Removed the two bright rarity ornament dots from occupied inventory/equipment slots.
- Occupied slots now receive a subtle rarity-colored background wash in addition to their rarity edge/glow.
- Existing rarity configurations without the new glint field migrate by rarity ID, preserving built-in Legendary+ defaults more reliably.

## v0.8.9 — Item configuration window sizing fix

- Item Configuration now uses separate ApplicationV2 `form` and `footer` template parts, matching Foundry v14's native configuration-window pattern.
- The settings area owns the scroll region; the Save Item bar is a real footer and remains anchored to the bottom of the window.
- Toggling description, level, weight, equipment, quantity, or item-type options no longer creates a large empty region below the Save bar.

## v0.8.8 — Stable item config + rarity identity + item type label

- Fixed Item Configuration controls collapsing sections and leaving broken/blank application space. Disabled options now remain structurally stable and simply dim/disable.
- Added an optional per-item **Item Type Label**. GMs can enable/disable it and override the visual label without changing the underlying D&D 5e Item document type.
- Restored rarity as a strong item-sheet identity: item names and rarity labels use readable rarity accents, including dark colors such as Secret.
- High rarities again animate the sheet aura/ornament layer without recoloring the item artwork. Spectrum rarity animates only decorative layers/text.
- Reworked item property display into clean label/value rows instead of a crowded prose line.
- Dark rarity colors receive a readable derived accent for sheet and slot effects while preserving their configured base color.

## v0.8.7 — ARPG item tooltip pass

- Removed rarity stars, duplicate footer information and boxed metadata chips from the Buxa Item Sheet.
- Moved the GM configuration gear beside the item name and kept item artwork floating in the header.
- Reworked item metadata and description toward a compact ARPG tooltip presentation.
- Added readability protection for very dark rarity-name colors.


## v0.8.5 — Asset browser visibility

- Fixed Buxa Image Browser thumbnail URLs by resolving Foundry routes before rendering previews.
- SVG files now render as visible thumbnails/previews on a contrast checkerboard and carry a small SVG badge.
- Added broken-preview fallbacks instead of blank tiles.
- List/grid hover preview uses the resolved asset URL while selection still stores Foundry-compatible paths.

## v0.8.4 — Loader hotfix

- Fixed a malformed ES-module import in `scripts/apps/equipment-layout.js` introduced while wiring the Buxa Image Browser.
- Restores module initialization, sheet registration and all Buxa applications.
- No item, inventory, rarity, or configuration data model changes from v0.8.3.

## v0.8.3 — Item UI + Buxa Image Browser

- Reworked the Buxa Item Configuration window into grouped sections, compact switches, segmented equipment modes, selectable slot chips and conditional controls instead of a wall of checkboxes.
- Reworked high-rarity presentation so ornaments are light/glow accents rather than nested rectangular frames. Inventory/equipment items use the real slot border as the single rarity edge.
- Added the Buxa Image Browser and routed Buxa image selection through it for Actor fullbody/token images, Item images, equipment-slot backgrounds and custom SVG browsing.
- The Buxa Image Browser supports User Data/Core Data navigation, breadcrumbs, search, grid/list views, small/medium/large thumbnails, pointer/focus preview, image path/name display, uploads and folder creation where Foundry permissions allow.
- Foundry v14 does not expose client-side file move/rename/delete APIs to normal modules, so Buxa deliberately does not fake those operations or risk server files. File organization beyond folder creation/upload must still be done through the host filesystem or hosting provider.

## v0.8.2 — Item instance snapshots + default Buxa Item sheet

- Fixed remaining double rarity frames. Occupied inventory/equipment slots now use one physical slot border; rarity recolors/animates that border instead of drawing a second inner frame.
- Registered the Buxa Item Sheet as the default Foundry v14 Item sheet, so opening a world Item or Actor Item from Foundry opens Buxa directly.
- World/compendium Items now behave as templates for **future copies**. When dropped onto an Actor, Buxa freezes a per-instance snapshot of the source Buxa item rules.
- Editing an Item already embedded in an Actor changes only that instance. It never propagates back to the world template or sideways into sibling copies.
- Editing a world Item changes the template used by future Actor copies but never rewrites already-created Actor Items.
- Added per-instance identity/origin metadata and a conservative legacy repair pass. Missing Buxa rules are restored only from a concrete Foundry source UUID and existing instance-local rules are never overwritten.

## v0.7.7 — Local point feedback + clean inventory hover

- Removed floating `+1/-1` point text from Proficiency and Attribute changes, including collapsed Attributes. Their feedback now stays inside the control that changed.
- Proficiency/Attribute spend/refund feedback uses a short local blue emphasis instead of detached floating text or error-like outlines.
- Removed browser tooltips containing item names from Inventory/Equipment items.
- Removed hover-revealed item-name labels from Inventory/Equipment slots.
- Equipped slots hide their placeholder slot label while occupied, keeping equipped artwork clean.


## v0.7.6 — Progression feedback polish

- Progression cards and Level Up button now use sharp square corners.
- Level Up no longer floats duplicate level/point text over the progression cards.
- Level/point changes use a contained accent sweep, icon lift and number emphasis animation instead.
- Spending proficiency points now uses a subtle neutral-blue value response instead of the red loss/error treatment.

## v0.7.5 — Progression panel visual refresh

- Moved Level, Attribute Points, and Level Up out of the identity/header grid into a dedicated **Progression** panel between the character identity block and Resources.
- The identity header is back to two columns (portrait + fields), so progression no longer squeezes the name/custom fields.
- Reworked Level and Points into compact icon-backed stat chips with clearer hierarchy.
- Reworked **+ LEVEL UP** into a dedicated action with subtle glow, hover sheen, click feedback, and the existing level/point change feedback animations.
- Added responsive behavior for narrow sheet widths and respects `prefers-reduced-motion`.


## v0.7.4 — Top-level configuration workspaces

- Reworked Module Configuration navigation into three top-level sidebar areas: **Player Sheet**, **Inventory**, and **Addons**.
- **Player Sheet** keeps the focused horizontal sub-tabs: General, Resources, Level, Attributes, Stats, Proficiencies, and Rebirths.
- **Inventory** now opens as its own full configuration workspace instead of being a Player Sheet sub-tab.
- **Addons** now opens as its own full configuration workspace instead of being a Player Sheet sub-tab.
- The right-side heading changes with the selected top-level workspace while the shared Save/Reset controls remain available.

## v0.7.3 — Module configuration + entry SVGs + equipment editor polish

- Renamed the Foundry settings entry to **Module Configuration** with an **Open Module Configuration** button.
- Resources, Attributes, and Proficiencies can each independently enable an SVG icon and choose it with Buxa's built-in SVG picker.
- The SVG picker includes Buxa's bundled icons plus a Foundry browser for any custom `.svg` available to the world. Entry icons render only when the global **Addons → SVG Icons** switch and that entry's SVG switch are both enabled.
- **Apply Layout** in the Equipment Layout editor now immediately saves the equipment layout to world configuration and reconciles Actor inventory state. A second save in the parent configuration is no longer required for layout changes.
- Equipment slot **Color, Copy, and Delete** actions moved into a compact right-click context menu.
- Copying a slot now enters placement mode: a translucent ghost follows the pointer on the equipment canvas and the next click places the copy. Grid snapping/free placement still follows the current designer setting.
- Inventory item drag previews are always one normal inventory square, so dragging an item out of a Tall/Long/Large equipment slot no longer creates an oversized ghost.

## v0.7.2 — SVG UI + Addons controls

- Added **Player Sheet → Addons** with independent **SVG Icons** and **Carousel Combat Tracker** toggles.
- Buxa now ships its own lightweight SVG assets; no Game-icons.net module is required.
- BODY/TOKEN is now one portrait toggle button instead of two separate buttons. Its current state remains client-local per Actor.
- With **SVG Icons** enabled, the portrait toggle uses an icon and empty equipment slots receive type-specific SVG silhouettes. Custom slot background images still override the built-in silhouette.
- With **SVG Icons** disabled, the portrait toggle and equipment presentation remain text-first as before.
- Carousel Combat Tracker compatibility can now be disabled from Buxa without uninstalling `combat-tracker-dock`. Existing worlds preserve the previous enabled behavior.
- If Game-icons.net is installed separately, its files can still be selected through the normal equipment-background FilePicker; Buxa does not depend on it.

## v0.7.1 — Inventory loadouts + movement fixes

- Replaced fragile internal HTML drag handling with a direct pointer-drag path for Buxa inventory items, fixing items becoming stuck after their first placement.
- Equipment visual slots can now contain multiple loadout positions. Weapon and Offhand default to 2 positions; any slot can be configured from 1 to 12.
- Multi-position slots show compact numbered `1 / 2 / 3 / ...` controls directly on the slot. Only the active position is displayed and treated as equipped by D&D 5e.
- Switching the active position updates compatible D&D 5e `system.equipped` state so inactive weapons/offhands are unequipped.
- The Equipment Layout editor now includes **Loadout positions** per slot.
- The layout **Height (rows)** can now go down to 1 row (subject to the tallest configured slot), allowing very small Equipped areas when only a few slots are used.
- Fixed Player Sheet portrait mode persistence so level-up re-renders no longer reset BODY/TOKEN selection.
- Fixed saved UI state so the INVENTORY page itself is remembered correctly.

## v0.7.0 — Freeform equipment layout

- Fixed moving Actor-owned items between inventory/equipment slots by giving Buxa items explicit Foundry drag data and a direct internal move path.
- Equipment slots are now individual layout objects instead of count-limited type buckets. There are no per-type slot caps.
- Added **Player Sheet → Inventory → Organize equipment location**.
- The equipment designer can add any slot type, drag slots around a responsive canvas, snap to the grid or use free placement, rename slots, change size/color/background image, duplicate them, and delete them.
- Existing v0.6 equipment settings migrate into the new layout while preserving legacy slot IDs, so existing equipped-item placements remain attached whenever those slots still exist.
- Deleting a configured equipment slot never deletes its Item; reconciliation moves the tracked Item to overflow.


Buxa Framework is a modular Foundry VTT v14 player-sheet framework for D&D 5e 6.0.x.




## v0.6.0 — Inventory + Equipment

- Added a dedicated **INVENTORY** Player Sheet tab with separate **Equipped** and **Inventory** areas.
- The backpack grid is configurable from 1 to 200 square slots.
- Added configurable equipment categories: Weapon, Offhand, Helmet, Chestplate, Pants, Boots, Gloves, Belt, Mask, Cape, Rings, Necklaces, Misc, Potions, Scrolls, Backpacks and Gold.
- Default-enabled equipment: Helmet, Chestplate, Pants, Boots, Gloves, Belt, Weapon and Offhand. All other equipment categories default to disabled.
- Weapon and Offhand support one or two loadout slots with an in-sheet cycle control when the second slot is enabled.
- Equipment counts respect their requested caps: Rings/Misc up to 8; Necklaces/Weapon/Offhand up to 2; Potions/Scrolls/Backpacks/Gold up to 4; armor/mask/cape slots up to 1.
- Every equipment category has a configurable size pattern: Small 1×1, Wide 2×1, Tall 1×2, Long 1×3 or Large 2×2. Item art uses `object-fit: contain` so weapons and other tall/large artwork scale cleanly inside the slot.
- D&D 5e Items can be dragged from Foundry onto an inventory/equipment slot. External/world/compendium Items use Foundry's Actor-sheet drop workflow to become embedded Actor Items; existing Actor Items are tracked without creating duplicates.
- Tracked item placement is persisted on the Actor. Items can be dragged between any Buxa inventory/equipment slots. Occupied destinations swap positions when possible.
- Compatible D&D 5e Item `system.equipped` state follows movement between the inventory and equipped areas.
- Added **AUTO / MANUAL** sorting. AUTO compacts inventory items with no gaps; MANUAL preserves exact square placement.
- If configured capacity is reduced, tracked items which no longer fit remain visible in an **Overflow** tray instead of being lost.
- Added drag/drop highlighting, settle/drag animation, quantity badges, responsive grids, and double-click to open the D&D 5e Item sheet.

## v0.5.18 — Stats + Proficiencies

- Renamed the visible **OTHER STATS** page to **STATS**. Existing saved tab state migrates automatically.
- Removed the explanatory status/filler lines from the Stats page.
- DR and Initiative now use compact stat blocks so they take only the space they need.
- Added configurable **Proficiencies** with compact rows designed to fit many entries on the Stats page.
- Proficiencies can be enabled/disabled globally, relabeled, reordered, individually enabled/disabled, and linked to any configured Buxa attribute.
- A linked attribute contributes its live Buxa attribute modifier to the proficiency total.
- Added a separate configurable **Proficiency Points** pool with starting points, points gained, and the every-X-level cadence used by level-up progression.
- **Proficiency only** mode displays/spends directly into the proficiency modifier.
- **Attribute-style proficiency** mode supports its own value-to-modifier interval and individual toggles for d20 rolling, roll modes, number display, and modifier display.
- Proficiency rolls use the proficiency's total modifier, including its linked attribute modifier.

## v0.5.17 — Stylesheet loading fix

- Added a real `styles/buxa.css` entrypoint so Foundry never receives an HTML 404 page for the legacy/stale stylesheet URL.
- `module.json` now loads that stable entrypoint directly.
- `buxa.css` imports the existing split styles in their established cascade order, so the architecture stays modular while the public stylesheet URL stays stable.
- This specifically fixes Foundry v14 strict MIME errors such as `Refused to apply style ... styles/buxa.css ... MIME type (text/html)`.


## v0.5.16 — Sheet layout regression fix

- Restored the v0.5.14 Basic sheet DOM/layout instead of wrapping the whole page in a new panel container.
- Other Stats is now a separate top-level sheet page and does not alter the working Basic layout.
- Navigation uses the original Buxa tab element styling rather than Foundry's default button styling.
- Other Stats CSS is loaded through the existing final polish stylesheet, so the module keeps the same stylesheet manifest shape as the stable build.
- Added keyboard activation for the Basic / Other Stats tabs.

## v0.5.15 — Other Stats

### Other Stats sheet page

The Player Sheet now has a second navigation button, **OTHER STATS**, next to the Basic page. The selected page is remembered per user and per Actor.

The page currently contains:

- **DR · Damage Reduction** — an Actor-specific non-negative value that can automatically reduce incoming loss to one configured resource.
- **Initiative** — the live modifier contributed by one configured Buxa attribute.

### Damage Reduction

Configure DR in **Module Settings → Buxa Framework → Player Sheet → Other Stats**.

1. Enable **DR damage reduction**.
2. Choose the resource whose **Current** value is protected, such as HP.
3. Set each Actor's DR value from the **OTHER STATS** page of that Actor's Buxa sheet.

When the protected Current value decreases, Buxa subtracts the Actor's DR from that loss before the update is saved.

Example:

- HP Current: `5`
- Requested new Current: `3`
- Incoming loss: `2`
- DR: `1`
- Saved Current: `4`

DR only modifies decreases. Healing/increases are left unchanged. DR cannot turn damage into healing, and reductions remain clamped to the resource's valid Current/Max range.

Because DR runs at the Actor update boundary, it also sees compatible D&D 5e damage/HP updates and updates made outside the Buxa sheet. It can protect HP, MP, or any configured Buxa resource selected in Player Sheet settings.

### Initiative

Configure initiative in **Module Settings → Buxa Framework → Player Sheet → Other Stats**.

1. Enable **Buxa initiative modifier**.
2. Choose a configured Buxa attribute.
3. Make sure that attribute has **Modifier** enabled in the Attributes settings.

Buxa calculates the selected attribute's current modifier at initiative-roll time and adds it to D&D 5e initiative.

Example:

- Agility: `10`
- Agility Modifier: `+1 every 10 points`
- Buxa initiative contribution: `+1`

Starting/rolling combat initiative then includes that `+1`. The integration also applies when D&D 5e is configured to use fixed initiative scores.

## v0.5.14 stability fixes retained

- Fixed **Add Field** crashing because the layout application referenced an out-of-scope escape helper.
- First-run initialization preserves existing Actor ownership and adopts current owners as initial linked players.
- New-Actor initialization does not overwrite meaningful existing D&D 5e HP/resource values.
- Attribute collapse, lock and order are client-local presentation state.
- Client UI-state writes are serialized and merge-safe.
- Custom resources cannot silently share D&D 5e resource slots.
- Attribute chat rolls respect Foundry's current roll visibility mode.
- Sheet/window state keys include world and user context with bounded cache cleanup.

## Attribute rolls

Select the Attribute dice square to open the Buxa roll picker.

- **Normal:** separate `1d20 + modifier` checks equal to owned dice; keep the best total.
- **Vantagem:** add one extra separate check; keep the best total.
- **Desvantagem:** normal number of separate checks; keep the worst total.

Every individual check is included in the Foundry chat message.

## Architecture

See [`ARCHITECTURE.md`](./ARCHITECTURE.md). Run:

`node check-architecture.mjs`

before a major feature or release.

## Install

Extract `buxaframework` into:

`FoundryVTT/Data/modules/buxaframework`

The manifest should be:

`FoundryVTT/Data/modules/buxaframework/module.json`


## UI → Warning (v0.10.2)

GM users can open **Game Settings → Module Management / Buxa Framework → Module Configuration → UI → Warning** to customize the module's own notification popups.

- **Automatic dismissal:** any whole number from **0 to 60 seconds**, default **5 seconds**. A value of **0** keeps notifications on screen until dismissed manually.
- **Placement:** **Left**, **Middle** (centered at the top), or **Right** (default).
- **Preview warning:** shows a test notification using the current unsaved choices, so no need to save/reload to compare positions.
- These world settings apply to Buxa's **warnings, success/saved, errors, and information** popups for connected players; native Foundry notifications are not changed.
- Changing placement repositions already-visible Buxa notifications. New timers are applied to newly created notifications; existing timers continue until they expire.

## v0.8.0 — Buxa Items

Buxa inventory items now have an optional custom presentation/configuration layer on top of their normal D&D 5e Item documents.

- Double-click an item in the Buxa inventory to open the Buxa Item Sheet.
- GMs can open Item Configuration from the Buxa Item Sheet. Native Item windows also receive a small Buxa gem button for GMs.
- Item configuration supports name/image, optional description, level requirement, equipment-slot restrictions, optional weight, stackable quantities, and rarity.
- Level requirements are enforced when moving an item into equipment.
- Stackable copies can be dragged onto each other; D&D 5e quantity is merged and configured weight scales with quantity.
- Inventory weight can be enabled globally with a default capacity in Module Configuration → Inventory.
- Module Configuration → Items contains editable rarity definitions. Rarity name color, animated glow, ornaments, and spectrum/RGB effects can be controlled per rarity.
- Default rarities: Junk, Common, Uncommon, Rare, Epic, Legendary, Mythical, Relic, Masterwork, Secret, Divine, and Special.
- Mythical and higher defaults use animated presentation in the Buxa Item Sheet, inventory, and equipped-slot frame.
- Equipment placeholder SVGs fade further into the background while a real item occupies the slot.

### 0.8.1
- Fixed the GM item configuration window on Foundry v14 by rendering the ApplicationV2 template as a single root element.
- Rarity presentation now colors/animates the inventory or equipment slot frame instead of drawing a second border around the item artwork.

- Rarity background mode can be set per rarity to **Glint** (dark with rarity glow) or **Full Color** (strong rarity-colored slot fill).
## Number display

Module Configuration → Player Sheet → General includes a Number display rule used by percentage-derived Buxa gameplay values:

- Remove decimals (truncate toward zero)
- Round up
- Round down
- Show full number (meaningful decimals are kept while JavaScript floating-point noise is cleaned)

Attribute dice always remain whole numbers.


### Rebirth-safe attribute progress

Rebirth-enabled attributes keep cumulative base progress behind the scenes. Temporary equipped-item bonuses can help reach a rebirth threshold, but they are never permanently baked into the Actor. If removing an item means the Actor no longer supports a claimed rebirth, that rebirth becomes inactive and the visible attribute returns to the correct previous value instead of going negative. Re-equipping or naturally earning enough progress restores the claimed rebirth automatically.


## 0.9.3

- Added animated live value-source breakdowns for expanded attributes, resources, and proficiencies.
- Breakdown rows identify stored/invested values, linked attributes, rebirth contributions, and active equipped item modifiers with item artwork.
- Refreshed attribute cards for a cleaner compact/expanded presentation.

## 0.9.4

- Hotfix: corrects the value-source breakdown import so Buxa loads normally again.
- Release validation now includes static named-export checks across relative ES-module imports.

## v0.10.0 item actions

- Item increases can be equipped-only or passive while the item is carried in Buxa inventory.
- Items can define custom dice rolls with flat dice, attribute dice counts, attribute/proficiency modifiers, flat bonuses, advantage/disadvantage and range display.
- Item tooltip lines can use custom colors, rarity colors and optional image/SVG icons.
- Item sheets render dice and increase lines before the description and support configurable divider/symbol/text/spacer decoration.
- Inventory/equipment items show a delayed Buxa rarity tooltip and a right-click Use menu for configured Chat Rolls.


## 0.10.3 — Resizing and neutral item values

Buxa windows have a small drag handle at the lower-right corner for resizing. Focus the handle and use the arrow keys to resize via keyboard. Player-sheet size is saved when the sheet closes. The main Item Sheet shows Dice and Increase numbers and icons in neutral grays; newly added items default to the Neutral tooltip color option, while rarity/custom colored lines remain available for inventory hover tooltips.


## 0.10.4 — Item Increase & Dice editing

- Open an item > **Configuration** > **Increase** or **Dice**. Each rule has a live readable header, a button to collapse it, and a small remove button.
- Select targets, attributes, and modifiers with the searchable source picker. Categories are grouped; type part of a name or source ID to find it. Sources with the same visible name show their distinct IDs so they are not conflated.
- In **Dice**, edit the roll formula first, then the optional attribute dice/modifier and output toggles. In **Increase**, choose target/amount/type and whether the bonus is equipped-only or passive while carried.
- **Item display** is collapsed by default. Expand it to customize the tooltip label, visibility, icon and color independently from the rule calculation. This section does not control the colors of the neutral values on the actual Item sheet.
- Existing stored item rules continue to work; no data migration is required.

## 0.10.5 — Value-first item effects

Item sheets and compact inventory hover previews now display each effect in the order **icon → formula/bonus → label** (such as **🎲 1d20 DAMAGE** and **◆ +20% HP Maximum**), instead of separating the label and number across the width of the sheet. Passive rules show a small **PASSIVE** indicator after the text. Values and labels wrap at narrow widths. This is a presentation-only change; existing dice, increases, custom icons, item rarity, and data remain untouched.


## 0.10.7 — Descriptions, GM Control and stack counters

- Item Sheet shows the item directly, without navigation tabs. For GM discovery actions, open the gear icon -> **Item Configuration -> Control**. Buttons save to the item immediately; save any newly added rules before switching to Control.
- **Info -> Description** allows description off, standard prose, or independently revealable modular fields. Switching Standard / Modular keeps both sets of content saved.
- Inventory quantities appear as `×N` corner badges.

## 0.10.8 — Right-click actions and Unstack

- **Right-click an inventory item once** to open a compact action-only menu. Rarity and item artwork remain on the normal inventory slot/hover display and do not clutter the menu.
- If an item is configured as **Stackable** in Item Configuration → Basic, and has at least two units, right-click → **Unstack**. The modal lets you choose an integer quantity using the number input, slider, plus/minus controls, Half, or Max.
- For example, splitting **2** from **×4** leaves **×2** in the original slot and creates a separate **×2** item stack in the next free inventory cell. Split only works when a free inventory cell exists.
- New stacks retain all item configuration and discovery settings but receive a unique item/instance identity and are never equipped automatically. Stack two compatible piles together again by dragging one onto the other.


### World Item directory (v0.10.13)

Create Item now opens a small form with name, item type, and Buxa rarity. Create Folder offers a color picker. World Item and Folder right-click menus include relevant actions without Import/Export.

**Module Configuration → UI → Item UI → Open folders to the left** optionally displays folders in panels extending left from the native Items tab. Click another folder to open its children farther left; drag world Items between panels or into empty directory space to move them to the root. The setting is off by default.

### World directories (v0.10.17)

Buxa applies its custom directory UI to World Items, Actors, and Scenes. Each has a persistent `Main` folder pinned at the top. New world documents and folders are created inside their directory's Main by default; existing documents retain their current folders. Main is protected against deletion, renaming, and moving beneath another folder. Open folders normally inline, or enable **Module Configuration → UI → Item UI → Open folders to the left** to use nested panels in all three directories. Drag rows to reorder or move documents to different folders, or drag a folder row to reorganize the tree.


### UI V2 (v0.11.0)
All Buxa windows share the Figma UI V2 design tokens. The editable reference file is https://www.figma.com/design/TiXyH8brDGQBGqyzoj4AFN . Each UI family retains its own CSS file for modularity. Rarity colors and effects are still data-driven, and reduced-motion preference is supported.

### Actor canvas placement preview (v0.11.2)

Drag an Actor from Buxa's Actor directory, including an open folder panel, onto a Scene. A semi-transparent animated preview shows its prototype token texture and footprint as it follows the cursor. Release to use Foundry's ordinary Actor-to-canvas token creation. Hold **Shift** to preview without grid snapping. Esc or dropping outside the canvas cancels the preview. No duplicate tokens are created by the preview layer.

### Live Actor Token Preview (0.11.5)

In the Actor directory, right-click an Actor and choose **Edit actor & token**. The left preview updates live while you adjust token dimensions, image scale, rotation, opacity, vision range/angle, and light radii/angle. Move a slider for quick changes or click the value beside it to type an exact number; click the folder icon to browse artwork. Preview changes are not saved until you select **Save Changes**. In bulk mode, only fields explicitly enabled with **APPLY** are saved to the selected Actors. Placed tokens are not updated; these settings apply to prototype tokens for future placements.

### Complex inventory (0.11.6)

Select **Module Configuration → Inventory → Complex** to turn on shaped inventory. Set the number of columns/rows; automatic packing is off by default and can be enabled there. In **Item Configuration → Size**, click cells to paint an item footprint (up to 8×8), and adjust or drag the artwork to fit the shape. Move items by dragging them to open cells, press **R** to rotate while dragging. A red drag ghost means the shape would overlap or leave the grid. To organize equipped slots into groups, choose **Organize equipment location**, create tabs (e.g. Main and Backpacks), and set grid size and slots separately for each tab. Existing Simple inventories remain the default and require no migration.
